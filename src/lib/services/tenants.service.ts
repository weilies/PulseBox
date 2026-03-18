import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createTenant(
  supabase: SupabaseClient,
  params: { name: string; slug: string; userId: string; tenantAdminRoleId?: string; contactName?: string; contactEmail?: string }
) {
  const { name, slug, userId, tenantAdminRoleId, contactName, contactEmail } = params;

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .insert([{ name, slug, contact_name: contactName || null, contact_email: contactEmail || null }])
    .select("id")
    .single();
  if (tenantError) return { error: tenantError.message };

  // Assign creator as tenant_admin using admin client (bypasses RLS)
  const admin = createAdminClient();

  // If tenantAdminRoleId is provided (after Phase 2 migration), use it
  // Otherwise fall back to the old role text column
  const insertPayload = tenantAdminRoleId
    ? { tenant_id: tenantData.id, user_id: userId, role_id: tenantAdminRoleId, is_active: true, is_default: false }
    : { tenant_id: tenantData.id, user_id: userId, role: "tenant_admin", is_active: true, is_default: false };

  const { error: assignError } = await admin.from("tenant_users").insert([insertPayload]);
  if (assignError) return { error: `Tenant created but could not assign creator: ${assignError.message}` };

  return { data: tenantData };
}

export async function updateTenant(
  supabase: SupabaseClient,
  params: { tenantId: string; name: string; slug: string; contactName?: string; contactEmail?: string; timezone?: string }
) {
  const { tenantId, name, slug, contactName, contactEmail, timezone } = params;
  const { data, error } = await supabase
    .from("tenants")
    .update({
      name,
      slug,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      timezone: timezone || "Asia/Singapore",
    })
    .eq("id", tenantId);
  if (error) return { error: error.message };
  return { data };
}

export async function deleteTenant(supabase: SupabaseClient, tenantId: string) {
  const admin = createAdminClient();

  // 1. Find all users in this tenant
  const { data: tenantUsers, error: fetchError } = await admin
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId);
  if (fetchError) return { error: fetchError.message };

  const userIds = (tenantUsers ?? []).map((r: { user_id: string }) => r.user_id);

  // 2. For each user, check if they belong to any OTHER tenant
  const usersToDelete: string[] = [];
  for (const userId of userIds) {
    const { count } = await admin
      .from("tenant_users")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("tenant_id", tenantId);
    if ((count ?? 0) === 0) {
      usersToDelete.push(userId);
    }
  }

  // 3. Delete the tenant (cascades tenant_users via FK)
  const { error: deleteError } = await supabase
    .from("tenants")
    .delete()
    .eq("id", tenantId);
  if (deleteError) return { error: deleteError.message };

  // 4. Hard-delete users who were only in this tenant
  for (const userId of usersToDelete) {
    await admin.auth.admin.deleteUser(userId);
  }

  return { data: true };
}

export async function setDefaultTenant(
  supabase: SupabaseClient,
  params: { userId: string; tenantId: string }
) {
  const { userId, tenantId } = params;
  await supabase.from("tenant_users").update({ is_default: false }).eq("user_id", userId);
  const { data, error } = await supabase
    .from("tenant_users")
    .update({ is_default: true })
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };
  return { data };
}
