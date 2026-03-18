import { notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Shield } from "lucide-react";
import { PolicyPermissionsEditor } from "@/components/policy-permissions-editor";
import { RolePolicyAssignment } from "@/components/role-policy-assignment";

const PAGE_SLUGS = [
  "dashboard", "users", "tenants",
  "studio.system-collections", "studio.content-catalog",
  "studio.tenant-collections", "roles", "policies",
];

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return null;

  // Check if super tenant
  const { data: tenantInfo } = await supabase
    .from("tenants")
    .select("is_super")
    .eq("id", tenantId)
    .single();

  const isSuperTenant = !!tenantInfo?.is_super;

  // Fetch role with its policies
  const { data: role } = await supabase
    .from("roles")
    .select(`
      id, name, slug, description, is_system,
      role_policies(
        policy:policies(
          id, name, description, is_system,
          policy_permissions(resource_type, resource_id, permissions)
        )
      )
    `)
    .eq("id", roleId)
    .eq("tenant_id", tenantId)
    .single();

  if (!role) notFound();

  // Fetch all policies for this tenant (for assignment)
  const { data: allPolicies } = await supabase
    .from("policies")
    .select("id, name, is_system")
    .eq("tenant_id", tenantId)
    .order("name");

  // Fetch visible collections: system collections (shared) + tenant's own collections
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, type")
    .eq("is_hidden", false)
    .or(`type.eq.system,tenant_id.eq.${tenantId}`)
    .order("name");

  const availablePages = isSuperTenant ? PAGE_SLUGS : PAGE_SLUGS.filter((p) => p !== "tenants");

  // Build assigned policy IDs set
  type PolicyShape = { id: string; name: string; description: string | null; is_system: boolean; policy_permissions: Array<{ resource_type: string; resource_id: string; permissions: Record<string, boolean> }> };
  const assignedPolicyIds = new Set(
    (role.role_policies ?? []).map((rp) => (rp.policy as unknown as PolicyShape)?.id).filter(Boolean)
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Back */}
      <Link
        href="/dashboard/roles"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Roles &amp; Policies
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
            {role.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 font-mono">{role.slug}</span>
            {role.is_system && (
              <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assigned Policies */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 text-base">Assigned Policies</CardTitle>
            <CardDescription className="text-gray-500">
              Policies granted to this role. Users with this role inherit all these permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RolePolicyAssignment
              roleId={roleId}
              allPolicies={(allPolicies ?? []).map((p) => ({ id: p.id, name: p.name, isSystem: p.is_system }))}
              assignedPolicyIds={Array.from(assignedPolicyIds)}
              isSystemRole={role.is_system}
            />
          </CardContent>
        </Card>

        {/* Per-policy permission matrix */}
        <Card className="bg-white border-gray-200 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 text-base">Effective Permissions</CardTitle>
            <CardDescription className="text-gray-500">
              Combined view of what this role can access across all its policies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {Array.from(assignedPolicyIds).length === 0 ? (
                <p className="text-gray-500 italic">No policies assigned — no access.</p>
              ) : (
                (role.role_policies ?? []).map((rp) => {
                  const policy = rp.policy as unknown as {
                    id: string; name: string; is_system: boolean;
                    policy_permissions: Array<{ resource_type: string; resource_id: string; permissions: Record<string, boolean> }>;
                  } | null;
                  if (!policy) return null;
                  const total = policy.policy_permissions?.length ?? 0;
                  return (
                    <div key={policy.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-100">
                      <span className="text-gray-900">{policy.name}</span>
                      <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
                        {total} resource{total !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-policy permission editors */}
      {(role.role_policies ?? []).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Policy Details</h2>
          {(role.role_policies ?? []).map((rp) => {
            const policy = rp.policy as unknown as {
              id: string; name: string; description: string | null; is_system: boolean;
              policy_permissions: Array<{ resource_type: string; resource_id: string; permissions: Record<string, boolean> }>;
            } | null;
            if (!policy) return null;
            return (
              <Card key={policy.id} className="bg-white border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-gray-900 text-base">{policy.name}</CardTitle>
                    {policy.is_system && (
                      <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
                    )}
                  </div>
                  {policy.description && (
                    <CardDescription className="text-gray-500">{policy.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <PolicyPermissionsEditor
                    policyId={policy.id}
                    isSystem={policy.is_system}
                    isSuperTenant={isSuperTenant}
                    initialPermissions={(policy.policy_permissions ?? []).map((pp) => ({
                      resource_type: pp.resource_type as "page" | "collection",
                      resource_id: pp.resource_id,
                      permissions: pp.permissions as Record<string, boolean>,
                    }))}
                    pages={availablePages}
                    collections={(collections ?? []).map((c) => ({
                      id: c.id,
                      name: c.name,
                      type: c.type,
                    }))}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
