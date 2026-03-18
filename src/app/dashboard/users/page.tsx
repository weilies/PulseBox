import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { CreateUserDialog } from "@/components/create-user-dialog";
import { AssignUserDialog } from "@/components/assign-user-dialog";
import { MemberActions } from "@/components/member-actions";
import { TenantSwitcher } from "@/components/tenant-switcher";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: superAdminCheck } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "super_admin")
    .limit(1)
    .single();

  const isSuperAdmin = !!superAdminCheck;

  const resolvedParams = await searchParams;
  const tenantId = (isSuperAdmin && resolvedParams.tenant)
    ? resolvedParams.tenant
    : await resolveTenant(user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let members: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allTenants: any[] = [];
  let isSuperTenant = false;

  if (user && tenantId) {
    if (isSuperAdmin) {
      const { data: tenants } = await supabase.from("tenants").select("id, name, slug, is_super");
      allTenants = tenants || [];
    }

    const { data: tenantData } = await supabase
      .from("tenants")
      .select("is_super")
      .eq("id", tenantId)
      .single();
    isSuperTenant = tenantData?.is_super ?? false;

    const { data } = await supabase
      .from("tenant_users")
      .select("user_id, role, is_active, profiles(email, full_name)")
      .eq("tenant_id", tenantId);
    members = data ?? [];
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Users
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isSuperAdmin ? "Platform administration — manage users across tenants." : "Manage users in your organization."}
            </p>
          </div>
        </div>
        {tenantId && (
          <div className="flex flex-wrap gap-2">
            {isSuperAdmin && (
              <TenantSwitcher
                tenants={allTenants.map((t: { id: string; name: string; slug: string; is_super: boolean }) => ({ tenant_id: t.id, tenants: t }))}
                currentTenantId={tenantId}
              />
            )}
            <AssignUserDialog tenantId={tenantId} isSuperTenant={isSuperTenant} />
            <CreateUserDialog tenantId={tenantId} isSuperTenant={isSuperTenant} />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-gray-500">Name</TableHead>
              <TableHead className="text-gray-500">Email</TableHead>
              <TableHead className="text-gray-500">Role</TableHead>
              <TableHead className="text-gray-500">Status</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-10 bg-white">
                  No members found.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m, i) => (
                <TableRow
                  key={m.user_id}
                  className={`border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <TableCell className="text-gray-900 font-medium">{m.profiles?.full_name || "—"}</TableCell>
                  <TableCell className="text-gray-500">{m.profiles?.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-blue-500/40 text-blue-600 text-xs">{m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={m.is_active
                        ? "border-green-500/40 text-green-400 text-xs"
                        : "border-zinc-600 text-gray-500 text-xs"}
                    >
                      {m.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {tenantId && (
                      <MemberActions
                        userId={m.user_id}
                        tenantId={tenantId}
                        currentRole={m.role}
                        fullName={m.profiles?.full_name || ""}
                        email={m.profiles?.email || ""}
                        isActive={m.is_active}
                        isSuperAdmin={isSuperAdmin}
                        isSuperTenant={isSuperTenant}
                        allTenants={allTenants}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-500">
        <strong className="text-gray-900">Note: </strong>
        Each user belongs to one or more tenants with an assigned role. Roles control what pages and data the user can access.
      </p>
    </div>
  );
}
