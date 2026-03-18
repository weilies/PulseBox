import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Users, Activity } from "lucide-react";

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);

  let userCount: number | null = null;
  if (tenantId) {
    const { count } = await supabase
      .from("tenant_users")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    userCount = count;
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold text-gray-900 tracking-tight">
          Welcome back, {user?.user_metadata?.full_name || "there"}
        </h1>
        <p className="text-gray-500" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
          Here&apos;s your PulseBoard overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Total Users Card */}
        <div
          className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white/40 to-gray-100/20 p-6 backdrop-blur-xl overflow-hidden relative group hover:border-blue-500/40 transition-all duration-300"
          style={{
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.1)',
          }}
        >
          {/* Hover glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10">
            <div className="flex flex-row items-center justify-between mb-4">
              <h3
                className="text-sm font-semibold text-blue-500 uppercase tracking-wide"
                style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
              >
                Total Users
              </h3>
              <div
                className="p-2 rounded-lg bg-gray-100 border border-gray-200"
                style={{
                  boxShadow: '0 0 15px rgba(59, 130, 246, 0.2)',
                }}
              >
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <div
              className="text-4xl font-bold text-blue-600 mb-2"
              style={{
                fontFamily: "var(--font-geist-sans), sans-serif",
                textShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
              }}
            >
              {userCount !== null ? userCount : "—"}
            </div>
            <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Active members in this tenant
            </p>
          </div>
        </div>

        {/* System Status Card */}
        <div
          className="rounded-2xl border border-lime-400/20 bg-gradient-to-br from-white/40 to-gray-100/20 p-6 backdrop-blur-xl overflow-hidden relative group hover:border-lime-400/40 transition-all duration-300"
          style={{
            boxShadow: '0 8px 32px rgba(57, 255, 20, 0.1)',
          }}
        >
          {/* Hover glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-lime-400/0 via-lime-400/10 to-lime-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10">
            <div className="flex flex-row items-center justify-between mb-4">
              <h3
                className="text-sm font-semibold text-lime-400/80 uppercase tracking-wide"
                style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
              >
                System Status
              </h3>
              <div
                className="p-2 rounded-lg bg-lime-400/10 border border-lime-400/20"
                style={{
                  boxShadow: '0 0 15px rgba(57, 255, 20, 0.2)',
                }}
              >
                <Activity className="h-5 w-5 text-lime-400" />
              </div>
            </div>
            <div
              className="text-4xl font-bold text-lime-400 mb-2"
              style={{
                fontFamily: "var(--font-geist-sans), sans-serif",
                textShadow: '0 0 20px rgba(57, 255, 20, 0.5)',
              }}
            >
              Healthy
            </div>
            <p className="text-sm text-gray-500" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              All systems operational
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
