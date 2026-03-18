import { createClient } from "@/lib/supabase/server";

export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Returns the role slug for the user in a tenant.
 * Reads from the roles table via the role_id join.
 * Falls back to tenant_users.role text column if role_id is not yet set (pre-migration).
 */
export async function getUserRole(userId: string, tenantId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_users")
    .select("role, role_id, roles(slug)")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (!data) return null;
  // Prefer new role_id → roles.slug; fall back to legacy role text
  const rolesRaw = data.roles as unknown;
  const roleSlug = Array.isArray(rolesRaw)
    ? (rolesRaw[0] as { slug: string } | undefined)?.slug
    : (rolesRaw as { slug: string } | null)?.slug;
  return roleSlug ?? data.role ?? null;
}

export async function getUserTenants(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_users")
    .select("tenant_id, role, role_id, roles(id, name, slug), tenants(id, name, slug, is_super), is_default")
    .eq("user_id", userId)
    .eq("is_active", true);

  return data ?? [];
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_super_admin");
  return !!data;
}
