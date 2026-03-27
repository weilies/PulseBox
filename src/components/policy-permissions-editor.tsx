"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updatePolicyPermissions } from "@/app/actions/roles";
import { PAGE_LABELS, COLLECTION_PERMS } from "@/lib/services/permissions.service";
// Non-super tenants may only grant read/export on system collections
const SYSTEM_COL_READONLY_PERMS = new Set(["create", "update", "delete", "import", "manage_schema"]);
const PAGE_PERMS = ["access"] as const;

type PermRow = {
 resource_type: "page" | "collection";
 resource_id: string;
 label: string;
 collectionType?: string; // "system" | "tenant" — only for collection rows
 permissions: Record<string, boolean>;
};

interface PolicyPermissionsEditorProps {
 policyId: string;
 isSystem: boolean;
 isSuperTenant: boolean;
 readOnly?: boolean;
 initialPermissions: Array<{
 resource_type: string;
 resource_id: string;
 permissions: Record<string, boolean>;
 }>;
 pages: string[];
 collections: Array<{ id: string; name: string; type: string }>;
}

export function PolicyPermissionsEditor({
 policyId,
 isSystem,
 isSuperTenant,
 readOnly = false,
 initialPermissions,
 pages,
 collections,
}: PolicyPermissionsEditorProps) {
 const router = useRouter();
 const [loading, setLoading] = useState(false);

 // Build initial state from props
 const buildInitialRows = (): PermRow[] => {
 const rows: PermRow[] = [];
 const permMap = new Map(
 initialPermissions.map((p) => [`${p.resource_type}:${p.resource_id}`, p.permissions])
 );

 for (const page of pages) {
 rows.push({
 resource_type: "page",
 resource_id: page,
 label: PAGE_LABELS[page] ?? page,
 permissions: permMap.get(`page:${page}`) ?? { access: false },
 });
 }

 for (const col of collections) {
 const defaultPerms: Record<string, boolean> = {};
 for (const p of COLLECTION_PERMS) defaultPerms[p] = false;
 rows.push({
 resource_type: "collection",
 resource_id: col.id,
 collectionType: col.type,
 label: `${col.name} (${col.type})`,
 permissions: permMap.get(`collection:${col.id}`) ?? defaultPerms,
 });
 }

 return rows;
 };

 const [rows, setRows] = useState<PermRow[]>(buildInitialRows);

 function toggle(idx: number, perm: string) {
 setRows((prev) => {
 const next = [...prev];
 next[idx] = {
 ...next[idx],
 permissions: { ...next[idx].permissions, [perm]: !next[idx].permissions[perm] },
 };
 return next;
 });
 }

 async function handleSave() {
 setLoading(true);
 const permissions = rows
 .filter((r) => Object.values(r.permissions).some(Boolean))
 .map((r) => ({
 resource_type: r.resource_type,
 resource_id: r.resource_id,
 permissions: r.permissions,
 }));

 const fd = new FormData();
 fd.set("policy_id", policyId);
 fd.set("permissions", JSON.stringify(permissions));
 const result = await updatePolicyPermissions(fd);
 setLoading(false);
 if (result.error) { toast.error(result.error); return; }
 toast.success("Permissions saved");
 router.refresh();
 }

 const pageRows = rows.filter((r) => r.resource_type === "page");
 const collectionRows = rows.filter((r) => r.resource_type === "collection");

 const checkboxClass = "w-4 h-4 rounded accent-blue-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

 return (
 <div className="space-y-6">
 {/* Pages */}
 <div>
 <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Pages</h3>
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
 <table className="w-full text-sm">
 <thead className="bg-gray-100 dark:bg-gray-800">
 <tr>
 <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">Page</th>
 <th className="text-center px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">Access</th>
 </tr>
 </thead>
 <tbody>
 {pageRows.map((row, i) => (
 <tr key={row.resource_id} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}>
 <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.label}</td>
 <td className="px-4 py-2 text-center">
 <input
 type="checkbox"
 className={checkboxClass}
 checked={!!row.permissions.access}
 onChange={() => toggle(i, "access")}
 disabled={isSystem || readOnly}
 />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Collections */}
 {collectionRows.length > 0 && (
 <div>
 <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Collections</h3>
 <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
 <table className="w-full text-sm min-w-[700px]">
 <thead className="bg-gray-100 dark:bg-gray-800">
 <tr>
 <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">Collection</th>
 {COLLECTION_PERMS.map((p) => (
 <th key={p} className="text-center px-3 py-2 text-gray-500 dark:text-gray-400 font-medium capitalize">{p.replace("_", "")}</th>
 ))}
 </tr>
 </thead>
 <tbody>
 {collectionRows.map((row, i) => {
 const idx = pageRows.length + i;
 const isSystemCol = row.collectionType === "system";
 return (
 <tr key={row.resource_id} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}>
 <td className="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-[200px] truncate">{row.label}</td>
 {COLLECTION_PERMS.map((p) => {
 // Non-super tenants cannot grant write permissions on system collections
 const lockedBySystemRule = isSystemCol && !isSuperTenant && SYSTEM_COL_READONLY_PERMS.has(p);
 return (
 <td key={p} className="px-3 py-2 text-center">
 <input
 type="checkbox"
 className={checkboxClass}
 checked={lockedBySystemRule ? false : !!row.permissions[p]}
 onChange={() => toggle(idx, p)}
 disabled={isSystem || lockedBySystemRule || readOnly}
 title={lockedBySystemRule ? "System collections: read & export only" : undefined}
 />
 </td>
 );
 })}
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {!isSystem && !readOnly && (
 <Button
 onClick={handleSave}
 disabled={loading}
 className="bg-blue-50 dark:bg-blue-950 border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
 >
 <Save className="mr-2 h-4 w-4" />
 {loading ? "Saving..." : "Save Permissions"}
 </Button>
 )}

 {isSystem && !readOnly && (
 <p className="text-xs text-gray-500 dark:text-gray-400 italic">System policies cannot be edited.</p>
 )}
 </div>
 );
}