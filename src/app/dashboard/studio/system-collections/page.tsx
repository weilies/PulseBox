import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreateCollectionDialog } from "@/components/create-collection-dialog";
import { CollectionActions } from "@/components/collection-actions";
import { Database, Settings } from "lucide-react";
import Link from "next/link";

type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: string;
  is_hidden: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
  collection_fields: { id: string }[];
};

export default async function SystemCollectionsPage() {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  const role = tenantId ? await getUserRole(user.id, tenantId) : null;

  const { data: currentTenant } = tenantId
    ? await supabase.from("tenants").select("is_super").eq("id", tenantId).maybeSingle()
    : { data: null };
  const isSuperAdmin = role === "super_admin" && (currentTenant?.is_super === true);

  const { data: collections } = await supabase
    .from("collections")
    .select("*, collection_fields(id)")
    .eq("is_hidden", false)
    .eq("type", "system")
    .order("name") as { data: Collection[] | null };

  const rows = collections ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              System Collections
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isSuperAdmin
                ? "Platform-wide collections managed by BIPO."
                : "Read-only system collections available to your tenant."}
            </p>
          </div>
        </div>
        {isSuperAdmin && <CreateCollectionDialog isSuperAdmin={isSuperAdmin} defaultType="system" />}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-gray-500">Name</TableHead>
              <TableHead className="text-gray-500">Slug</TableHead>
              <TableHead className="text-center text-gray-500">Fields</TableHead>
              <TableHead className="text-gray-500">Created</TableHead>
              <TableHead className="w-[120px] text-gray-500">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-10 bg-white">
                  No system collections yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c, i) => (
                <TableRow
                  key={c.id}
                  className={`border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <Settings className="h-3.5 w-3.5 text-blue-600/50 shrink-0" />
                      {c.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-blue-600 font-mono">{c.slug}</code>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">
                      {c.collection_fields?.length ?? 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/dashboard/studio/collections/${c.slug}/schema`}
                        className="inline-flex items-center h-7 px-2 text-xs text-blue-600 hover:text-[#a8c4ff] hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Schema
                      </Link>
                      <Link
                        href={`/dashboard/studio/collections/${c.slug}/items`}
                        className="inline-flex items-center h-7 px-2 text-xs text-gray-500 hover:text-[#a8c4ff] hover:bg-gray-100 rounded-md transition-colors"
                      >
                        Items
                      </Link>
                      {isSuperAdmin && (
                        <CollectionActions
                          collectionId={c.id}
                          collectionName={c.name}
                          collectionSlug={c.slug}
                          description={c.description ?? ""}
                          icon={c.icon ?? ""}
                          metadata={c.metadata}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
