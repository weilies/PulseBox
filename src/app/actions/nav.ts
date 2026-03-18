"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import * as NavService from "@/lib/services/nav.service";

async function getContext() {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) throw new Error("No active tenant");
  return { user, supabase, tenantId };
}

export async function createNavFolder(formData: FormData) {
  try {
    const { user, supabase, tenantId } = await getContext();
    const name = (formData.get("name") as string)?.trim();
    const icon = (formData.get("icon") as string)?.trim() || null;
    const parentId = (formData.get("parent_id") as string) || null;
    if (!name) return { error: "Name is required" };

    const result = await NavService.createNavFolder(supabase, { tenantId, name, icon, parentId, userId: user.id });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/nav");
    return { data: result.data };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateNavFolder(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const folderId = formData.get("folder_id") as string;
    const name = (formData.get("name") as string)?.trim();
    const icon = (formData.get("icon") as string)?.trim() || null;
    if (!folderId || !name) return { error: "Folder ID and name are required" };

    const result = await NavService.updateNavFolder(supabase, { folderId, name, icon });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/nav");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deleteNavFolder(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const folderId = formData.get("folder_id") as string;
    if (!folderId) return { error: "Folder ID is required" };

    const result = await NavService.deleteNavFolder(supabase, folderId);
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/nav");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function moveNavItemAction(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const itemId = formData.get("item_id") as string;
    const newFolderId = (formData.get("folder_id") as string) || null;
    const newSortOrder = Number(formData.get("sort_order") ?? 0);
    if (!itemId) return { error: "Item ID is required" };

    const result = await NavService.moveNavItem(supabase, { itemId, newFolderId, newSortOrder });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/nav");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function moveNavFolderAction(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const folderId = formData.get("folder_id") as string;
    const newParentId = (formData.get("parent_id") as string) || null;
    const newSortOrder = Number(formData.get("sort_order") ?? 0);
    if (!folderId) return { error: "Folder ID is required" };

    const result = await NavService.moveNavFolder(supabase, { folderId, newParentId, newSortOrder });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/nav");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function addNavItem(formData: FormData) {
  try {
    const { supabase, tenantId } = await getContext();
    const resourceType = formData.get("resource_type") as "page" | "collection";
    const resourceId = formData.get("resource_id") as string;
    const folderId = (formData.get("folder_id") as string) || null;
    const label = (formData.get("label") as string)?.trim() || null;
    if (!resourceType || !resourceId) return { error: "resource_type and resource_id are required" };

    const result = await NavService.upsertNavItem(supabase, { tenantId, resourceType, resourceId, label, folderId });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/nav");
    revalidatePath("/dashboard", "layout");
    return { data: result.data };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function removeNavItem(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const itemId = formData.get("item_id") as string;
    if (!itemId) return { error: "Item ID is required" };

    const result = await NavService.deleteNavItem(supabase, itemId);
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/nav");
    revalidatePath("/dashboard", "layout");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
