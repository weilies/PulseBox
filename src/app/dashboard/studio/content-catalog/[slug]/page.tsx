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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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

  const items = [...(catalog.content_catalog_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Back nav */}
      <Link
        href="/dashboard/studio/content-catalog"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Content Catalog
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              {catalog.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <code className="text-xs text-gray-500 font-mono">{catalog.slug}</code>
              {!isSuperAdmin && (
                <span className="text-xs text-gray-500">(read-only)</span>
              )}
            </div>
            {catalog.description && (
              <p className="text-sm text-gray-500 mt-1">{catalog.description}</p>
            )}
          </div>
        </div>
        {isSuperAdmin && (
          <CreateCatalogItemDialog catalogId={catalog.id} catalogSlug={catalog.slug} />
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="w-10 text-gray-500">#</TableHead>
              <TableHead className="text-gray-500">Label</TableHead>
              <TableHead className="text-gray-500">Value</TableHead>
              <TableHead className="text-center text-gray-500">Status</TableHead>
              {isSuperAdmin && <TableHead className="w-[120px] text-gray-500">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center text-gray-500 py-10 bg-white">
                  No items yet.{isSuperAdmin ? " Add items to populate this catalog." : ""}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow
                  key={item.id}
                  className={`border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${!item.is_active ? "opacity-50" : ""}`}
                >
                  <TableCell className="text-gray-500 text-xs">{index + 1}</TableCell>
                  <TableCell className="font-medium text-gray-900 text-sm">{item.label}</TableCell>
                  <TableCell>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-blue-600 font-mono">{item.value}</code>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={item.is_active
                        ? "border-green-500/40 text-green-400 text-xs"
                        : "border-zinc-600 text-gray-500 text-xs"}
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

      <p className="text-xs text-gray-500">
        Order controls how options appear in select fields across collections.
      </p>
    </div>
  );
}
