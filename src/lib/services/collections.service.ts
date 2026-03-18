import type { SupabaseClient } from "@supabase/supabase-js";
import { slugify, generateUniqueSlug } from "./slugify";
import { isSuperAdminUser } from "./permissions.service";

export async function createCollection(
  supabase: SupabaseClient,
  params: {
    name: string;
    description?: string | null;
    icon?: string | null;
    type: "system" | "tenant";
    userId: string;
    tenantId: string | null;
    skipSuperAdminCheck?: boolean;
  }
) {
  const { name, description = null, icon = null, type, userId, tenantId, skipSuperAdminCheck = false } = params;

  if (type === "system" && !skipSuperAdminCheck) {
    const ok = await isSuperAdminUser(supabase);
    if (!ok) return { error: "Only super admins can create system collections" };
  }

  const baseSlug = slugify(name);
  let slug: string;
  try {
    slug = await generateUniqueSlug(baseSlug, supabase);
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Slug generation failed" };
  }

  const { data, error } = await supabase
    .from("collections")
    .insert({ name, slug, description, icon, type, tenant_id: tenantId, created_by: userId })
    .select("slug, id")
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function updateCollection(
  supabase: SupabaseClient,
  params: { collectionId: string; name: string; description?: string | null; icon?: string | null }
) {
  const { collectionId, name, description = null, icon = null } = params;

  const { data, error } = await supabase
    .from("collections")
    .update({ name, description, icon, updated_at: new Date().toISOString() })
    .eq("id", collectionId)
    .select("slug")
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function deleteCollection(
  supabase: SupabaseClient,
  collectionId: string
) {
  const { error } = await supabase.from("collections").delete().eq("id", collectionId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function updateCollectionMetadata(
  supabase: SupabaseClient,
  collectionId: string,
  metadataUpdates: Record<string, unknown>
) {
  // Fetch current metadata and merge
  const { data: current, error: fetchErr } = await supabase
    .from("collections")
    .select("metadata")
    .eq("id", collectionId)
    .single();

  if (fetchErr) return { error: fetchErr.message };

  const merged = { ...(current?.metadata ?? {}), ...metadataUpdates };

  const { error } = await supabase
    .from("collections")
    .update({ metadata: merged, updated_at: new Date().toISOString() })
    .eq("id", collectionId);

  if (error) return { error: error.message };
  return { data: true };
}
