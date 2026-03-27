import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { CreateRoleDialog } from "@/components/create-role-dialog";
import { RoleActions } from "@/components/role-actions";
import Link from "next/link";
import { PAGE_SIZE, buildGridParams, type GridConfig } from "@/lib/data-grid";
import { SortableHead } from "@/components/sortable-head";
import { TablePagination } from "@/components/table-pagination";
import { TableFilters, type FilterColumn } from "@/components/table-filters";
import { Suspense } from "react";

const gridConfig: GridConfig = {
 sortable: [
  { field: "name", defaultDir: "asc" },
 ],
 filterable: ["name"],
};

const filterColumns: FilterColumn[] = [
 { key: "name", type: "text", placeholder: "Filter role..." },
 { key: "_policies", type: "none" },
 { key: "_type", type: "none" },
 { key: "_actions", type: "none" },
];

export default async function RolesPage({
 searchParams,
}: {
 searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
 const user = await getUser();
 if (!user) return null;

 const sp = await searchParams;
 const { page, sortCol, ascending, filters } = buildGridParams(sp as Record<string, string | string[] | undefined>, gridConfig);
 const dirLabel = ascending ? "asc" : "desc" as const;

 const supabase = await createClient();
 const tenantId = await resolveTenant(user.id);
 if (!tenantId) return null;

 let rq = supabase
  .from("roles")
  .select(`
   id, name, slug, description, is_system, created_at,
   role_policies(
    policy:policies(id, name)
   )
  `, { count: "exact" })
  .eq("tenant_id", tenantId);

 if (filters.name) rq = rq.ilike("name", `%${filters.name}%`);

 const { data: roles, count } = await rq
  .order("is_system", { ascending: false })
  .order(sortCol, { ascending })
  .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

 const rows = roles ?? [];
 const totalItems = count ?? 0;
 const totalPages = Math.ceil(totalItems / PAGE_SIZE);

 return (
  <div className="p-6 space-y-6 max-w-4xl">
   {/* Header */}
   <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
     <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
     <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
       Roles
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
       A role groups policies together and is assigned to users.
      </p>
     </div>
    </div>
    <CreateRoleDialog />
   </div>

   {/* Table */}
   <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <Table>
     <TableHeader className="bg-gray-100 dark:bg-gray-800">
      <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-transparent">
       <SortableHead label="Role" field="name" currentSort={sortCol} currentDir={dirLabel} basePath="/dashboard/roles" />
       <TableHead className="text-gray-500 dark:text-gray-400">Policies</TableHead>
       <TableHead className="text-gray-500 dark:text-gray-400">Type</TableHead>
       <TableHead className="w-24" />
      </TableRow>
      <Suspense><TableFilters columns={filterColumns} /></Suspense>
     </TableHeader>
     <TableBody>
      {rows.length === 0 ? (
       <TableRow>
        <TableCell colSpan={4} className="text-center text-gray-500 dark:text-gray-400 py-10 bg-white dark:bg-gray-900">
         No roles yet. Create one to start assigning access.
        </TableCell>
       </TableRow>
      ) : (
       rows.map((role, i) => {
        const policies = (role.role_policies ?? [])
         .map((rp) => {
          const p = rp.policy as unknown as { id: string; name: string } | null;
          return p;
         })
         .filter(Boolean) as { id: string; name: string }[];

        return (
         <TableRow
          key={role.id}
          className={`border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}
         >
          <TableCell>
           <div className="font-medium text-gray-900 dark:text-gray-100">{role.name}</div>
           {role.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{role.description}</div>
           )}
          </TableCell>
          <TableCell>
           {policies.length === 0 ? (
            <span className="text-xs text-gray-400 dark:text-gray-500 italic">None</span>
           ) : (
            <div className="flex flex-wrap gap-1">
             {policies.map((p) => (
              <Link key={p.id} href={`/dashboard/policies/${p.id}`}>
               <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400 text-xs hover:bg-blue-500/10 transition-colors cursor-pointer">
                {p.name}
               </Badge>
              </Link>
             ))}
            </div>
           )}
          </TableCell>
          <TableCell>
           {role.is_system ? (
            <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
           ) : (
            <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400 text-xs">Custom</Badge>
           )}
          </TableCell>
          <TableCell className="text-right">
           <RoleActions roleId={role.id} isSystem={role.is_system} />
          </TableCell>
         </TableRow>
        );
       })
      )}
     </TableBody>
    </Table>
   </div>

   <TablePagination
    currentPage={page}
    totalPages={totalPages}
    totalItems={totalItems}
    basePath="/dashboard/roles"
    sortCol={sortCol}
    ascending={ascending}
   />

   {/* Footnote */}
   <p className="text-xs text-gray-500 dark:text-gray-400">
    <strong className="text-gray-900 dark:text-gray-100">How roles work: </strong>
    Each user is assigned one role per tenant. A role contains one or more policies.
    System roles are managed by Next Novas and cannot be deleted.
   </p>
  </div>
 );
}