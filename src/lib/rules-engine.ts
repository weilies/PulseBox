/**
 * Rule Engine v1
 *
 * Evaluates collection_rules against item data on preSave.
 * Execution order (per spec):
 *   1. Platform derivations (priority ASC)
 *   2. Tenant derivations   (priority ASC)
 *   3. Platform validations (priority ASC)
 *   4. Tenant validations   (priority ASC)
 *
 * Derivations mutate the evaluation context so later rules see derived values.
 * Validations collect all errors (no early exit).
 *
 * Usage:
 *   const result = await evaluateRules(collectionSlug, itemData, tenantId, parentId?)
 *   if (result.errors.length) return 422
 *   merge result.derivedData into itemData before DB insert
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldError } from "@/lib/collection-validation";
import { evaluate as mathEvaluate } from "mathjs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionRule {
  field: string;
  op: string;
  value: unknown;
}

interface ConditionGroup {
  logic: "AND" | "OR";
  rules: ConditionRule[];
}

interface ValidationAction {
  type: "validation";
  field: string;
  op: string;
  value: unknown;
  message: string;
}

interface DerivationAction {
  type: "derivation";
  target_field: string;
  formula: string;
}

interface CollectionRule {
  id: string;
  rule_type: "validation" | "derivation";
  name: string;
  priority: number;
  tenant_id: string | null;
  conditions: ConditionGroup | null;
  actions: ValidationAction | DerivationAction;
  require_parent: boolean;
}

export interface RuleEngineResult {
  errors: FieldError[];
  derivedData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

function evalOp(fieldValue: unknown, op: string, ruleValue: unknown): boolean {
  const fv = fieldValue;
  const rv = ruleValue;

  // Numeric comparison helpers
  const toNum = (v: unknown) => Number(v);

  switch (op) {
    case "eq":        return String(fv) === String(rv);
    case "neq":       return String(fv) !== String(rv);
    case "gt":        return toNum(fv) > toNum(rv);
    case "gte":       return toNum(fv) >= toNum(rv);
    case "lt":        return toNum(fv) < toNum(rv);
    case "lte":       return toNum(fv) <= toNum(rv);
    case "in":        return Array.isArray(rv) && rv.map(String).includes(String(fv));
    case "not_in":    return !Array.isArray(rv) || !rv.map(String).includes(String(fv));
    case "contains":  return typeof fv === "string" && fv.includes(String(rv));
    case "is_empty":  return fv === null || fv === undefined || fv === "";
    case "is_not_empty": return fv !== null && fv !== undefined && fv !== "";
    default:          return false;
  }
}

function resolveField(fieldPath: string, context: Record<string, unknown>): unknown {
  // Support "parent.field_name" via context.parent object
  if (fieldPath.startsWith("parent.")) {
    const subKey = fieldPath.slice(7);
    const parent = context["parent"] as Record<string, unknown> | undefined;
    return parent?.[subKey] ?? undefined;
  }
  return context[fieldPath];
}

function evalConditions(conditions: ConditionGroup | null, context: Record<string, unknown>): boolean {
  // null or empty rules = always fires
  if (!conditions || !conditions.rules || conditions.rules.length === 0) return true;

  const results = conditions.rules.map((rule) => {
    const fieldValue = resolveField(rule.field, context);
    return evalOp(fieldValue, rule.op, rule.value);
  });

  return conditions.logic === "OR"
    ? results.some(Boolean)
    : results.every(Boolean);
}

// ---------------------------------------------------------------------------
// Formula evaluation via mathjs
// ---------------------------------------------------------------------------

function buildMathScope(context: Record<string, unknown>): Record<string, unknown> {
  const scope: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(context)) {
    if (key === "parent" && typeof val === "object" && val !== null) {
      // Flatten parent.field → parent__field for mathjs
      for (const [pk, pv] of Object.entries(val as Record<string, unknown>)) {
        scope[`parent__${pk}`] = typeof pv === "number" ? pv : (parseFloat(String(pv)) || 0);
      }
    } else {
      scope[key] = typeof val === "number" ? val : (parseFloat(String(val)) || 0);
    }
  }
  return scope;
}

function preprocessFormula(formula: string): string {
  // Convert parent.field → parent__field so mathjs can parse it
  return formula.replace(/parent\.(\w+)/g, "parent__$1");
}

function evaluateFormula(formula: string, context: Record<string, unknown>): unknown {
  try {
    const scope = buildMathScope(context);
    const processed = preprocessFormula(formula);
    const result = mathEvaluate(processed, scope);
    return typeof result === "number" ? result : String(result);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

export async function evaluateRules(
  collectionSlug: string,
  itemData: Record<string, unknown>,
  tenantId: string,
  parentId?: string
): Promise<RuleEngineResult> {
  const db = createAdminClient();
  const errors: FieldError[] = [];
  const derivedData: Record<string, unknown> = {};

  // Load all active rules for this collection (platform + tenant)
  const { data: rawRules } = await db
    .from("collection_rules")
    .select("id, rule_type, name, priority, tenant_id, conditions, actions, require_parent")
    .eq("collection_slug", collectionSlug)
    .eq("is_active", true)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

  if (!rawRules || rawRules.length === 0) {
    return { errors: [], derivedData: {} };
  }

  const rules = rawRules as CollectionRule[];

  // Check if any rule needs parent context
  const needsParent = rules.some((r) => r.require_parent) && !!parentId;
  let parentRecord: Record<string, unknown> = {};

  if (needsParent && parentId) {
    const { data: parentItem } = await db
      .from("collection_items")
      .select("data")
      .eq("id", parentId)
      .maybeSingle();
    if (parentItem?.data) {
      parentRecord = parentItem.data as Record<string, unknown>;
    }
  }

  // Build evaluation context (mutable — derivations update it)
  const context: Record<string, unknown> = {
    ...itemData,
    parent: parentRecord,
  };

  // Sort rules: derivations first, then validations
  // Within each type: platform (tenant_id IS NULL) first, then by priority ASC
  const sorted = [...rules].sort((a, b) => {
    // derivation before validation
    if (a.rule_type !== b.rule_type) {
      return a.rule_type === "derivation" ? -1 : 1;
    }
    // platform before tenant
    const aPlatform = a.tenant_id === null ? 0 : 1;
    const bPlatform = b.tenant_id === null ? 0 : 1;
    if (aPlatform !== bPlatform) return aPlatform - bPlatform;
    // then by priority
    return a.priority - b.priority;
  });

  // Execute derivations
  for (const rule of sorted.filter((r) => r.rule_type === "derivation")) {
    const action = rule.actions as DerivationAction;
    if (!evalConditions(rule.conditions, context)) continue;

    const result = evaluateFormula(action.formula, context);
    if (result !== null) {
      context[action.target_field] = result;
      derivedData[action.target_field] = result;
    }
  }

  // Execute validations
  for (const rule of sorted.filter((r) => r.rule_type === "validation")) {
    const action = rule.actions as ValidationAction;
    if (!evalConditions(rule.conditions, context)) continue;

    const fieldValue = resolveField(action.field, context);
    const passes = evalOp(fieldValue, action.op, action.value);
    if (!passes) {
      errors.push({
        field: action.field,
        message: action.message || `${rule.name}: validation failed`,
      });
    }
  }

  return { errors, derivedData };
}
