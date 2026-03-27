import { createAdminClient } from "@/lib/supabase/admin";

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  /** Input data with datetime field values normalized to UTC ISO strings. */
  normalizedData: Record<string, unknown>;
}

/**
 * Normalize a datetime value to a UTC ISO string.
 * Accepts:
 *   - Already has TZ: "2026-03-28T04:00:00Z" → unchanged
 *   - No TZ offset (datetime-local format): "2026-03-28T12:00" → "2026-03-28T12:00:00.000Z"
 * Returns the original value if it cannot be parsed.
 */
function normalizeDatetimeValue(val: unknown): unknown {
  if (typeof val !== "string" || !val) return val;
  // Already has TZ info — keep as-is
  if (val.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(val)) return val;
  // Matches YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss (no TZ) — treat as UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
    const normalized = val.includes(":") && val.split(":").length >= 2
      ? (val.length === 16 ? `${val}:00.000Z` : `${val}.000Z`)
      : val;
    // Validate it parses cleanly
    return isNaN(Date.parse(normalized)) ? val : normalized;
  }
  return val;
}

/**
 * Server-side field validation for collection items.
 *
 * Reads field definitions (is_required, options.validation) and applies:
 *   - required checks
 *   - number min/max
 *   - text max_length, pattern
 *   - custom external webhook_url per field (non-blocking on failure)
 *
 * Called before every item insert/update from the API route.
 * Works with JS disabled — entirely server-side.
 *
 * Field-level validation config (stored in collection_fields.options.validation):
 * {
 *   "min": 0,
 *   "max": 100,
 *   "pattern": "^[A-Z]{3}$",
 *   "error_message": "Must be a 3-letter uppercase code",
 *   "webhook_url": "https://...",
 *   "webhook_timeout_ms": 3000
 * }
 */
export async function validateItemData(
  collectionId: string,
  data: Record<string, unknown>,
  isUpdate = false,
  itemId?: string,
  tenantId?: string
): Promise<ValidationResult> {
  const db = createAdminClient();
  const errors: FieldError[] = [];

  const { data: fields } = await db
    .from("collection_fields")
    .select("slug, name, field_type, is_required, is_unique, options")
    .eq("collection_id", collectionId);

  if (!fields?.length) return { valid: true, errors: [], normalizedData: { ...data } };

  const normalizedData = { ...data };

  for (const field of fields) {
    // Normalize datetime values to UTC ISO before validation and save
    if (field.field_type === "datetime" && normalizedData[field.slug] != null) {
      normalizedData[field.slug] = normalizeDatetimeValue(normalizedData[field.slug]);
    }

    const value = normalizedData[field.slug];
    const opts = (field.options ?? {}) as Record<string, unknown>;
    const validation = (opts.validation ?? {}) as Record<string, unknown>;
    const isEmpty = value === undefined || value === null || value === "";

    // Required — only enforced on create (isUpdate=false)
    if (field.is_required && !isUpdate && isEmpty) {
      errors.push({ field: field.slug, message: `${field.name} is required` });
      continue;
    }
    if (isEmpty) continue;

    // Number rules
    if (field.field_type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({ field: field.slug, message: `${field.name} must be a number` });
        continue;
      }
      // min/max are stored at opts.min/opts.max (set by Edit Field dialog)
      // or under opts.validation.min/max (legacy advanced config) — check both
      const minVal = typeof opts.min === "number" ? opts.min : (typeof validation.min === "number" ? validation.min : undefined);
      const maxVal = typeof opts.max === "number" ? opts.max : (typeof validation.max === "number" ? validation.max : undefined);
      if (minVal !== undefined && num < minVal) {
        errors.push({ field: field.slug, message: `${field.name} must be at least ${minVal}` });
      }
      if (maxVal !== undefined && num > maxVal) {
        errors.push({ field: field.slug, message: `${field.name} must be at most ${maxVal}` });
      }
      // Decimals constraint
      const decVal = typeof opts.decimals === "number" ? opts.decimals : undefined;
      if (decVal !== undefined && decVal >= 0) {
        const parts = String(num).split(".");
        const actualDecimals = parts.length > 1 ? parts[1].length : 0;
        if (actualDecimals > decVal) {
          errors.push({
            field: field.slug,
            message: decVal === 0
              ? `${field.name} must be a whole number (no decimals)`
              : `${field.name} must have at most ${decVal} decimal place${decVal !== 1 ? "s" : ""}`,
          });
        }
      }
    }

    // Text / richtext rules
    if (field.field_type === "text" || field.field_type === "richtext") {
      const str = String(value);
      if (typeof opts.max_length === "number" && str.length > opts.max_length) {
        errors.push({
          field: field.slug,
          message: `${field.name} exceeds maximum length of ${opts.max_length}`,
        });
      }
      if (typeof validation.pattern === "string") {
        try {
          if (!new RegExp(validation.pattern).test(str)) {
            const msg =
              typeof validation.error_message === "string"
                ? validation.error_message
                : `${field.name} does not match the required format`;
            errors.push({ field: field.slug, message: msg });
          }
        } catch {
          // Invalid regex — skip silently
        }
      }
    }

    // File extension rules
    if (field.field_type === "file" && Array.isArray(opts.allowed_extensions) && opts.allowed_extensions.length > 0) {
      const filePath = String(value);
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      if (!opts.allowed_extensions.includes(ext)) {
        errors.push({
          field: field.slug,
          message: `${field.name}: file type .${ext} is not allowed. Accepted: ${(opts.allowed_extensions as string[]).map((e) => `.${e}`).join(", ")}`,
        });
      }
    }

    // Single-field unique constraint
    if (field.is_unique && !isEmpty && tenantId) {
      let uq = db
        .from("collection_items")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", collectionId)
        .eq(`data->>${field.slug}` as string, String(value));
      // Scope to tenant for tenant collections
      uq = uq.eq("tenant_id", tenantId);
      // Exclude self on update
      if (isUpdate && itemId) {
        uq = uq.neq("id", itemId);
      }
      const { count: uqCount } = await uq;
      if (uqCount && uqCount > 0) {
        errors.push({ field: field.slug, message: `${field.name} must be unique — this value already exists` });
      }
    }

    // Per-field external validation webhook (server call, fail-open)
    if (typeof validation.webhook_url === "string") {
      try {
        const timeout =
          typeof validation.webhook_timeout_ms === "number" ? validation.webhook_timeout_ms : 3000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(validation.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: field.slug, value, data }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          let msg = `${field.name} failed custom validation`;
          try {
            const json = await res.json();
            if (json.message) msg = json.message;
            else if (json.error) msg = json.error;
          } catch { /* ignore */ }
          errors.push({ field: field.slug, message: msg });
        }
      } catch {
        // Network/timeout error — fail-open, don't block save
      }
    }
  }

  // Composite unique constraint validation
  // Reads unique_constraints from collection metadata and checks for duplicates
  if (tenantId) {
    const { data: collection } = await db
      .from("collections")
      .select("metadata")
      .eq("id", collectionId)
      .maybeSingle();

    const metadata = (collection?.metadata ?? {}) as Record<string, unknown>;
    const constraints = (metadata.unique_constraints ?? []) as string[][];

    for (const fieldSlugs of constraints) {
      if (!Array.isArray(fieldSlugs) || fieldSlugs.length === 0) continue;

      // Check if all fields in the constraint have values
      const allPresent = fieldSlugs.every(
        (slug) => normalizedData[slug] !== undefined && normalizedData[slug] !== null
      );
      if (!allPresent) continue;

      // Query for existing items matching all fields in the constraint
      let q = db
        .from("collection_items")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", collectionId)
        .eq("tenant_id", tenantId);

      for (const slug of fieldSlugs) {
        q = q.eq(`data->>${slug}` as string, String(normalizedData[slug]));
      }

      // Exclude self on update
      if (isUpdate && itemId) {
        q = q.neq("id", itemId);
      }

      const { count } = await q;
      if (count && count > 0) {
        const fieldNames = fieldSlugs.join(", ");
        errors.push({
          field: fieldSlugs[0],
          message: `Duplicate: combination of [${fieldNames}] already exists`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, normalizedData };
}
