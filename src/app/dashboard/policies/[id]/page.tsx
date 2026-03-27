import { notFound } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileKey } from "lucide-react";
import { PolicyPermissionsEditor } from "@/components/policy-permissions-editor";
import { DeletePolicyButton } from "@/components/delete-policy-button";
import { ALL_PAGE_SLUGS } from "@/lib/services/permissions.service";

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

 const [{ data: tenantInfo }, { data: policy }, { data: collections }] = await Promise.all([
  supabase.from("tenants").select("is_super").eq("id", tenantId).single(),
  supabase.from("policies").select("id, name, description, is_system, policy_permissions(resource_type, resource_id, permissions)").eq("id", id).eq("tenant_id", tenantId).single(),
  supabase.from("collections").select("id, name, type").eq("is_hidden", false).or(`type.eq.system,tenant_id.eq.${tenantId}`).order("name"),
 ]);

 const isSuperTenant = !!tenantInfo?.is_super;
 if (!policy) notFound();

 const availablePages = isSuperTenant
  ? ALL_PAGE_SLUGS
  : ALL_PAGE_SLUGS.filter((p) => p !== "tenants");

 return (
 <div className="p-6 space-y-6 max-w-4xl">
 {/* Back */}
 <Link
 href="/dashboard/policies"
 className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 transition-colors"
 >
 <ArrowLeft className="h-4 w-4" />
 Back to Policies
 </Link>

 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <FileKey className="h-6 w-6 text-blue-600 dark:text-blue-400" />
 <div>
 <div className="flex items-center gap-2">
 <h1
 className="text-xl font-bold text-gray-900 dark:text-gray-100"
 style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
 >
 {policy.name}
 </h1>
 {policy.is_system ? (
 <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
 ) : (
 <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400 text-xs">Custom</Badge>
 )}
 </div>
 {policy.description && (
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{policy.description}</p>
 )}
 </div>
 </div>
 {!policy.is_system && (
 <DeletePolicyButton policyId={policy.id} policyName={policy.name} />
 )}
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