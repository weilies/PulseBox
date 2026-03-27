import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { hasPageAccess } from "@/lib/services/permissions.service";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Workflow, Plus, Globe, FileEdit } from "lucide-react";
import { QueryListActions } from "@/components/query-list-actions";
import { PAGE_SIZE, buildGridParams, type GridConfig } from "@/lib/data-grid";
import { SortableHead } from "@/components/sortable-head";
import { TablePagination } from "@/components/table-pagination";
import { TableFilters, type FilterColumn } from "@/components/table-filters";
import { Suspense } from "react";

const gridConfig: GridConfig = {
 sortable: [
  { field: "updated_at", defaultDir: "desc" },
  { field: "name", defaultDir: "asc" },
 ],
 filterable: ["name", "status"],
};

const filterColumns: FilterColumn[] = [
 { key: "name", type: "text", placeholder: "Filter name..." },
 { key: "status", type: "select", options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }] },
 { key: "_collections", type: "none" },
 { key: "_created_by", type: "none" },
 { key: "_updated", type: "none" },
 { key: "_actions", type: "none" },
];

export default async function QueriesPage({
 searchParams,
}: {
 searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
 const user = await getUser();
 if (!user) redirect("/login");

 const sp = await searchParams;
 const { page, sortCol, ascending, filters } = buildGridParams(sp as Record<string, string | string[] | undefined>, gridConfig);
 const dirLabel = ascending ? "asc" : "desc" as const;

 const supabase = await createClient();
 const tenantId = await resolveTenant(user.id);
 if (!tenantId) redirect("/dashboard");

 const canAccess = await hasPageAccess(supabase, "studio.queries");
 if (!canAccess) redirect("/dashboard");

 // Fetch queries — RLS handles draft/published visibility
 let qq = supabase
 .from("saved_queries")
 .select("id, name, slug, description, status, created_by, created_at, updated_at, definition", { count: "exact" })
 .eq("tenant_id", tenantId);

 if (filters.name) qq = qq.ilike("name", `%${filters.name}%`);
 if (filters.status) qq = qq.eq("status", filters.status);

 const { data: queries, count } = await qq
 .order(sortCol, { ascending })
 .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

 // Fetch creator profiles for display
 const creatorIds = [...new Set((queries ?? []).map((q) => q.created_by))];
 const { data: profiles } = creatorIds.length > 0
 ? await supabase
 .from("profiles")
 .select("id, full_name, email")
 .in("id", creatorIds)
 : { data: [] };

 const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

 const rows = queries ?? [];
 const totalItems = count ?? 0;
 const totalPages = Math.ceil(totalItems / PAGE_SIZE);

 return (
 <div className="p-6 space-y-6 max-w-5xl">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Workflow className="h-6 w-6 text-blue-600 dark:text-blue-400" />
 <div>
 <h1
 className="text-xl font-bold text-gray-900 dark:text-gray-100"
 style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
 >
 Query Generator
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
 Join collections, filter, aggregate — build reusable data queries
 </p>
 </div>
 </div>
 <Link
 href="/dashboard/studio/queries/new"
 className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
 >
 <Plus className="h-4 w-4" />
 New Query
 </Link>
 </div>

 {/* Table */}
 {rows.length > 0 ? (
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
 <Table>
 <TableHeader className="bg-gray-100 dark:bg-gray-800">
 <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-transparent">
 <SortableHead label="Name" field="name" currentSort={sortCol} currentDir={dirLabel} basePath="/dashboard/studio/queries" />
 <TableHead className="text-gray-500 dark:text-gray-400">Status</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400">Collections</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400">Created By</TableHead>
 <SortableHead label="Updated" field="updated_at" currentSort={sortCol} currentDir={dirLabel} basePath="/dashboard/studio/queries" />
 <TableHead className="text-gray-500 dark:text-gray-400 w-10" />
 </TableRow>
 <Suspense><TableFilters columns={filterColumns} /></Suspense>
 </TableHeader>
 <TableBody>
 {rows.map((query, i) => {
 const def = query.definition as { collections?: { slug: string }[] };
 const collCount = def?.collections?.length ?? 0;
 const creator = profileMap.get(query.created_by);
 const isOwner = query.created_by === user.id;

 return (
 <TableRow
 key={query.id}
 className={`border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}
 >
 <TableCell>
 <Link
 href={`/dashboard/studio/queries/${query.id}`}
 className="text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 transition-colors"
 >
 {query.name}
 </Link>
 {query.description && (
 <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-xs">
 {query.description}
 </p>
 )}
 </TableCell>
 <TableCell>
 {query.status === "published" ? (
 <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 gap-1 text-[10px]">
 <Globe className="h-2.5 w-2.5" /> Published
 </Badge>
 ) : (
 <Badge className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] gap-1">
 <FileEdit className="h-2.5 w-2.5" /> Draft
 </Badge>
 )}
 </TableCell>
 <TableCell>
 <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-mono">
 {collCount} {collCount === 1 ? "collection" : "collections"}
 </span>
 </TableCell>
 <TableCell className="text-gray-700 text-sm">
 {creator?.full_name || creator?.email || "Unknown"}
 {isOwner && (
 <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">(you)</span>
 )}
 </TableCell>
 <TableCell className="text-gray-500 dark:text-gray-400 text-sm">
 {new Date(query.updated_at).toLocaleDateString()}
 </TableCell>
 <TableCell>
 {isOwner && <QueryListActions queryId={query.id} queryName={query.name} />}
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 ) : (
 <div className="text-center py-16 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
 <Workflow className="h-10 w-10 text-gray-300 mx-auto mb-3" />
 <p className="text-gray-500 dark:text-gray-400 text-sm">No queries yet</p>
 <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
 Create your first query to join and explore collections
 </p>
 <Link
 href="/dashboard/studio/queries/new"
 className="inline-flex items-center gap-2 mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
 >
 <Plus className="h-4 w-4" />
 New Query
 </Link>
 </div>
 )}

 <TablePagination
 currentPage={page}
 totalPages={totalPages}
 totalItems={totalItems}
 basePath="/dashboard/studio/queries"
 sortCol={sortCol}
 ascending={ascending}
 />

 <p className="text-xs text-gray-500 dark:text-gray-400">
 Published queries are visible to all tenant members with read access to the referenced collections.
 </p>
 </div>
 );
}