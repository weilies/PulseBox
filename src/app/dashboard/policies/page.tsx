import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileKey } from "lucide-react";
import { CreatePolicyDialog } from "@/components/create-policy-dialog";
import { PolicyActions } from "@/components/policy-actions";

export default async function PoliciesPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return null;

  const { data: policies } = await supabase
    .from("policies")
    .select(`
      id, name, description, is_system, created_at,
      policy_permissions(resource_type, resource_id, permissions)
    `)
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name");

  const rows = policies ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileKey className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Policies
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Each policy defines a named set of permissions across pages and collections.
            </p>
          </div>
        </div>
        <CreatePolicyDialog />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-gray-500">Policy</TableHead>
              <TableHead className="text-gray-500">Permissions</TableHead>
              <TableHead className="text-gray-500">Type</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-10 bg-white">
                  No policies yet. Create one to define access rules.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((policy, i) => {
                const permCount = policy.policy_permissions?.length ?? 0;
                return (
                  <TableRow
                    key={policy.id}
                    className={`border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <TableCell>
                      <div className="font-medium text-gray-900">{policy.name}</div>
                      {policy.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{policy.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
                        {permCount} resource{permCount !== 1 ? "s" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {policy.is_system ? (
                        <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
                      ) : (
                        <Badge variant="outline" className="border-blue-500/50 text-blue-600 text-xs">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <PolicyActions policyId={policy.id} policyName={policy.name} isSystem={policy.is_system} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footnote */}
      <p className="text-xs text-gray-500">
        <strong className="text-gray-900">How policies work: </strong>
        A policy grants permissions to specific pages or collections. Assign policies to roles, then assign roles to users.
        System policies are managed by BIPO and cannot be deleted.
      </p>
    </div>
  );
}
