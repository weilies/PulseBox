"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import * as CatalogService from "@/lib/services/content-catalog.service";

export async function createCatalog(formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  if (!name) return { error: "Name is required" };

  const supabase = await createClient();
  try {
    const result = await CatalogService.createCatalog(supabase, { name, description });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/studio/content-catalog");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function updateCatalog(formData: FormData) {
  const catalogId = formData.get("catalog_id") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  if (!catalogId || !name) return { error: "ID and name are required" };

  const supabase = await createClient();
  try {
    const result = await CatalogService.updateCatalog(supabase, { catalogId, name, description });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/studio/content-catalog");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function deleteCatalog(formData: FormData) {
  const catalogId = formData.get("catalog_id") as string;
  if (!catalogId) return { error: "Catalog ID is required" };

  const supabase = await createClient();
  try {
    const result = await CatalogService.deleteCatalog(supabase, catalogId);
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/studio/content-catalog");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function createCatalogItem(formData: FormData) {
  const catalogId = formData.get("catalog_id") as string;
  const catalogSlug = formData.get("catalog_slug") as string;
  const label = (formData.get("label") as string)?.trim();
  const value = (formData.get("value") as string)?.trim();
  if (!catalogId || !label || !value) return { error: "Catalog, label and value are required" };

  const supabase = await createClient();
  try {
    const result = await CatalogService.createCatalogItem(supabase, { catalogId, label, value });
    if (result.error) return { error: result.error };
    revalidatePath(`/dashboard/studio/content-catalog/${catalogSlug}`);
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function updateCatalogItem(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const catalogSlug = formData.get("catalog_slug") as string;
  const label = (formData.get("label") as string)?.trim();
  const value = (formData.get("value") as string)?.trim();
  const isActive = formData.get("is_active") !== "false";
  if (!itemId || !label || !value) return { error: "Item ID, label and value are required" };

  const supabase = await createClient();
  try {
    const result = await CatalogService.updateCatalogItem(supabase, { itemId, label, value, isActive });
    if (result.error) return { error: result.error };
    revalidatePath(`/dashboard/studio/content-catalog/${catalogSlug}`);
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function deleteCatalogItem(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const catalogSlug = formData.get("catalog_slug") as string;
  if (!itemId) return { error: "Item ID is required" };

  const supabase = await createClient();
  try {
    const result = await CatalogService.deleteCatalogItem(supabase, itemId);
    if (result.error) return { error: result.error };
    revalidatePath(`/dashboard/studio/content-catalog/${catalogSlug}`);
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}

export async function moveCatalogItem(formData: FormData) {
  const itemId = formData.get("item_id") as string;
  const direction = formData.get("direction") as "up" | "down";
  const currentOrder = Number(formData.get("sort_order"));
  const catalogId = formData.get("catalog_id") as string;
  const catalogSlug = formData.get("catalog_slug") as string;
  if (!itemId || !direction || !catalogId) return { error: "Missing required params" };

  const supabase = await createClient();
  try {
    await CatalogService.moveCatalogItem(supabase, { itemId, direction, currentOrder, catalogId });
    revalidatePath(`/dashboard/studio/content-catalog/${catalogSlug}`);
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
}
