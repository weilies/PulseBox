import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../../../_lib/api-auth";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * GET /api/collections/:slug/items/:id/translations
 * Returns all translations for a single item.
 *
 * Response: { data: { "zh-CN": { "name": "..." }, "ms": { "name": "..." } } }
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, id } = await params;

  // Validate collection + item
  const { data: collection } = await db
    .from("collections")
    .select("id, type, tenant_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) return apiErr("Collection not found", 404);
  if (collection.type === "tenant" && collection.tenant_id !== tenantId) {
    return apiErr("Collection not found", 404);
  }

  let q = db
    .from("collection_items")
    .select("id")
    .eq("id", id)
    .eq("collection_id", collection.id);
  if (collection.type === "tenant") q = q.eq("tenant_id", tenantId);

  const { data: item } = await q.maybeSingle();
  if (!item) return apiErr("Item not found", 404);

  // Fetch all translations
  const { data: translations } = await db
    .from("collection_item_translations")
    .select("field_slug, language_code, value")
    .eq("item_id", id);

  const grouped: Record<string, Record<string, string>> = {};
  for (const t of translations ?? []) {
    if (t.value === null) continue;
    if (!grouped[t.language_code]) grouped[t.language_code] = {};
    grouped[t.language_code][t.field_slug] = t.value;
  }

  return Response.json({ data: grouped });
}

/**
 * PATCH /api/collections/:slug/items/:id/translations
 * Upserts translations for a single item. Does NOT touch canonical data.
 *
 * Body: { "zh-CN": { "name": "人力资源" }, "ms": { "name": "Sumber Manusia" } }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, userId, tenantId } = auth.ctx;
  const { slug, id } = await params;

  let body: Record<string, Record<string, string>>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiErr("Body must be { locale: { field: value } }");
  }

  // Validate collection + item
  const { data: collection } = await db
    .from("collections")
    .select("id, type, tenant_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) return apiErr("Collection not found", 404);
  if (collection.type === "tenant" && collection.tenant_id !== tenantId) {
    return apiErr("Collection not found", 404);
  }

  let q = db
    .from("collection_items")
    .select("id")
    .eq("id", id)
    .eq("collection_id", collection.id);
  if (collection.type === "tenant") q = q.eq("tenant_id", tenantId);

  const { data: item } = await q.maybeSingle();
  if (!item) return apiErr("Item not found", 404);

  // Validate field slugs are translatable
  const { data: translatableFields } = await db
    .from("collection_fields")
    .select("slug")
    .eq("collection_id", collection.id)
    .eq("is_translatable", true);

  const allowedSlugs = new Set((translatableFields ?? []).map((f) => f.slug));

  // Build upsert rows
  const itemTenantId = collection.type === "system" ? null : tenantId;
  const rows = [];
  const rejected: string[] = [];

  for (const [langCode, fields] of Object.entries(body)) {
    if (typeof fields !== "object" || Array.isArray(fields)) continue;
    for (const [fieldSlug, value] of Object.entries(fields)) {
      if (!allowedSlugs.has(fieldSlug)) {
        rejected.push(`${fieldSlug} is not translatable`);
        continue;
      }
      rows.push({
        item_id: id,
        collection_id: collection.id,
        tenant_id: itemTenantId,
        field_slug: fieldSlug,
        language_code: langCode,
        value: value === "" ? null : value,
        translated_by: userId,
        translated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0 && rejected.length > 0) {
    return apiErr(`No valid translations: ${rejected.join(", ")}`, 422);
  }

  if (rows.length > 0) {
    const { error } = await db
      .from("collection_item_translations")
      .upsert(rows, { onConflict: "item_id,field_slug,language_code" });
    if (error) return apiErr(error.message, 500);
  }

  const response: Record<string, unknown> = {
    data: { upserted: rows.length },
  };
  if (rejected.length > 0) response.warnings = rejected;

  return Response.json(response);
}

/**
 * DELETE /api/collections/:slug/items/:id/translations
 * Query params: locale (optional)
 *   - omitted: delete ALL translations for this item
 *   - "zh-CN": delete only that locale's translations
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, id } = await params;

  // Validate collection + item
  const { data: collection } = await db
    .from("collections")
    .select("id, type, tenant_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) return apiErr("Collection not found", 404);
  if (collection.type === "tenant" && collection.tenant_id !== tenantId) {
    return apiErr("Collection not found", 404);
  }

  let q = db
    .from("collection_items")
    .select("id")
    .eq("id", id)
    .eq("collection_id", collection.id);
  if (collection.type === "tenant") q = q.eq("tenant_id", tenantId);

  const { data: item } = await q.maybeSingle();
  if (!item) return apiErr("Item not found", 404);

  const locale = request.nextUrl.searchParams.get("locale");

  let deleteQuery = db
    .from("collection_item_translations")
    .delete()
    .eq("item_id", id);

  if (locale) {
    deleteQuery = deleteQuery.eq("language_code", locale);
  }

  const { error } = await deleteQuery;
  if (error) return apiErr(error.message, 500);

  return new Response(null, { status: 204 });
}
