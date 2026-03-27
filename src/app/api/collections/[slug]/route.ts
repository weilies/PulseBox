import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../_lib/api-auth";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/collections/:slug
 * Returns the collection schema (metadata + fields).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  const { data: collection, error } = await db
    .from("collections")
    .select(`
      id, slug, name, description, icon, type, tenant_id, metadata, created_at, updated_at,
      collection_fields (
        id, slug, name, field_type, options, is_required, is_unique, sort_order
      )
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (error) return apiErr(error.message, 500);
  if (!collection) return apiErr("Collection not found", 404);

  // Tenant isolation: tenant collections must belong to this tenant
  if (collection.type === "tenant" && collection.tenant_id !== tenantId) {
    return apiErr("Collection not found", 404);
  }

  // Sort fields by sort_order
  const fields = [...(collection.collection_fields as Array<Record<string, unknown>>)]
    .sort((a, b) => (a.sort_order as number) - (b.sort_order as number));

  return Response.json({ data: { ...collection, collection_fields: fields } }, { headers: auth.ctx.rlHeaders });
}

/**
 * PUT /api/collections/:slug
 * Body: { name?, description?, icon? }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  const { data: collection } = await db
    .from("collections")
    .select("id, type, tenant_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) return apiErr("Collection not found", 404);
  if (collection.type === "tenant" && collection.tenant_id !== tenantId) {
    return apiErr("Collection not found", 404);
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name) updates.name = (body.name as string).trim();
  if (body.description !== undefined) updates.description = (body.description as string)?.trim() || null;
  if (body.icon !== undefined) updates.icon = (body.icon as string)?.trim() || null;

  // Merge metadata (partial update — only overwrite provided keys)
  if (body.metadata && typeof body.metadata === "object") {
    const allowedKeys = ["display_key_fields", "unique_constraints", "effective_date_field", "cascade_rules", "child_tab_sort_order"];
    const { data: current } = await db
      .from("collections")
      .select("metadata")
      .eq("id", collection.id)
      .maybeSingle();

    const existingMeta = (current?.metadata ?? {}) as Record<string, unknown>;
    const newMeta = body.metadata as Record<string, unknown>;
    const merged = { ...existingMeta };
    for (const key of allowedKeys) {
      if (newMeta[key] !== undefined) merged[key] = newMeta[key];
    }
    updates.metadata = merged;
  }

  const { data, error } = await db
    .from("collections")
    .update(updates)
    .eq("id", collection.id)
    .select("id, slug, name, description, icon, type, metadata, updated_at")
    .single();

  if (error) return apiErr(error.message, 500);
  return Response.json({ data }, { headers: auth.ctx.rlHeaders });
}

/**
 * DELETE /api/collections/:slug
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  const { data: collection } = await db
    .from("collections")
    .select("id, type, tenant_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) return apiErr("Collection not found", 404);
  if (collection.type === "tenant" && collection.tenant_id !== tenantId) {
    return apiErr("Collection not found", 404);
  }

  const { error } = await db.from("collections").delete().eq("id", collection.id);
  if (error) return apiErr(error.message, 500);

  return new Response(null, { status: 204 });
}
