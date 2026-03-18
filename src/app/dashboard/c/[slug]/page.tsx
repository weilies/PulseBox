import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CreateItemDialog } from "@/components/item-form-dialog";
import { ItemRowActions } from "@/components/item-row-actions";
import { ExportButtons } from "@/components/export-buttons";
import { ImportDialog } from "@/components/import-dialog";
import { ArrowLeft, ChevronUp, ChevronDown, Database, Box } from "lucide-react";
import Link from "next/link";
import type { Field, CatalogItems } from "@/components/item-form-dialog";
import { getTenantLanguages } from "@/lib/services/translations.service";
import { getFieldLabel, getCollectionName } from "@/lib/i18n";
import { LANG_COOKIE } from "@/lib/constants";

const PAGE_SIZE = 20;

type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  collection_fields: Field[];
};

type Item = {
  id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export default async function CollectionItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const sortCol = sp.sort === "updated_at" ? "updated_at" : "created_at";
  const ascending = sp.dir === "asc";

  const user = await getUser();
  if (!user) notFound();

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) notFound();

  // Fetch collection + fields
  const { data: collection } = (await supabase
    .from("collections")
    .select("*, collection_fields(*)")
    .eq("slug", slug)
    .eq("is_hidden", false)
    .maybeSingle()) as { data: Collection | null };

  if (!collection) notFound();

  // Check permissions via RLS helper functions
  const [canCreateResult, canUpdateResult, canDeleteResult, canExportResult, canImportResult] = await Promise.all([
    supabase.rpc("has_permission", { p_resource_type: "collection", p_resource_id: collection.id, p_permission: "create" }),
    supabase.rpc("has_permission", { p_resource_type: "collection", p_resource_id: collection.id, p_permission: "update" }),
    supabase.rpc("has_permission", { p_resource_type: "collection", p_resource_id: collection.id, p_permission: "delete" }),
    supabase.rpc("has_permission", { p_resource_type: "collection", p_resource_id: collection.id, p_permission: "export" }),
    supabase.rpc("has_permission", { p_resource_type: "collection", p_resource_id: collection.id, p_permission: "import" }),
  ]);

  const canCreate = !!canCreateResult.data;
  const canUpdate = !!canUpdateResult.data;
  const canDelete = !!canDeleteResult.data;
  const canExport = !!canExportResult.data;
  const canImport = !!canImportResult.data;
  const canWrite = canCreate || canUpdate || canDelete;

  const fields = [...(collection.collection_fields ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  // Fetch content catalog items for select/multiselect fields
  const catalogSlugs = fields
    .filter((f) => f.options?.catalog_slug)
    .map((f) => f.options.catalog_slug as string);

  const catalogItems: CatalogItems = {};
  if (catalogSlugs.length > 0) {
    const { data: catalogs } = await supabase
      .from("content_catalogs")
      .select("slug, content_catalog_items(value, label, sort_order)")
      .in("slug", catalogSlugs);

    for (const catalog of catalogs ?? []) {
      catalogItems[catalog.slug] = (
        (catalog.content_catalog_items as { value: string; label: string; sort_order: number }[]) ?? []
      ).sort((a, b) => a.sort_order - b.sort_order);
    }
  }

  // Fetch items (paginated)
  const isSystem = collection.type === "system";
  let itemsQuery = supabase
    .from("collection_items")
    .select("id, data, created_at, updated_at", { count: "exact" })
    .eq("collection_id", collection.id)
    .order(sortCol, { ascending })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (!isSystem) {
    itemsQuery = itemsQuery.eq("tenant_id", tenantId);
  }

  const { data: items, count } = await itemsQuery;

  const { data: tenantLanguages } = await getTenantLanguages(supabase, tenantId);

  const cookieStore = await cookies();
  const currentLocale = cookieStore.get(LANG_COOKIE)?.value ?? "en";

  // Bulk-fetch translations for translatable fields in the current locale
  const translatableFieldSlugs = fields.filter((f) => f.is_translatable).map((f) => f.slug);
  const itemIds = (items ?? []).map((i: Item) => i.id);
  let translationsMap: Record<string, Record<string, string>> = {};

  if (currentLocale !== "en" && translatableFieldSlugs.length > 0 && itemIds.length > 0) {
    const { data: translations } = await supabase
      .from("collection_item_translations")
      .select("item_id, field_slug, value")
      .in("item_id", itemIds)
      .eq("language_code", currentLocale)
      .in("field_slug", translatableFieldSlugs);

    for (const t of translations ?? []) {
      if (!translationsMap[t.item_id]) translationsMap[t.item_id] = {};
      if (t.value) translationsMap[t.item_id][t.field_slug] = t.value;
    }
  }

  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const dirLabel = ascending ? "asc" : "desc";
  const Icon = isSystem ? Database : Box;

  return (
    <div className="space-y-6 p-6">
      {/* Collection header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md border border-gray-300 bg-gray-100 p-2">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
                {getCollectionName(collection, currentLocale)}
              </h1>
              <Badge
                variant="outline"
                className={isSystem
                  ? "border-blue-500/40 text-blue-600 text-xs"
                  : "border-violet-500/40 text-violet-400 text-xs"}
              >
                {isSystem ? "System" : "Tenant"}
              </Badge>
            </div>
            <code className="text-xs text-gray-500">{collection.slug}</code>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canExport && (
            <ExportButtons collectionSlug={collection.slug} collectionName={collection.name} />
          )}
          {canImport && (
            <ImportDialog
              fields={fields.map((f) => ({ slug: f.slug, name: f.name, field_type: f.field_type, is_required: f.is_required }))}
              collectionSlug={collection.slug}
            />
          )}
          {canCreate && (
            <CreateItemDialog
              fields={fields}
              collectionId={collection.id}
              collectionSlug={collection.slug}
              catalogItems={catalogItems}
            />
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        <Link
          href={`/dashboard/c/${slug}`}
          className="px-4 py-2 text-sm text-blue-600 border-b-2 border-blue-400 font-medium"
        >
          Items
        </Link>
        <Link
          href={`/dashboard/c/${slug}/schema`}
          className="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          Schema
        </Link>
      </div>

      {/* Row count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{totalItems} total item{totalItems !== 1 ? "s" : ""}</span>
        {totalPages > 1 && <span>Page {page} of {totalPages}</span>}
      </div>

      {/* Table */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {(items?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-500 text-sm">No items yet.</p>
              {canCreate && (
                <p className="text-blue-500/40 text-xs mt-1">Click &ldquo;Add Item&rdquo; to create the first record.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 hover:bg-transparent">
                    <TableHead className="w-10 text-gray-500">#</TableHead>
                    {fields.map((f) => (
                      <TableHead key={f.id} className="text-gray-500 whitespace-nowrap">{getFieldLabel(f, currentLocale)}</TableHead>
                    ))}
                    <TableHead className="text-gray-500">
                      <SortLink label="Created" field="created_at" currentSort={sortCol} currentDir={dirLabel} slug={slug} />
                    </TableHead>
                    {(canUpdate || canDelete) && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items as Item[]).map((item, index) => (
                    <TableRow key={item.id} className="border-gray-100 hover:bg-gray-50">
                      <TableCell className="text-gray-500 text-xs">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </TableCell>
                      {fields.map((f) => {
                        const cellValue = (f.is_translatable && translationsMap[item.id]?.[f.slug])
                          ? translationsMap[item.id][f.slug]
                          : item.data?.[f.slug];
                        return (
                          <TableCell key={f.id} className="text-sm max-w-[160px] text-gray-900">
                            <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                              {renderCellValue(f.field_type, cellValue, f.options, catalogItems)}
                            </span>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                        {new Date(item.created_at).toLocaleDateString()}
                      </TableCell>
                      {(canUpdate || canDelete) && (
                        <TableCell>
                          <ItemRowActions
                            item={{ id: item.id, data: item.data ?? {} }}
                            fields={fields}
                            collectionId={collection.id}
                            collectionSlug={collection.slug}
                            catalogItems={catalogItems}
                            tenantLanguages={tenantLanguages ?? []}
                            currentLocale={currentLocale}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/dashboard/c/${slug}?page=${page - 1}&sort=${sortCol}&dir=${dirLabel}`}
              className="inline-flex items-center h-8 px-3 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-500/40 rounded-md transition-colors"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Previous
            </Link>
          )}
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/dashboard/c/${slug}?page=${page + 1}&sort=${sortCol}&dir=${dirLabel}`}
              className="inline-flex items-center h-8 px-3 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-500/40 rounded-md transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function SortLink({
  label, field, currentSort, currentDir, slug,
}: {
  label: string; field: string; currentSort: string; currentDir: string; slug: string;
}) {
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";
  return (
    <Link
      href={`/dashboard/c/${slug}?sort=${field}&dir=${nextDir}&page=1`}
      className={`inline-flex items-center gap-1 hover:text-blue-600 transition-colors ${isActive ? "text-blue-600" : ""}`}
    >
      {label}
      {isActive && currentDir === "desc" && <ChevronDown className="h-3 w-3" />}
      {isActive && currentDir === "asc" && <ChevronUp className="h-3 w-3" />}
    </Link>
  );
}

function renderCellValue(
  fieldType: string,
  value: unknown,
  options: Record<string, unknown>,
  catalogItems: CatalogItems
): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (fieldType) {
    case "boolean": return value ? "Yes" : "No";
    case "date":
      try { return new Date(value as string).toLocaleDateString(); } catch { return String(value); }
    case "datetime":
      try { return new Date(value as string).toLocaleString(); } catch { return String(value); }
    case "select": {
      const listSlug = options?.catalog_slug as string | undefined;
      if (listSlug && catalogItems[listSlug]) {
        const found = catalogItems[listSlug].find((i) => i.value === value);
        return found?.label ?? String(value);
      }
      return String(value);
    }
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [value];
      const listSlug = options?.catalog_slug as string | undefined;
      if (listSlug && catalogItems[listSlug]) {
        return arr.map((v) => {
          const found = catalogItems[listSlug].find((i) => i.value === v);
          return found?.label ?? String(v);
        }).join(", ");
      }
      return (arr as string[]).join(", ");
    }
    case "json": return JSON.stringify(value).slice(0, 60);
    default: return String(value).slice(0, 80);
  }
}
