import { createClient } from "@/lib/supabase/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { CreateTenantDialog } from "@/components/create-tenant-dialog";
import { TenantActions } from "@/components/tenant-actions";

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, is_super, created_at, contact_name, contact_email, timezone")
    .order("created_at", { ascending: true });

  const rows = tenants ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Tenants
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Super admin view — manage all tenants on the platform.
            </p>
          </div>
        </div>
        <CreateTenantDialog />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-100">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="text-gray-500">Name</TableHead>
              <TableHead className="text-gray-500">Slug</TableHead>
              <TableHead className="text-gray-500">Person In Charge</TableHead>
              <TableHead className="text-gray-500">Type</TableHead>
              <TableHead className="text-gray-500">Created</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-10 bg-white">
                  No tenants found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((t, i) => (
                <TableRow
                  key={t.id}
                  className={`border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                >
                  <TableCell className="font-medium text-gray-900">{t.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-blue-600 font-mono">{t.slug}</code>
                  </TableCell>
                  <TableCell className="text-gray-900 text-sm">
                    {t.contact_name ? (
                      <div>
                        <div>{t.contact_name}</div>
                        {t.contact_email && (
                          <div className="text-xs text-gray-500">{t.contact_email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={t.is_super
                        ? "border-yellow-500/50 text-yellow-400 text-xs"
                        : "border-blue-500/40 text-blue-600 text-xs"}
                    >
                      {t.is_super ? "Super" : "Client"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {new Date(t.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <TenantActions
                      tenantId={t.id}
                      tenantName={t.name}
                      tenantSlug={t.slug}
                      isSuper={t.is_super}
                      contactName={t.contact_name}
                      contactEmail={t.contact_email}
                      timezone={t.timezone}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-500">
        <strong className="text-gray-900">Super tenants</strong> have platform-wide admin access and manage system collections.
        Client tenants are isolated within their own data scope.
      </p>
    </div>
  );
}
