import { NextRequest, after } from "next/server";
import { resolveApiContext, apiErr, paginate } from "../../../_lib/api-auth";
import { validateItemData } from "@/lib/collection-validation";
import { fireWebhooks, runPreSaveHook } from "@/lib/webhooks";

type Params = { params: Promise<{ slug: string }> };

async function resolveCollection(
  db: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  slug: string,
  tenantId: string
) {
  const { data } = await db
    .from("collections")
    .select("id, type, tenant_id, hooks")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) return null;
  if (data.type === "tenant" && data.tenant_id !== tenantId) return null;
  return data;
}

/**
 * Fetch translatable field slugs for a collection.
 */
async function getTranslatableFieldSlugs(
  db: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  collectionId: string
): Promise<string[]> {
  const { data } = await db
    .from("collection_fields")
    .select("slug")
    .eq("collection_id", collectionId)
    .eq("is_translatable", true);
  return (data ?? []).map((f) => f.slug);
}

/**
 * Fetch translations for a batch of item IDs.
 * Returns a map: { itemId: { fieldSlug: { locale: value } } }
 */
async function fetchTranslationsForItems(
  db: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  itemIds: string[],
  locale?: string
) {
  if (itemIds.length === 0) return [];

  let query = db
    .from("collection_item_translations")
    .select("item_id, field_slug, language_code, value")
    .in("item_id", itemIds);

  // If specific locale, fetch only that locale + base language
  if (locale && locale !== "*") {
    const baseLang = locale.split("-")[0];
    const locales = baseLang !== locale ? [locale, baseLang] : [locale];
    query = query.in("language_code", locales);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Apply translations to items for a specific locale (fallback chain).
 */
function applyLocale(
  items: Record<string, unknown>[],
  translations: { item_id: string; field_slug: string; language_code: string; value: string | null }[],
  locale: string,
  translatableFields: string[]
) {
  const baseLang = locale.split("-")[0];

  // Group translations: itemId → fieldSlug → { locale: value }
  const tMap = new Map<string, Map<string, Map<string, string | null>>>();
  for (const t of translations) {
    if (!tMap.has(t.item_id)) tMap.set(t.item_id, new Map());
    const fieldMap = tMap.get(t.item_id)!;
    if (!fieldMap.has(t.field_slug)) fieldMap.set(t.field_slug, new Map());
    fieldMap.get(t.field_slug)!.set(t.language_code, t.value);
  }

  return items.map((item) => {
    const itemId = item.id as string;
    const data = { ...(item.data as Record<string, unknown>) };
    const fieldMap = tMap.get(itemId);

    for (const slug of translatableFields) {
      if (!fieldMap?.has(slug)) continue;
      const localeMap = fieldMap.get(slug)!;
      // Fallback: exact locale → base language → canonical (already in data)
      const translated = localeMap.get(locale) ?? (baseLang !== locale ? localeMap.get(baseLang) : undefined);
      if (translated !== undefined && translated !== null) {
        data[slug] = translated;
      }
    }

    return { ...item, data };
  });
}

/**
 * Attach all translations as _translations object to each item.
 */
function attachAllTranslations(
  items: Record<string, unknown>[],
  translations: { item_id: string; field_slug: string; language_code: string; value: string | null }[]
) {
  // Group: itemId → { locale: { fieldSlug: value } }
  const tMap = new Map<string, Record<string, Record<string, string>>>();
  for (const t of translations) {
    if (t.value === null) continue;
    if (!tMap.has(t.item_id)) tMap.set(t.item_id, {});
    const locales = tMap.get(t.item_id)!;
    if (!locales[t.language_code]) locales[t.language_code] = {};
    locales[t.language_code][t.field_slug] = t.value;
  }

  return items.map((item) => {
    const itemId = item.id as string;
    const itemTranslations = tMap.get(itemId);
    return itemTranslations
      ? { ...item, _translations: itemTranslations }
      : item;
  });
}

/**
 * GET /api/collections/:slug/items
 * Query params: page, limit, sort (created_at|updated_at), order (asc|desc), locale
 *
 * locale param:
 *   - omitted: returns canonical data (default language)
 *   - "zh-CN": merges translated values into data (fallback: zh → canonical)
 *   - "*": attaches _translations object with all locale values
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  const collection = await resolveCollection(db, slug, tenantId);
  if (!collection) return apiErr("Collection not found", 404);

  const sp = request.nextUrl.searchParams;
  const { page, limit, from, to } = paginate(sp);
  const sortField = ["created_at", "updated_at"].includes(sp.get("sort") ?? "")
    ? sp.get("sort")!
    : "created_at";
  const ascending = (sp.get("order") ?? "desc") === "asc";
  const locale = sp.get("locale") ?? undefined;

  let query = db
    .from("collection_items")
    .select("id, data, created_at, updated_at, created_by, updated_by", { count: "exact" })
    .eq("collection_id", collection.id)
    .order(sortField, { ascending })
    .range(from, to);

  if (collection.type === "tenant") {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error, count } = await query;
  if (error) return apiErr(error.message, 500);

  let items = (data ?? []) as Record<string, unknown>[];

  // Locale resolution
  if (locale && items.length > 0) {
    const itemIds = items.map((i) => i.id as string);
    const translations = await fetchTranslationsForItems(db, itemIds, locale);

    if (locale === "*") {
      items = attachAllTranslations(items, translations);
    } else {
      const translatableFields = await getTranslatableFieldSlugs(db, collection.id);
      items = applyLocale(items, translations, locale, translatableFields);
    }
  }

  const meta: Record<string, unknown> = {
    page,
    limit,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
  if (locale && locale !== "*") meta.locale = locale;

  return Response.json({ data: items, meta });
}

/**
 * POST /api/collections/:slug/items
 * Body: { data: { ... }, translations?: { "zh-CN": { "name": "..." }, ... } }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, userId, tenantId } = auth.ctx;
  const { slug } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  if (!body.data || typeof body.data !== "object") {
    return apiErr("Body must contain a 'data' object");
  }

  const collection = await resolveCollection(db, slug, tenantId);
  if (!collection) return apiErr("Collection not found", 404);

  // Server-side field validation
  const validation = await validateItemData(collection.id, body.data as Record<string, unknown>);
  if (!validation.valid) {
    return Response.json({ errors: validation.errors }, { status: 422 });
  }

  // onPreSave hook (blocks save on rejection)
  const hooks = (collection.hooks ?? {}) as Record<string, unknown>;
  if (hooks.on_pre_save) {
    const blocked = await runPreSaveHook(
      hooks.on_pre_save as Record<string, unknown>,
      slug, tenantId, "create", body.data
    );
    if (blocked) return blocked;
  }

  const itemTenantId = collection.type === "system" ? null : tenantId;

  const { data, error } = await db
    .from("collection_items")
    .insert({
      collection_id: collection.id,
      tenant_id: itemTenantId,
      data: body.data,
      created_by: userId,
      updated_by: userId,
    })
    .select("id, data, created_at, updated_at")
    .single();

  if (error) return apiErr(error.message, 500);

  // Upsert translations if provided
  const translations = body.translations as Record<string, Record<string, string>> | undefined;
  if (translations && typeof translations === "object" && data) {
    const rows = [];
    for (const [langCode, fields] of Object.entries(translations)) {
      for (const [fieldSlug, value] of Object.entries(fields)) {
        rows.push({
          item_id: data.id,
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
    if (rows.length > 0) {
      const { error: tErr } = await db
        .from("collection_item_translations")
        .upsert(rows, { onConflict: "item_id,field_slug,language_code" });
      if (tErr) return apiErr(`Item created but translations failed: ${tErr.message}`, 207);
    }
  }

  // Fire post-save webhooks after response (non-blocking)
  after(() => fireWebhooks(tenantId, slug, "item.created", data as Record<string, unknown>));

  return Response.json({ data }, { status: 201 });
}
