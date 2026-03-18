import { notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileKey } from "lucide-react";
import { PolicyPermissionsEditor } from "@/components/policy-permissions-editor";

const PAGE_SLUGS = [
  "dashboard", "users", "tenants",
  "studio.system-collections", "studio.content-catalog",
  "studio.tenant-collections", "roles", "policies",
];

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return null;

  const { data: tenantInfo } = await supabase
    .from("tenants")
    .select("is_super")
    .eq("id", tenantId)
    .single();

  const isSuperTenant = !!tenantInfo?.is_super;

  const { data: policy } = await supabase
    .from("policies")
    .select("id, name, description, is_system, policy_permissions(resource_type, resource_id, permissions)")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!policy) notFound();

  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, type")
    .eq("is_hidden", false)
    .or(`type.eq.system,tenant_id.eq.${tenantId}`)
    .order("name");

  const availablePages = isSuperTenant
    ? PAGE_SLUGS
    : PAGE_SLUGS.filter((p) => p !== "tenants");

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Back */}
      <Link
        href="/dashboard/policies"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Policies
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <FileKey className="h-6 w-6 text-blue-600" />
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
            >
              {policy.name}
            </h1>
            {policy.is_system ? (
              <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
            ) : (
              <Badge variant="outline" className="border-blue-500/50 text-blue-600 text-xs">Custom</Badge>
            )}
          </div>
          {policy.description && (
            <p className="text-sm text-gray-500 mt-0.5">{policy.description}</p>
          )}
        </div>
      </div>

      {/* Permissions Editor */}
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
    </div>
  );
}
