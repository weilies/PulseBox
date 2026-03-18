import type { SupabaseClient } from "@supabase/supabase-js";

export type NavFolder = {
  id: string;
  name: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  children?: NavFolder[];
  items?: NavItem[];
};

export type NavItem = {
  id: string;
  resource_type: "page" | "collection";
  resource_id: string;
  label: string | null;
  icon: string | null;
  folder_id: string | null;
  sort_order: number;
};

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function getNavStructure(supabase: SupabaseClient, tenantId: string) {
  const [foldersResult, itemsResult] = await Promise.all([
    supabase
      .from("nav_folders")
      .select("id, name, icon, parent_id, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase
      .from("nav_items")
      .select("id, resource_type, resource_id, label, icon, folder_id, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
  ]);

  if (foldersResult.error) return { error: foldersResult.error.message };
  if (itemsResult.error) return { error: itemsResult.error.message };

  return {
    data: {
      folders: (foldersResult.data ?? []) as NavFolder[],
      items: (itemsResult.data ?? []) as NavItem[],
    },
  };
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function createNavFolder(
  supabase: SupabaseClient,
  params: { tenantId: string; name: string; icon?: string | null; parentId?: string | null; userId: string }
) {
  const { tenantId, name, icon = null, parentId = null, userId } = params;

  const { data: last } = await supabase
    .from("nav_folders")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .eq("parent_id", parentId ?? null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("nav_folders")
    .insert({ tenant_id: tenantId, name, icon, parent_id: parentId, sort_order: sortOrder, created_by: userId })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  return { data };
}

export async function updateNavFolder(
  supabase: SupabaseClient,
  params: { folderId: string; name: string; icon?: string | null }
) {
  const { folderId, name, icon = null } = params;
  const { error } = await supabase
    .from("nav_folders")
    .update({ name, icon })
    .eq("id", folderId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function deleteNavFolder(supabase: SupabaseClient, folderId: string) {
  // Children items will be set to folder_id = NULL (SET NULL cascade on nav_items.folder_id)
  const { error } = await supabase.from("nav_folders").delete().eq("id", folderId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function moveNavFolder(
  supabase: SupabaseClient,
  params: { folderId: string; newParentId: string | null; newSortOrder: number }
) {
  const { folderId, newParentId, newSortOrder } = params;
  const { error } = await supabase
    .from("nav_folders")
    .update({ parent_id: newParentId, sort_order: newSortOrder })
    .eq("id", folderId);
  if (error) return { error: error.message };
  return { data: true };
}

// ---------------------------------------------------------------------------
// Nav Items
// ---------------------------------------------------------------------------

export async function upsertNavItem(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    resourceType: "page" | "collection";
    resourceId: string;
    label?: string | null;
    icon?: string | null;
    folderId?: string | null;
    sortOrder?: number;
  }
) {
  const { tenantId, resourceType, resourceId, label = null, icon = null, folderId = null, sortOrder = 0 } = params;

  const { data, error } = await supabase
    .from("nav_items")
    .upsert(
      {
        tenant_id: tenantId,
        resource_type: resourceType,
        resource_id: resourceId,
        label,
        icon,
        folder_id: folderId,
        sort_order: sortOrder,
      },
      { onConflict: "tenant_id,resource_type,resource_id" }
    )
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { data };
}

export async function moveNavItem(
  supabase: SupabaseClient,
  params: { itemId: string; newFolderId: string | null; newSortOrder: number }
) {
  const { itemId, newFolderId, newSortOrder } = params;
  const { error } = await supabase
    .from("nav_items")
    .update({ folder_id: newFolderId, sort_order: newSortOrder })
    .eq("id", itemId);
  if (error) return { error: error.message };
  return { data: true };
}

export async function deleteNavItem(supabase: SupabaseClient, itemId: string) {
  const { error } = await supabase.from("nav_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  return { data: true };
}

/**
 * Build a tree structure from flat folders + items arrays.
 * Returns root-level folders and items (those with no parent_id / folder_id).
 */
export function buildNavTree(folders: NavFolder[], items: NavItem[]) {
  const folderMap = new Map<string, NavFolder>();
  for (const f of folders) {
    folderMap.set(f.id, { ...f, children: [], items: [] });
  }

  // Attach items to their folder
  const rootItems: NavItem[] = [];
  for (const item of items) {
    if (item.folder_id && folderMap.has(item.folder_id)) {
      folderMap.get(item.folder_id)!.items!.push(item);
    } else {
      rootItems.push(item);
    }
  }

  // Build folder tree (unlimited nesting)
  const rootFolders: NavFolder[] = [];
  for (const folder of folderMap.values()) {
    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      folderMap.get(folder.parent_id)!.children!.push(folder);
    } else {
      rootFolders.push(folder);
    }
  }

  // Sort by sort_order
  const sortByOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;
  rootFolders.sort(sortByOrder);
  rootItems.sort(sortByOrder);

  return { rootFolders, rootItems };
}
