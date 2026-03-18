import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCatalogDialog } from "@/components/create-catalog-dialog";
import { CatalogActions } from "@/components/catalog-actions";
import { BookOpen } from "lucide-react";
import Link from "next/link";

type Catalog = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  content_catalog_items: { id: string }[];
};

export default async function ContentCatalogPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  const role = tenantId ? await getUserRole(user.id, tenantId) : null;

  const { data: currentTenant } = tenantId
    ? await supabase.from("tenants").select("is_super").eq("id", tenantId).maybeSingle()
    : { data: null };
  const isSuperAdmin = role === "super_admin" && (currentTenant?.is_super === true);

  const { data: catalogs } = await supabase
    .from("content_catalogs")
    .select("*, content_catalog_items(id)")
    .order("name") as { data: Catalog[] | null };

  const rows = catalogs ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Content Catalog
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Shared lookup catalogs used by select and multi-select fields across all collections.
            </p>
          </div>
        </div>
        {isSuperAdmin && <CreateCatalogDialog />}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-gray-500">Name</TableHead>
              <TableHead className="text-gray-500">Slug</TableHead>
              <TableHead className="text-gray-500">Description</TableHead>
              <TableHead className="text-center text-gray-500">Items</TableHead>
              <TableHead className="text-gray-500">Created</TableHead>
              {isSuperAdmin && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 6 : 5} className="text-center text-gray-500 py-10 bg-white">
                  No content catalogs yet.{isSuperAdmin ? " Create one to use with select fields." : ""}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((catalog, i) => (
                <TableRow
                  key={catalog.id}
                  className={`border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/studio/content-catalog/${catalog.slug}`}
                      className="text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {catalog.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-blue-600 font-mono">{catalog.slug}</code>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm max-w-[200px]">
                    <span className="block truncate">{catalog.description ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
                      {catalog.content_catalog_items?.length ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
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
    </div>
  );
}
