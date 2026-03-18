import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../../_lib/api-auth";

type Params = { params: Promise<{ slug: string; id: string }> };

type ResolveItemResult =
  | { ok: true; collection: { id: string; type: string; tenant_id: string | null }; item: Record<string, unknown> }
  | { ok: false; error: string; status: 404 };

async function resolveItem(
  db: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  slug: string,
  itemId: string,
  tenantId: string
): Promise<ResolveItemResult> {
  const { data: collection } = await db
    .from("collections")
    .select("id, type, tenant_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) return { ok: false, error: "Collection not found", status: 404 };
  if (collection.type === "tenant" && collection.tenant_id !== tenantId) {
    return { ok: false, error: "Collection not found", status: 404 };
  }

  let q = db
    .from("collection_items")
    .select("id, data, created_at, updated_at, created_by, updated_by, collection_id, tenant_id")
    .eq("id", itemId)
    .eq("collection_id", collection.id);

  if (collection.type === "tenant") {
    q = q.eq("tenant_id", tenantId);
  }

  const { data: item } = await q.maybeSingle();
  if (!item) return { ok: false, error: "Item not found", status: 404 };

  return { ok: true, collection, item: item as Record<string, unknown> };
}

/**
 * GET /api/collections/:slug/items/:id
 * Query params: locale
 *   - omitted: canonical data only
 *   - "zh-CN": merge translated values into data (fallback chain)
 *   - "*": attach _translations object
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, id } = await params;

  const result = await resolveItem(db, slug, id, tenantId);
  if (!result.ok) return apiErr(result.error, result.status);

  const locale = request.nextUrl.searchParams.get("locale") ?? undefined;

  if (!locale) {
    return Response.json({ data: result.item });
  }

  // Fetch translations for this item
  let tQuery = db
    .from("collection_item_translations")
    .select("field_slug, language_code, value")
    .eq("item_id", id);

  if (locale !== "*") {
    const baseLang = locale.split("-")[0];
    const locales = baseLang !== locale ? [locale, baseLang] : [locale];
    tQuery = tQuery.in("language_code", locales);
  }

  const { data: translations } = await tQuery;

  if (locale === "*") {
    // Attach all translations as _translations object
    const grouped: Record<string, Record<string, string>> = {};
    for (const t of translations ?? []) {
      if (t.value === null) continue;
      if (!grouped[t.language_code]) grouped[t.language_code] = {};
      grouped[t.language_code][t.field_slug] = t.value;
    }
    const item = Object.keys(grouped).length > 0
      ? { ...result.item, _translations: grouped }
      : result.item;
    return Response.json({ data: item });
  }

  // Merge specific locale into data (fallback chain)
  const baseLang = locale.split("-")[0];
  const { data: translatableFields } = await db
    .from("collection_fields")
    .select("slug")
    .eq("collection_id", result.collection.id)
    .eq("is_translatable", true);

  const fieldSlugs = new Set((translatableFields ?? []).map((f) => f.slug));
  const data = { ...(result.item.data as Record<string, unknown>) };

  // Build lookup: fieldSlug → { locale: value }
  const localeMap = new Map<string, Map<string, string | null>>();
  for (const t of translations ?? []) {
    if (!localeMap.has(t.field_slug)) localeMap.set(t.field_slug, new Map());
    localeMap.get(t.field_slug)!.set(t.language_code, t.value);
  }

  for (const slug of fieldSlugs) {
    const lm = localeMap.get(slug);
    if (!lm) continue;
    const translated = lm.get(locale) ?? (baseLang !== locale ? lm.get(baseLang) : undefined);
    if (translated !== undefined && translated !== null) {
      data[slug] = translated;
    }
  }

  return Response.json({
    data: { ...result.item, data },
    meta: { locale },
  });
}

/**
 * PUT /api/collections/:slug/items/:id
 * Body: { data: { ... }, translations?: { "zh-CN": { "name": "..." }, ... } }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, userId, tenantId } = auth.ctx;
  const { slug, id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  if (!body.data || typeof body.data !== "object") {
    return apiErr("Body must contain a 'data' object");
  }

  const result = await resolveItem(db, slug, id, tenantId);
  if (!result.ok) return apiErr(result.error, result.status);

  const { data, error } = await db
    .from("collection_items")
    .update({ data: body.data, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, data, updated_at")
    .single();

  if (error) return apiErr(error.message, 500);

  // Upsert translations if provided
  const translations = body.translations as Record<string, Record<string, string>> | undefined;
  if (translations && typeof translations === "object") {
    const itemTenantId = result.collection.type === "system" ? null : tenantId;
    const rows = [];
    for (const [langCode, fields] of Object.entries(translations)) {
      for (const [fieldSlug, value] of Object.entries(fields)) {
        rows.push({
          item_id: id,
          collection_id: result.collection.id,
          tenant_id: itemTenantId,
          field_slug: fieldSlug,
          language_code: langCode,
          value: value === "" ? null : value,
          translated_by: userId,
          translated_at: new Date().toISOString(),
        });
      }
    }
    if (rows.length > 0) {
      const { error: tErr } = await db
        .from("collection_item_translations")
        .upsert(rows, { onConflict: "item_id,field_slug,language_code" });
      if (tErr) return apiErr(`Item updated but translations failed: ${tErr.message}`, 207);
    }
  }

  return Response.json({ data });
}

/**
 * DELETE /api/collections/:slug/items/:id
 * Translations are cascade-deleted by the trg_cascade_delete_item_translations trigger.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, id } = await params;

  const result = await resolveItem(db, slug, id, tenantId);
  if (!result.ok) return apiErr(result.error, result.status);

  const { error } = await db.from("collection_items").delete().eq("id", id);
  if (error) return apiErr(error.message, 500);

  return new Response(null, { status: 204 });
}
