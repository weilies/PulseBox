import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KeyRound } from "lucide-react";
import { CreateAppDialog } from "@/components/create-app-dialog";
import { AppActions } from "@/components/app-actions";
import { PAGE_SIZE, buildGridParams, type GridConfig } from "@/lib/data-grid";
import { SortableHead } from "@/components/sortable-head";
import { TablePagination } from "@/components/table-pagination";
import { TableFilters, type FilterColumn } from "@/components/table-filters";
import { Suspense } from "react";

const gridConfig: GridConfig = {
 sortable: [
  { field: "created_at", defaultDir: "desc" },
  { field: "app_name", defaultDir: "asc" },
 ],
 filterable: ["app_name", "is_active"],
};

const filterColumns: FilterColumn[] = [
 { key: "app_name", type: "text", placeholder: "Filter name..." },
 { key: "_app_id", type: "none" },
 { key: "is_active", type: "select", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
 { key: "_last_used", type: "none" },
 { key: "_expires", type: "none" },
 { key: "_actions", type: "none" },
];

export default async function AppsPage({
 searchParams,
}: {
 searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
 const user = await getUser();
 if (!user) return null;

 const tenantId = await resolveTenant(user.id);
 if (!tenantId) return null;

 const sp = await searchParams;
 const { page, sortCol, ascending, filters } = buildGridParams(sp as Record<string, string | string[] | undefined>, gridConfig);
 const dirLabel = ascending ? "asc" : "desc" as const;

 const db = createAdminClient();
 let q = db
 .from("tenant_apps")
 .select("id, app_name, app_id, is_active, created_at, last_used_at, expires_at", { count: "exact" })
 .eq("tenant_id", tenantId);

 // Apply filters
 if (filters.app_name) q = q.ilike("app_name", `%${filters.app_name}%`);
 if (filters.is_active) q = q.eq("is_active", filters.is_active === "true");

 const { data: apps, count } = await q
 .order(sortCol, { ascending })
 .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

 const rows = apps ?? [];
 const totalItems = count ?? 0;
 const totalPages = Math.ceil(totalItems / PAGE_SIZE);

 return (
 <div className="p-6 space-y-6 max-w-5xl">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <KeyRound className="h-6 w-6 text-blue-600 dark:text-blue-400" />
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
 Applications
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
 Manage app credentials for server-to-server integrations.
 </p>
 </div>
 </div>
 <CreateAppDialog />
 </div>

 {/* Table */}
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
 <Table>
 <TableHeader className="bg-gray-100 dark:bg-gray-800">
 <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-transparent">
 <SortableHead label="App Name" field="app_name" currentSort={sortCol} currentDir={dirLabel} basePath="/dashboard/apps" />
 <TableHead className="text-gray-500 dark:text-gray-400">App ID</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400 hidden sm:table-cell">Status</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400 hidden md:table-cell">Last Used</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400 hidden md:table-cell">Expires</TableHead>
 <TableHead className="w-12" />
 </TableRow>
 <Suspense><TableFilters columns={filterColumns} /></Suspense>
 </TableHeader>
 <TableBody>
 {rows.length === 0 ? (
 <TableRow>
 <TableCell colSpan={6} className="text-center text-gray-500 dark:text-gray-400 py-10 bg-white dark:bg-gray-900">
 No apps yet. Create one to generate API credentials.
 </TableCell>
 </TableRow>
 ) : (
 rows.map((app, i) => (
 <TableRow key={app.id} className={`border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}>
 <TableCell className="text-gray-900 dark:text-gray-100 font-medium">{app.app_name}</TableCell>
 <TableCell>
 <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-mono">
 {app.app_id}
 </code>
 </TableCell>
 <TableCell className="hidden sm:table-cell">
 {app.is_active ? (
 <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Active</Badge>
 ) : (
 <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">Inactive</Badge>
 )}
 </TableCell>
 <TableCell className="text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">
 {app.last_used_at
 ? new Date(app.last_used_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
 : "Never"
 }
 </TableCell>
 <TableCell className="text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">
 {app.expires_at
 ? new Date(app.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
 : "Never"
 }
 </TableCell>
 <TableCell>
 <AppActions app={app} />
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </div>

 <TablePagination
 currentPage={page}
 totalPages={totalPages}
 totalItems={totalItems}
 basePath="/dashboard/apps"
 sortCol={sortCol}
 ascending={ascending}
 />

 <p className="text-xs text-gray-500 dark:text-gray-400">
 App credentials are used for server-to-server integrations. Use <code className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 text-blue-600 dark:text-blue-400 font-mono">POST /api/auth/token</code> with your app_id and app_secret to get a Bearer token.
 </p>
 </div>
 );
}