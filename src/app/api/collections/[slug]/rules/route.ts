import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../_lib/api-auth";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/collections/:slug/rules
 *
 * Returns all active rules for the collection:
 * - Platform rules (tenant_id IS NULL) — readable by all
 * - Tenant rules (tenant_id = current tenant) — readable by tenant users
 *
 * Response:
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "rule_type": "validation" | "derivation",
 *       "name": "...",
 *       "description": "...",
 *       "priority": 10,
 *       "is_active": true,
 *       "conditions": { "logic": "AND", "rules": [...] },
 *       "actions": { "type": "validation", "field": "...", "op": "...", "value": ..., "message": "..." },
 *       "require_parent": false,
 *       "tenant_id": null | "uuid",
 *       "created_at": "..."
 *     }
 *   ]
 * }
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(_request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  const { data: rules, error } = await db
    .from("collection_rules")
    .select("id, rule_type, name, description, priority, is_active, conditions, actions, require_parent, tenant_id, app_id, created_at, updated_at")
    .eq("collection_slug", slug)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order("rule_type")
    .order("priority");

  if (error) return apiErr(error.message, 500);

  return Response.json({ data: rules ?? [] }, { headers: auth.ctx.rlHeaders });
}

/**
 * POST /api/collections/:slug/rules
 *
 * Creates a new tenant-scoped rule.
 * Platform rules (tenant_id IS NULL) can only be created by super admins.
 *
 * Body:
 * {
 *   "rule_type": "validation" | "derivation",
 *   "name": "...",
 *   "description": "...",          // optional
 *   "priority": 10,                 // optional, default 10
 *   "is_active": true,              // optional, default true
 *   "conditions": { ... },          // optional, null = always fires
 *   "actions": { ... },
 *   "require_parent": false         // optional
 * }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId, userId } = auth.ctx;
  const { slug } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  if (!body.rule_type || !["validation", "derivation"].includes(body.rule_type as string)) {
    return apiErr("rule_type must be 'validation' or 'derivation'");
  }
  if (!body.name || typeof body.name !== "string") {
    return apiErr("name is required");
  }
  if (!body.actions || typeof body.actions !== "object") {
    return apiErr("actions is required");
  }

  const { data, error } = await db
    .from("collection_rules")
    .insert({
      collection_slug: slug,
      tenant_id: tenantId,
      rule_type: body.rule_type as string,
      name: body.name as string,
      description: (body.description as string | null) ?? null,
      priority: typeof body.priority === "number" ? body.priority : 10,
      is_active: typeof body.is_active === "boolean" ? body.is_active : true,
      conditions: (body.conditions as object | null) ?? null,
      actions: body.actions as object,
      require_parent: typeof body.require_parent === "boolean" ? body.require_parent : false,
      created_by: userId,
    })
    .select("id, rule_type, name, description, priority, is_active, conditions, actions, require_parent, tenant_id, created_at")
    .single();

  if (error) return apiErr(error.message, 500);

  return Response.json({ data }, { status: 201, headers: auth.ctx.rlHeaders });
}
