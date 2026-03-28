import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { Store } from "lucide-react";
import { AppStoreClient } from "./app-store-client";

export default async function AppStorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return null;

  const role = await getUserRole(user.id, tenantId);
  const db = createAdminClient();

  // Fetch published apps
  const { data: apps } = await db
    .from("apps")
    .select("id, slug, name, description, version, category, icon, is_system, status")
    .eq("status", "published")
    .order("category")
    .order("name");

  // Fetch this tenant's installs
  const { data: installs } = await db
    .from("app_installs")
    .select("app_id, status")
    .eq("tenant_id", tenantId);

  const installMap = new Map((installs ?? []).map((i) => [i.app_id, i.status as string]));

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              App Store
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Browse and install platform apps</p>
          </div>
        </div>
      </div>

      {/* App grid */}
      <AppStoreClient
        apps={(apps ?? []).map((a) => ({
          ...a,
          installStatus: installMap.get(a.id) ?? null,
        }))}
        isSuperAdmin={role === "super_admin"}
      />

      <p className="text-xs text-gray-500">
        Apps are built and maintained by Next Novas. Installing an app seeds data structures and navigation — it never modifies existing data.
      </p>
    </div>
  );
}
