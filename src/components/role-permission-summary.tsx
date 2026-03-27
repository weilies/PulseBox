"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
 Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ListChecks } from "lucide-react";
import { PAGE_LABELS, COLLECTION_PERMS } from "@/lib/services/permissions.service";

interface SummaryData {
 pages: Array<{ slug: string; access: boolean }>;
 collections: Array<{ id: string; name: string; type: string; permissions: Record<string, boolean> }>;
}

export function RolePermissionSummary({ summaryData }: { summaryData: SummaryData }) {
 const [open, setOpen] = useState(false);

 const checkboxClass = "w-4 h-4 rounded accent-blue-400 pointer-events-none";
 const activeCollections = summaryData.collections.filter(
  (c) => Object.values(c.permissions).some(Boolean)
 );

 return (
  <>
   <Button
    variant="outline"
    size="sm"
    onClick={() => setOpen(true)}
    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
   >
    <ListChecks className="mr-2 h-4 w-4" />
    Summarize
   </Button>

   <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
     <DialogHeader>
      <DialogTitle>Effective Permissions Summary</DialogTitle>
      <DialogDescription>
       Combined view across all assigned policies. If at least one policy grants access, the item shows as checked.
      </DialogDescription>
     </DialogHeader>

     <div className="space-y-6 mt-4">
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
          {summaryData.pages.map((page, i) => (
           <tr key={page.slug} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}>
            <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{PAGE_LABELS[page.slug] ?? page.slug}</td>
            <td className="px-4 py-2 text-center">
             <input type="checkbox" className={checkboxClass} checked={page.access} readOnly />
            </td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
      </div>

      {/* Collections */}
      {activeCollections.length > 0 && (
       <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Collections</h3>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto">
         <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-100 dark:bg-gray-800">
           <tr>
            <th className="text-left px-4 py-2 text-gray-500 dark:text-gray-400 font-medium">Collection</th>
            {COLLECTION_PERMS.map((p) => (
             <th key={p} className="text-center px-3 py-2 text-gray-500 dark:text-gray-400 font-medium capitalize text-xs">{p.replace("_", "")}</th>
            ))}
           </tr>
          </thead>
          <tbody>
           {activeCollections.map((col, i) => (
            <tr key={col.id} className={`border-t border-gray-100 dark:border-gray-800 ${i % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"}`}>
             <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{col.name} ({col.type})</td>
             {COLLECTION_PERMS.map((p) => (
              <td key={p} className="px-3 py-2 text-center">
               <input type="checkbox" className={checkboxClass} checked={!!col.permissions[p]} readOnly />
              </td>
             ))}
            </tr>
           ))}
          </tbody>
         </table>
        </div>
       </div>
      )}

      {activeCollections.length === 0 && (
       <p className="text-sm text-gray-500 dark:text-gray-400 italic">No collection permissions granted.</p>
      )}
     </div>
    </DialogContent>
   </Dialog>
  </>
 );
}
