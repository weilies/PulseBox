import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify } from "./slugify";
import { requireSuperAdmin } from "./permissions.service";
import type { CatalogSchema } from "@/types/catalog";

export async function createCatalog(
  supabase: SupabaseClient,
  params: { name: string; description?: string | null }
) {
  await requireSuperAdmin(supabase);

  const { name, description = null } = params;
  const slug = slugify(name);

  const { data: existing } = await supabase
    .from("content_catalogs")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { error: `A catalog with slug "${slug}" already exists` };

  const { error } = await supabase.from("content_catalogs").insert({ name, slug, description });
  if (error) return { error: error.message };
  return { data: true };
}

export async function updateCatalog(
  supabase: SupabaseClient,
  params: { catalogId: string; name: string; description?: string | null }
) {
  await requireSuperAdmin(supabase);

  const { catalogId, name, description = null } = params;
  const { error } = await supabase
    .from("content_catalogs")
    .update({ name, description })
    .eq("id", catalogId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function deleteCatalog(supabase: SupabaseClient, catalogId: string) {
  await requireSuperAdmin(supabase);
  const { error } = await supabase.from("content_catalogs").delete().eq("id", catalogId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function updateCatalogColumns(
  supabase: SupabaseClient,
  params: { catalogId: string; columns: CatalogSchema | null }
) {
  await requireSuperAdmin(supabase);
  const { catalogId, columns } = params;
  const { error } = await supabase
    .from("content_catalogs")
    .update({ columns })
    .eq("id", catalogId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function createCatalogItem(
  supabase: SupabaseClient,
  params: { catalogId: string; label: string; value: string; data?: Record<string, unknown> }
) {
  await requireSuperAdmin(supabase);

  const { catalogId, label, value } = params;
  const { data: last } = await supabase
    .from("content_catalog_items")
    .select("sort_order")
    .eq("catalog_id", catalogId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("content_catalog_items")
    .insert({ catalog_id: catalogId, label, value, sort_order: sortOrder, data: params.data ?? {} });
  if (error) return { error: error.message };
  return { data: true };
}

export async function updateCatalogItem(
  supabase: SupabaseClient,
  params: { itemId: string; label: string; value: string; isActive: boolean; data?: Record<string, unknown> }
) {
  await requireSuperAdmin(supabase);
  const { itemId, label, value, isActive } = params;
  const { error } = await supabase
    .from("content_catalog_items")
    .update({ label, value, is_active: isActive, data: params.data ?? {} })
    .eq("id", itemId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function deleteCatalogItem(supabase: SupabaseClient, itemId: string) {
  await requireSuperAdmin(supabase);
  const { error } = await supabase.from("content_catalog_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function moveCatalogItem(
  supabase: SupabaseClient,
  params: { itemId: string; direction: "up" | "down"; currentOrder: number; catalogId: string }
) {
  await requireSuperAdmin(supabase);
  const { itemId, direction, currentOrder, catalogId } = params;

  const { data: adjacent } = await supabase
    .from("content_catalog_items")
    .select("id, sort_order")
    .eq("catalog_id", catalogId)
    .eq("sort_order", direction === "up" ? currentOrder - 1 : currentOrder + 1)
    .maybeSingle();

  if (!adjacent) return { data: true };

  await supabase.from("content_catalog_items").update({ sort_order: adjacent.sort_order }).eq("id", itemId);
  await supabase.from("content_catalog_items").update({ sort_order: currentOrder }).eq("id", adjacent.id);
  return { data: true };
}
