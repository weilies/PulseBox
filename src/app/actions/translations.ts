"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import * as TranslationsService from "@/lib/services/translations.service";
import type { LocaleTranslations } from "@/types/translations";

/**
 * Fetch all translations for an item.
 * Called client-side when an edit dialog opens.
 */
export async function getItemTranslations(itemId: string) {
  if (!itemId) return { data: null, error: "Item ID is required" };
  const supabase = await createClient();
  return TranslationsService.getItemTranslations(supabase, itemId);
}

/**
 * Upsert translations for an item after editing.
 * Only saves locales that have at least one non-empty field value.
 */
export async function upsertItemTranslations(
  itemId: string,
  collectionId: string,
  translations: LocaleTranslations
) {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return { error: "No active tenant" };

  // Strip locales with all-empty fields to avoid polluting the table
  const cleaned: LocaleTranslations = {};
  for (const [locale, fields] of Object.entries(translations)) {
    const hasValues = Object.values(fields).some((v) => v && v.trim() !== "");
    if (hasValues) cleaned[locale] = fields;
  }

  const supabase = await createClient();
  return TranslationsService.upsertItemTranslations(supabase, {
    itemId,
    collectionId,
    tenantId,
    translations: cleaned,
    userId: user.id,
  });
}
