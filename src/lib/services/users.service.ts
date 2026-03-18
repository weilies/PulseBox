import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPER_TENANT_SLUG } from "@/lib/constants";

export async function createUser(params: {
  email: string;
  fullName: string;
  password: string;
  tenantId: string;
  roleId: string;
}) {
  const { email, fullName, password, tenantId, roleId } = params;
  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError) return { error: authError.message };

  const { error: assignError } = await admin.from("tenant_users").insert([
    { tenant_id: tenantId, user_id: authData.user.id, role_id: roleId, is_active: true, is_default: false },
  ]);
  if (assignError) return { error: `User created but tenant assignment failed: ${assignError.message}` };

  // Clean up auto-assigned super tenant membership if target tenant is not the super tenant
  const { data: superTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", SUPER_TENANT_SLUG)
    .single();

  if (superTenant && superTenant.id !== tenantId) {
    await admin
      .from("tenant_users")
      .delete()
      .eq("user_id", authData.user.id)
      .eq("tenant_id", superTenant.id);
  }

  return { data: authData };
}

export async function updateUserProfile(
  supabase: SupabaseClient,
  params: { userId: string; fullName: string }
) {
  const { userId, fullName } = params;
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { data };
}

export async function assignUserToTenant(
  supabase: SupabaseClient,
  params: { email: string; tenantId: string; roleId: string }
) {
  const { email, tenantId, roleId } = params;

  const { data: userData, error: userError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (userError || !userData) return { error: "User not found" };

  const { data, error } = await supabase.from("tenant_users").insert([
    { user_id: userData.id, tenant_id: tenantId, role_id: roleId, is_active: true },
  ]);
  if (error) return { error: error.message };
  return { data };
}

export async function updateUserRole(
  supabase: SupabaseClient,
  params: { userId: string; tenantId: string; roleId: string }
) {
  const { userId, tenantId, roleId } = params;
  const { data, error } = await supabase
    .from("tenant_users")
    .update({ role_id: roleId })
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };
  return { data };
}

export async function removeUserFromTenant(
  supabase: SupabaseClient,
  params: { userId: string; tenantId: string }
) {
  const { userId, tenantId } = params;
  const { data, error } = await supabase
    .from("tenant_users")
    .delete()
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };
  return { data };
}

export async function deleteUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return { data };
}
