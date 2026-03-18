"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import * as RolesService from "@/lib/services/roles.service";

async function getContext() {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) throw new Error("No active tenant");
  return { user, supabase, tenantId };
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function createRole(formData: FormData) {
  try {
    const { user, supabase, tenantId } = await getContext();
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    if (!name) return { error: "Name is required" };

    const result = await RolesService.createRole(supabase, { tenantId, name, description, userId: user.id });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: result.data };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updateRole(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const roleId = formData.get("role_id") as string;
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    if (!roleId || !name) return { error: "Role ID and name are required" };

    const result = await RolesService.updateRole(supabase, { roleId, name, description });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: result.data };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deleteRole(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const roleId = formData.get("role_id") as string;
    if (!roleId) return { error: "Role ID is required" };

    const result = await RolesService.deleteRole(supabase, roleId);
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function assignPolicyToRole(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const roleId = formData.get("role_id") as string;
    const policyId = formData.get("policy_id") as string;
    if (!roleId || !policyId) return { error: "Role ID and policy ID are required" };

    const result = await RolesService.assignPolicyToRole(supabase, { roleId, policyId });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function removePolicyFromRole(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const roleId = formData.get("role_id") as string;
    const policyId = formData.get("policy_id") as string;
    if (!roleId || !policyId) return { error: "Role ID and policy ID are required" };

    const result = await RolesService.removePolicyFromRole(supabase, { roleId, policyId });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export async function createPolicy(formData: FormData) {
  try {
    const { user, supabase, tenantId } = await getContext();
    const name = (formData.get("name") as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const permissionsRaw = formData.get("permissions") as string;
    if (!name) return { error: "Name is required" };

    let permissions: Array<{ resource_type: "page" | "collection"; resource_id: string; permissions: Record<string, boolean> }> = [];
    try { permissions = permissionsRaw ? JSON.parse(permissionsRaw) : []; }
    catch { return { error: "Invalid permissions format" }; }

    const result = await RolesService.createPolicy(supabase, { tenantId, name, description, userId: user.id, permissions });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: result.data };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function updatePolicyPermissions(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const policyId = formData.get("policy_id") as string;
    const permissionsRaw = formData.get("permissions") as string;
    if (!policyId) return { error: "Policy ID is required" };

    let permissions: Array<{ resource_type: "page" | "collection"; resource_id: string; permissions: Record<string, boolean> }> = [];
    try { permissions = permissionsRaw ? JSON.parse(permissionsRaw) : []; }
    catch { return { error: "Invalid permissions format" }; }

    const result = await RolesService.updatePolicyPermissions(supabase, { policyId, permissions });
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deletePolicy(formData: FormData) {
  try {
    const { supabase } = await getContext();
    const policyId = formData.get("policy_id") as string;
    if (!policyId) return { error: "Policy ID is required" };

    const result = await RolesService.deletePolicy(supabase, policyId);
    if (result.error) return { error: result.error };
    revalidatePath("/dashboard/roles");
    return { data: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
