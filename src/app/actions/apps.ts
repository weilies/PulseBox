"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant, getCurrentTenantId } from "@/lib/tenant";
import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a prefixed random ID: pb_app_<16 hex chars> */
function generateAppId(): string {
  return `pb_app_${randomBytes(8).toString("hex")}`;
}

/** Generate a prefixed random secret: pb_sec_<32 hex chars> */
function generateAppSecret(): string {
  return `pb_sec_${randomBytes(16).toString("hex")}`;
}

/** SHA-256 hash of a secret */
function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

async function requireAdmin() {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" as const };

  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return { error: "No active tenant" as const };

  const role = await getUserRole(user.id, tenantId);
  if (!role || !["super_admin", "tenant_admin"].includes(role)) {
    return { error: "Insufficient permissions" as const };
  }

  return { user, tenantId, role };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getApps() {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error, data: [] };

  const db = createAdminClient();
  const { data, error } = await db
    .from("tenant_apps")
    .select("id, app_name, app_id, is_active, created_at, last_used_at, expires_at")
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, data: [] };
  return { data: data ?? [] };
}

export async function createApp(formData: FormData) {
  const appName = formData.get("appName") as string;
  if (!appName?.trim()) return { error: "App name is required" };

  const expiresAt = formData.get("expiresAt") as string | null;

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const appId = generateAppId();
  const appSecret = generateAppSecret();
  const secretHash = hashSecret(appSecret);

  const db = createAdminClient();
  const { error } = await db.from("tenant_apps").insert({
    tenant_id: auth.tenantId,
    app_name: appName.trim(),
    app_id: appId,
    app_secret_hash: secretHash,
    created_by: auth.user.id,
    expires_at: expiresAt || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/apps");

  // Return the secret — this is the ONLY time it's visible
  return { appId, appSecret };
}

export async function rotateAppSecret(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { error: "App ID is required" };

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const newSecret = generateAppSecret();
  const secretHash = hashSecret(newSecret);

  const db = createAdminClient();
  const { error } = await db
    .from("tenant_apps")
    .update({ app_secret_hash: secretHash })
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/apps");

  // Return the new secret — only time it's visible
  return { appSecret: newSecret };
}

export async function toggleApp(formData: FormData) {
  const id = formData.get("id") as string;
  const isActive = formData.get("isActive") === "true";
  if (!id) return { error: "App ID is required" };

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const db = createAdminClient();
  const { error } = await db
    .from("tenant_apps")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/apps");
  return {};
}

export async function deleteApp(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { error: "App ID is required" };

  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error };

  const db = createAdminClient();
  const { error } = await db
    .from("tenant_apps")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/apps");
  return {};
}

// ===========================================================================
// App Bundle Model — install / disable
// ===========================================================================

interface BundleCollection { slug: string; name: string; type?: string; description?: string; metadata?: Record<string, unknown>; }
interface BundleField { collection_slug: string; slug: string; name: string; field_type: string; required?: boolean; options?: Record<string, unknown>; }
interface BundleCatalog { slug: string; name: string; items: string[]; }
interface BundleNavFolder { slug: string; name: string; icon?: string; sort_order?: number; }
interface BundleNavItem { folder_slug?: string; collection_slug: string; label: string; icon?: string; sort_order?: number; }
interface BundlePolicy { name: string; permissions: Array<{ resource_type: string; resource_slug: string; read?: boolean; create?: boolean; update?: boolean; delete?: boolean; }>; }
interface AppBundle { collections?: BundleCollection[]; fields?: BundleField[]; content_catalogs?: BundleCatalog[]; nav_folders?: BundleNavFolder[]; nav_items?: BundleNavItem[]; default_policies?: BundlePolicy[]; }

export async function installApp(appId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const db = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = await getCurrentTenantId();
  if (!tenantId) return { error: "No tenant context" };

  const { data: app } = await db
    .from("apps")
    .select("id, slug, name, bundle, status")
    .eq("id", appId)
    .maybeSingle();

  if (!app) return { error: "App not found" };
  if (app.status !== "published") return { error: "App is not available for installation" };

  const { data: existing } = await db
    .from("app_installs")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("app_id", appId)
    .maybeSingle();

  if (existing?.status === "active") return { error: "App is already installed" };

  if (existing?.status === "disabled") {
    await db.from("app_installs").update({ status: "active" }).eq("id", existing.id);
    revalidatePath("/dashboard/studio/app-store");
    return {};
  }

  const bundle = (app.bundle ?? {}) as AppBundle;

  // 1. Collections
  for (const col of bundle.collections ?? []) {
    const { data: existingCol } = await db.from("collections").select("id").eq("slug", col.slug).maybeSingle();
    if (!existingCol) {
      await db.from("collections").insert({
        slug: col.slug, name: col.name,
        type: col.type ?? "system", description: col.description ?? null,
        metadata: col.metadata ?? {}, app_id: appId,
        tenant_id: col.type === "tenant" ? tenantId : null,
      });
    }
  }

  // 2. Fields
  for (const field of bundle.fields ?? []) {
    const { data: col } = await db.from("collections").select("id").eq("slug", field.collection_slug).maybeSingle();
    if (!col) continue;
    const { data: existingField } = await db.from("collection_fields").select("id").eq("collection_id", col.id).eq("slug", field.slug).maybeSingle();
    if (!existingField) {
      await db.from("collection_fields").insert({
        collection_id: col.id, slug: field.slug, name: field.name,
        field_type: field.field_type, is_required: field.required ?? false, options: field.options ?? {},
      });
    }
  }

  // 3. Content catalogs
  for (const catalog of bundle.content_catalogs ?? []) {
    const { data: existingCat } = await db.from("content_catalogs").select("id").eq("slug", catalog.slug).maybeSingle();
    let catalogId = existingCat?.id;
    if (!catalogId) {
      const { data: created } = await db.from("content_catalogs").insert({ slug: catalog.slug, name: catalog.name }).select("id").single();
      catalogId = created?.id;
    }
    if (catalogId) {
      for (const item of catalog.items ?? []) {
        await db.from("content_catalog_items").upsert(
          { catalog_id: catalogId, label: item, value: item.toLowerCase().replace(/\s+/g, "_") },
          { onConflict: "catalog_id,value" }
        );
      }
    }
  }

  // 4. Nav folders
  for (const folder of bundle.nav_folders ?? []) {
    await db.from("nav_folders").upsert(
      { slug: folder.slug, name: folder.name, icon: folder.icon ?? null, tenant_id: tenantId, sort_order: folder.sort_order ?? 10 },
      { onConflict: "slug,tenant_id" }
    );
  }

  // 5. Nav items
  for (const navItem of bundle.nav_items ?? []) {
    const { data: col } = await db.from("collections").select("id").eq("slug", navItem.collection_slug).maybeSingle();
    if (!col) continue;
    let folderId: string | null = null;
    if (navItem.folder_slug) {
      const { data: folder } = await db.from("nav_folders").select("id").eq("slug", navItem.folder_slug).eq("tenant_id", tenantId).maybeSingle();
      folderId = folder?.id ?? null;
    }
    await db.from("nav_items").upsert(
      { tenant_id: tenantId, collection_id: col.id, folder_id: folderId, label: navItem.label, icon: navItem.icon ?? null, sort_order: navItem.sort_order ?? 10 },
      { onConflict: "tenant_id,collection_id" }
    );
  }

  // 6. Default policies
  for (const policy of bundle.default_policies ?? []) {
    const { data: existingRole } = await db.from("roles").select("id").eq("tenant_id", tenantId).eq("name", policy.name).maybeSingle();
    if (!existingRole) {
      const { data: newRole } = await db.from("roles").insert({ tenant_id: tenantId, name: policy.name, description: `Installed by ${app.name}` }).select("id").single();
      if (newRole) {
        for (const perm of policy.permissions ?? []) {
          await db.from("role_permissions").insert({
            role_id: newRole.id, resource_type: perm.resource_type, resource_slug: perm.resource_slug,
            can_read: perm.read ?? false, can_create: perm.create ?? false, can_update: perm.update ?? false, can_delete: perm.delete ?? false,
          });
        }
      }
    }
  }

  await db.from("app_installs").insert({ tenant_id: tenantId, app_id: appId, installed_by: user.id, status: "active" });
  revalidatePath("/dashboard/studio/app-store");
  return {};
}

export async function disableApp(appId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const db = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = await getCurrentTenantId();
  if (!tenantId) return { error: "No tenant context" };

  const { error } = await db.from("app_installs").update({ status: "disabled" }).eq("tenant_id", tenantId).eq("app_id", appId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/studio/app-store");
  return {};
}
