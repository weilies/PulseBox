"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";

export type RelationItem = {
  id: string;
  label: string;
};

const LABEL_KEYS = ["name", "title", "label", "full_name", "display_name", "code", "slug"];

function deriveLabel(data: Record<string, unknown>, id: string): string {
  for (const key of LABEL_KEYS) {
    const val = data[key];
    if (val && typeof val === "string" && val.trim()) return val.trim();
  }
  // Fallback: first string value found
  for (const val of Object.values(data)) {
    if (val && typeof val === "string" && val.trim()) return val.trim().slice(0, 60);
  }
  return id.slice(0, 8);
}

/**
 * Fetch items from a related collection for the relation picker.
 * Returns a flat list of { id, label } — at most 200 items.
 */
export async function fetchRelationItems(
  relatedCollectionId: string
): Promise<{ data?: RelationItem[]; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);

  // Resolve collection to check tenant ownership
  const { data: collection } = await supabase
    .from("collections")
    .select("id, type, tenant_id")
    .eq("id", relatedCollectionId)
    .maybeSingle();

  if (!collection) return { error: "Related collection not found" };

  let query = supabase
    .from("collection_items")
    .select("id, data")
    .eq("collection_id", relatedCollectionId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (collection.type === "tenant" && tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data: items, error } = await query;
  if (error) return { error: error.message };

  const result: RelationItem[] = (items ?? []).map((item) => ({
    id: item.id,
    label: deriveLabel(item.data as Record<string, unknown>, item.id),
  }));

  return { data: result };
}
