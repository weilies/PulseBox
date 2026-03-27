import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCatalogDialog } from "@/components/create-catalog-dialog";
import { CatalogActions } from "@/components/catalog-actions";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { PAGE_SIZE, buildGridParams, type GridConfig } from "@/lib/data-grid";
import { SortableHead } from "@/components/sortable-head";
import { TablePagination } from "@/components/table-pagination";
import { TableFilters, type FilterColumn } from "@/components/table-filters";
import { Suspense } from "react";

type Catalog = {
 id: string;
 slug: string;
 name: string;
 description: string | null;
 created_at: string;
 content_catalog_items: { id: string }[];
};

const gridConfig: GridConfig = {
 sortable: [
  { field: "name", defaultDir: "asc" },
  { field: "created_at", defaultDir: "desc" },
 ],
 filterable: ["name", "slug"],
};

const filterColumns: FilterColumn[] = [
 { key: "name", type: "text", placeholder: "Filter name..." },
 { key: "slug", type: "text", placeholder: "Filter slug..." },
 { key: "_desc", type: "none" },
 { key: "_items", type: "none" },
 { key: "_created", type: "none" },
];

export default async function ContentCatalogPage({
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
 const role = tenantId ? await getUserRole(user.id, tenantId) : null;

 const { data: currentTenant } = tenantId
 ? await supabase.from("tenants").select("is_super").eq("id", tenantId).maybeSingle()
 : { data: null };
 const isSuperAdmin = role === "super_admin" && (currentTenant?.is_super === true);

 let cq = supabase
 .from("content_catalogs")
 .select("*, content_catalog_items(id)", { count: "exact" });

 if (filters.name) cq = cq.ilike("name", `%${filters.name}%`);
 if (filters.slug) cq = cq.ilike("slug", `%${filters.slug}%`);

 const { data: catalogs, count } = await cq
 .order(sortCol, { ascending })
 .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1) as { data: Catalog[] | null; count: number | null };

 const rows = catalogs ?? [];
 const totalItems = count ?? 0;
 const totalPages = Math.ceil(totalItems / PAGE_SIZE);

 return (
 <div className="p-6 space-y-6 max-w-5xl">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
 Content Catalog
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
 Shared lookup catalogs used by select and multi-select fields across all collections.
 </p>
 </div>
 </div>
 {isSuperAdmin && <CreateCatalogDialog />}
 </div>

 {/* Table */}
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
 <Table>
 <TableHeader className="bg-gray-100 dark:bg-gray-800">
 <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-transparent">
 <SortableHead label="Name" field="name" currentSort={sortCol} currentDir={dirLabel} basePath="/dashboard/studio/content-catalog" />
 <TableHead className="text-gray-500 dark:text-gray-400">Slug</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400">Description</TableHead>
 <TableHead className="text-center text-gray-500 dark:text-gray-400">Items</TableHead>
 <SortableHead label="Created" field="created_at" currentSort={sortCol} currentDir={dirLabel} basePath="/dashboard/studio/content-catalog" />
 {isSuperAdmin && <TableHead className="w-[80px]" />}
 </TableRow>
 <Suspense><TableFilters columns={isSuperAdmin ? [...filterColumns, { key: "_actions", type: "none" as const }] : filterColumns} /></Suspense>
 </TableHeader>
 <TableBody>
 {rows.length === 0 ? (
 <TableRow>
 <TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center text-gray-500 dark:text-gray-400 py-10 bg-white dark:bg-gray-900">
 No content catalogs yet.{isSuperAdmin ? " Create one to use with select fields." : ""}
 </TableCell>
 </TableRow>
 ) : (
 rows.map((catalog, i) => (
 <TableRow
 key={catalog.id}
 className={`border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}
 >
 <TableCell className="font-medium">
 <Link
 href={`/dashboard/studio/content-catalog/${catalog.slug}`}
 className="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 transition-colors"
 >
 {catalog.name}
 </Link>
 </TableCell>
 <TableCell>
 <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-mono">{catalog.slug}</code>
 </TableCell>
 <TableCell className="text-gray-500 dark:text-gray-400 text-sm max-w-[200px]">
 <span className="block truncate">{catalog.description ?? "—"}</span>
 </TableCell>
 <TableCell className="text-center">
 <Badge variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-xs">
 {catalog.content_catalog_items?.length ?? 0}
 </Badge>
 </TableCell>
 <TableCell className="text-gray-500 dark:text-gray-400 text-sm">
 {new Date(catalog.created_at).toLocaleDateString()}
 </TableCell>
 {isSuperAdmin && (
 <TableCell>
 <CatalogActions
 catalogId={catalog.id}
 catalogName={catalog.name}
 catalogSlug={catalog.slug}
 description={catalog.description ?? ""}
 />
 </TableCell>
 )}
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
 basePath="/dashboard/studio/content-catalog"
 sortCol={sortCol}
 ascending={ascending}
 />
 </div>
 );
}