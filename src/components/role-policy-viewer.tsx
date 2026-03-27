"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ListChecks, FileKey } from "lucide-react";
import { PolicyPermissionsEditor } from "@/components/policy-permissions-editor";
import { PAGE_LABELS, COLLECTION_PERMS } from "@/lib/services/permissions.service";

type PolicyShape = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  policy_permissions: Array<{
    resource_type: "page" | "collection";
    resource_id: string;
    permissions: Record<string, boolean>;
  }>;
};

interface SummaryData {
  pages: Array<{ slug: string; access: boolean }>;
  collections: Array<{ id: string; name: string; type: string; permissions: Record<string, boolean> }>;
}

interface RolePolicyViewerProps {
  policies: PolicyShape[];
  summaryData: SummaryData;
  pages: string[];
  collections: Array<{ id: string; name: string; type: string }>;
  isSuperTenant: boolean;
}

export function RolePolicyViewer({
  policies,
  summaryData,
  pages,
  collections,
  isSuperTenant,
}: RolePolicyViewerProps) {
  const [mode, setMode] = useState<"details" | "summary">("details");
  const [currentIdx, setCurrentIdx] = useState(0);

  if (policies.length === 0) return null;

  const checkboxClass = "w-4 h-4 rounded accent-blue-400 pointer-events-none";
  const activeCollections = summaryData.collections.filter(
    (c) => Object.values(c.permissions).some(Boolean)
  );
  const currentPolicy = policies[currentIdx];

  return (
    <div className="space-y-4">
      {/* Section header with toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {mode === "details" ? "Policy Details" : "Policy Summary"}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMode(mode === "details" ? "summary" : "details")}
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ListChecks className="mr-2 h-4 w-4" />
          {mode === "details" ? "Summarize" : "Policy Details"}
        </Button>
      </div>

      {mode === "details" && (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileKey className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-gray-900 dark:text-gray-100 text-base">
                  {currentPolicy.name}
                </CardTitle>
                {currentPolicy.is_system && (
                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-400 text-xs">System</Badge>
                )}
              </div>
              {/* Prev/Next navigation */}
              <div className="flex items-center gap-1">
                {policies.length > 1 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">
                    {currentIdx + 1} / {policies.length}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                  title="Previous policy"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentIdx((i) => Math.min(policies.length - 1, i + 1))}
                  disabled={currentIdx === policies.length - 1}
                  title="Next policy"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {currentPolicy.description && (
              <CardDescription className="text-gray-500 dark:text-gray-400">
                {currentPolicy.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <PolicyPermissionsEditor
              policyId={currentPolicy.id}
              isSystem={currentPolicy.is_system}
              isSuperTenant={isSuperTenant}
              readOnly
              initialPermissions={currentPolicy.policy_permissions}
              pages={pages}
              collections={collections}
            />
          </CardContent>
        </Card>
      )}

      {mode === "summary" && (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <CardContent className="pt-6 space-y-6">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Combined view across all assigned policies. If at least one policy grants access, the item shows as checked.
            </p>

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
            {activeCollections.length > 0 ? (
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
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No collection permissions granted.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
