import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantLanguage, LocaleTranslations } from "@/types/translations";

/**
 * Fetch all translations for an item, returned as LocaleTranslations (locale-first).
 * { languageCode: { fieldSlug: value } }
 */
export async function getItemTranslations(
  supabase: SupabaseClient,
  itemId: string
): Promise<{ data: LocaleTranslations | null; error: string | null }> {
  const { data, error } = await supabase
    .from("collection_item_translations")
    .select("field_slug, language_code, value")
    .eq("item_id", itemId);

  if (error) return { data: null, error: error.message };

  const result: LocaleTranslations = {};
  for (const row of data ?? []) {
    if (!result[row.language_code]) result[row.language_code] = {};
    result[row.language_code][row.field_slug] = row.value ?? "";
  }
  return { data: result, error: null };
}

/**
 * Upsert translations for an item.
 * Accepts LocaleTranslations (locale-first); converts to rows for DB upsert.
 * Rows with empty string value are written as NULL (means "use fallback").
 */
export async function upsertItemTranslations(
  supabase: SupabaseClient,
  params: {
    itemId: string;
    collectionId: string;
    tenantId: string | null;
    translations: LocaleTranslations;
    userId: string;
  }
): Promise<{ error: string | null }> {
  const { itemId, collectionId, tenantId, translations, userId } = params;

  const rows: Record<string, unknown>[] = [];
  for (const [languageCode, fields] of Object.entries(translations)) {
    for (const [fieldSlug, value] of Object.entries(fields)) {
      rows.push({
        item_id: itemId,
        collection_id: collectionId,
        tenant_id: tenantId,
        field_slug: fieldSlug,
        language_code: languageCode,
        value: value === "" ? null : value,
        translated_by: userId,
        translated_at: new Date().toISOString(),
      });
    }
  }

  if (rows.length === 0) return { error: null };

  const { error } = await supabase
    .from("collection_item_translations")
    .upsert(rows, { onConflict: "item_id,field_slug,language_code" });

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Get all active languages for a tenant, ordered by sort_order.
 * Returns default language first.
 */
export async function getTenantLanguages(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ data: TenantLanguage[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from("tenant_languages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) return { data: null, error: error.message };
  return { data: data as TenantLanguage[], error: null };
}

/**
 * Add or update a language for a tenant.
 * If setting is_default = true, the DB partial unique index prevents duplicates.
 */
export async function upsertTenantLanguage(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    languageCode: string;
    languageName: string;
    isDefault?: boolean;
    sortOrder?: number;
  }
): Promise<{ error: string | null }> {
  const { tenantId, languageCode, languageName, isDefault = false, sortOrder = 0 } = params;

  const { error } = await supabase
    .from("tenant_languages")
    .upsert(
      {
        tenant_id: tenantId,
        language_code: languageCode,
        language_name: languageName,
        is_default: isDefault,
        is_active: true,
        sort_order: sortOrder,
      },
      { onConflict: "tenant_id,language_code" }
    );

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Deactivate a language for a tenant (soft delete — preserves existing translations).
 * Cannot deactivate the default language.
 */
export async function deactivateTenantLanguage(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null }> {
  // Guard: do not deactivate default
  const { data: lang } = await supabase
    .from("tenant_languages")
    .select("is_default")
    .eq("id", id)
    .maybeSingle();

  if (lang?.is_default) return { error: "Cannot deactivate the default language" };

  const { error } = await supabase
    .from("tenant_languages")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}
