import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCatalogItemDialog } from "@/components/create-catalog-item-dialog";
import { CatalogItemActions } from "@/components/catalog-item-actions";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { PAGE_SIZE } from "@/lib/data-grid";
import { TablePagination } from "@/components/table-pagination";
import { TableFilters, type FilterColumn } from "@/components/table-filters";
import { Suspense } from "react";

type CatalogItem = {
 id: string;
 catalog_id: string;
 value: string;
 label: string;
 sort_order: number;
 is_active: boolean;
};

type Catalog = {
 id: string;
 slug: string;
 name: string;
 description: string | null;
 content_catalog_items: CatalogItem[];
};

export default async function CatalogItemsPage({
 params,
 searchParams,
}: {
 params: Promise<{ slug: string }>;
 searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
 const { slug } = await params;
 const sp = await searchParams;
 const page = Math.max(1, parseInt(String(sp.page ?? "1")));
 const fLabel = typeof sp.f_label === "string" ? sp.f_label : "";
 const fValue = typeof sp.f_value === "string" ? sp.f_value : "";
 const fActive = typeof sp.f_is_active === "string" ? sp.f_is_active : "";

 const user = await getUser();
 if (!user) notFound();

 const supabase = await createClient();
 const tenantId = await resolveTenant(user.id);
 const role = tenantId ? await getUserRole(user.id, tenantId) : null;

 const { data: currentTenant } = tenantId
 ? await supabase.from("tenants").select("is_super").eq("id", tenantId).maybeSingle()
 : { data: null };
 const isSuperAdmin = role === "super_admin" && (currentTenant?.is_super === true);

 const { data: catalog } = await supabase
 .from("content_catalogs")
 .select("*, content_catalog_items(*)")
 .eq("slug", slug)
 .maybeSingle() as { data: Catalog | null };

 if (!catalog) notFound();

 let allItems = [...(catalog.content_catalog_items ?? [])].sort(
 (a, b) => a.sort_order - b.sort_order
 );

 // Apply filters
 if (fLabel) allItems = allItems.filter((i) => i.label.toLowerCase().includes(fLabel.toLowerCase()));
 if (fValue) allItems = allItems.filter((i) => i.value.toLowerCase().includes(fValue.toLowerCase()));
 if (fActive) allItems = allItems.filter((i) => (fActive === "true") === i.is_active);

 const totalItems = allItems.length;
 const totalPages = Math.ceil(totalItems / PAGE_SIZE);
 const items = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

 return (
 <div className="p-6 space-y-6 max-w-4xl">
 {/* Back nav */}
 <Link
 href="/dashboard/studio/content-catalog"
 className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 transition-colors"
 >
 <ArrowLeft className="h-3.5 w-3.5" />
 Back to Content Catalog
 </Link>

 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
 {catalog.name}
 </h1>
 <div className="flex items-center gap-2 mt-0.5">
 <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">{catalog.slug}</code>
 {!isSuperAdmin && (
 <span className="text-xs text-gray-500 dark:text-gray-400">(read-only)</span>
 )}
 </div>
 {catalog.description && (
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{catalog.description}</p>
 )}
 </div>
 </div>
 {isSuperAdmin && (
 <CreateCatalogItemDialog catalogId={catalog.id} catalogSlug={catalog.slug} />
 )}
 </div>

 {/* Table */}
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
 <Table>
 <TableHeader className="bg-gray-100 dark:bg-gray-800">
 <TableRow className="border-gray-200 dark:border-gray-700 hover:bg-transparent">
 <TableHead className="w-10 text-gray-500 dark:text-gray-400">#</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400">Label</TableHead>
 <TableHead className="text-gray-500 dark:text-gray-400">Value</TableHead>
 <TableHead className="text-center text-gray-500 dark:text-gray-400">Status</TableHead>
 {isSuperAdmin && <TableHead className="w-[120px] text-gray-500 dark:text-gray-400">Actions</TableHead>}
 </TableRow>
 <Suspense><TableFilters columns={[
  { key: "_num", type: "none" },
  { key: "label", type: "text", placeholder: "Filter label..." },
  { key: "value", type: "text", placeholder: "Filter value..." },
  { key: "is_active", type: "select", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
  ...(isSuperAdmin ? [{ key: "_actions" as const, type: "none" as const }] : []),
 ]} /></Suspense>
 </TableHeader>
 <TableBody>
 {items.length === 0 ? (
 <TableRow>
 <TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center text-gray-500 dark:text-gray-400 py-10 bg-white dark:bg-gray-900">
 No items yet.{isSuperAdmin ? " Add items to populate this catalog." : ""}
 </TableCell>
 </TableRow>
 ) : (
 items.map((item, index) => (
 <TableRow
 key={item.id}
 className={`border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${index % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"} ${!item.is_active ? "opacity-50" : ""}`}
 >
 <TableCell className="text-gray-500 dark:text-gray-400 text-xs">{(page - 1) * PAGE_SIZE + index + 1}</TableCell>
 <TableCell className="font-medium text-gray-900 dark:text-gray-100 text-sm">{item.label}</TableCell>
 <TableCell>
 <code className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-mono">{item.value}</code>
 </TableCell>
 <TableCell className="text-center">
 <Badge
 variant="outline"
 className={item.is_active
 ? "border-green-500/40 text-green-400 text-xs"
 : "border-zinc-600 text-gray-500 dark:text-gray-400 text-xs"}
 >
 {item.is_active ? "Active" : "Inactive"}
 </Badge>
 </TableCell>
 {isSuperAdmin && (
 <TableCell>
 <CatalogItemActions
 item={item}
 catalogId={catalog.id}
 catalogSlug={catalog.slug}
 isFirst={index === 0}
 isLast={index === items.length - 1}
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
 basePath={`/dashboard/studio/content-catalog/${slug}`}
 sortCol="sort_order"
 ascending={true}
 />

 <p className="text-xs text-gray-500 dark:text-gray-400">
 Order controls how options appear in select fields across collections.
 </p>
 </div>
 );
}