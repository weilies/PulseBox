import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { CreateRoleDialog } from "@/components/create-role-dialog";
import { RoleActions } from "@/components/role-actions";

export default async function RolesPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return null;

  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, slug, description, is_system, created_at")
    .eq("tenant_id", tenantId)
    .order("is_system", { ascending: false })
    .order("name");

  const rows = roles ?? [];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Roles
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              A role groups policies together and is assigned to users.
            </p>
          </div>
        </div>
        <CreateRoleDialog />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-gray-500">Role</TableHead>
              <TableHead className="text-gray-500">Type</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500 py-10 bg-white">
                  No roles yet. Create one to start assigning access.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((role, i) => (
                <TableRow
                  key={role.id}
                  className={`border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <TableCell>
                    <div className="font-medium text-gray-900">{role.name}</div>
                    {role.description && (
                      <div className="text-xs text-gray-500 mt-0.5">{role.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {role.is_system ? (
                      <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-500/50 text-blue-600 text-xs">Custom</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <RoleActions roleId={role.id} roleName={role.name} isSystem={role.is_system} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footnote */}
      <p className="text-xs text-gray-500">
        <strong className="text-gray-900">How roles work: </strong>
        Each user is assigned one role per tenant. A role contains one or more policies.
        System roles are managed by BIPO and cannot be deleted.
      </p>
    </div>
  );
}
