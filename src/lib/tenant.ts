import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TENANT_COOKIE } from "@/lib/constants";

export async function getCurrentTenantId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE)?.value ?? null;
}

export async function resolveTenant(userId: string): Promise<string | null> {
  // Check cookie first
  const cookieTenantId = await getCurrentTenantId();
  if (cookieTenantId) return cookieTenantId;

  // Fallback: query via user's session
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (data?.tenant_id) return data.tenant_id;

  // Last resort: use admin client (bypasses RLS)
  const admin = createAdminClient();
  const { data: adminData } = await admin
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single();

  return adminData?.tenant_id ?? null;
}
