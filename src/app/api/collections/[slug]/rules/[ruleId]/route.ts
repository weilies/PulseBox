import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../../_lib/api-auth";

type Params = { params: Promise<{ slug: string; ruleId: string }> };

/**
 * PUT /api/collections/:slug/rules/:ruleId
 *
 * Updates a tenant rule. Platform rules (tenant_id IS NULL) cannot be updated via API by tenants.
 *
 * Body (all fields optional):
 * {
 *   "name": "...",
 *   "description": "...",
 *   "priority": 10,
 *   "is_active": true,
 *   "conditions": { ... },
 *   "actions": { ... },
 *   "require_parent": false
 * }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, ruleId } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  // Verify the rule exists and belongs to this tenant (prevent modifying platform rules)
  const { data: existing } = await db
    .from("collection_rules")
    .select("id, tenant_id")
    .eq("id", ruleId)
    .eq("collection_slug", slug)
    .maybeSingle();

  if (!existing) return apiErr("Rule not found", 404);
  if (existing.tenant_id === null) return apiErr("Platform rules cannot be modified by tenants", 403);
  if (existing.tenant_id !== tenantId) return apiErr("Rule not found", 404);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.conditions !== undefined) updates.conditions = body.conditions;
  if (body.actions !== undefined) updates.actions = body.actions;
  if (body.require_parent !== undefined) updates.require_parent = body.require_parent;

  const { data, error } = await db
    .from("collection_rules")
    .update(updates)
    .eq("id", ruleId)
    .select("id, rule_type, name, description, priority, is_active, conditions, actions, require_parent, tenant_id, updated_at")
    .single();

  if (error) return apiErr(error.message, 500);

  return Response.json({ data }, { headers: auth.ctx.rlHeaders });
}

/**
 * DELETE /api/collections/:slug/rules/:ruleId
 *
 * Deletes a tenant rule. Platform rules cannot be deleted by tenants.
 *
 * Returns 204 No Content on success.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(_request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, ruleId } = await params;

  const { data: existing } = await db
    .from("collection_rules")
    .select("id, tenant_id")
    .eq("id", ruleId)
    .eq("collection_slug", slug)
    .maybeSingle();

  if (!existing) return apiErr("Rule not found", 404);
  if (existing.tenant_id === null) return apiErr("Platform rules cannot be deleted by tenants", 403);
  if (existing.tenant_id !== tenantId) return apiErr("Rule not found", 404);

  const { error } = await db.from("collection_rules").delete().eq("id", ruleId);
  if (error) return apiErr(error.message, 500);

  return new Response(null, { status: 204 });
}
