"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import { TableRow, TableHead } from "@/components/ui/table";
import { X } from "lucide-react";

export type FilterColumn = {
  /** DB column or field slug */
  key: string;
  type: "text" | "select" | "none";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type TableFiltersProps = {
  columns: FilterColumn[];
};

export function TableFilters({ columns }: TableFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAnyFilter = columns.some(
    (col) => col.type !== "none" && searchParams.get(`f_${col.key}`)
  );

  const pushFilters = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(`f_${key}`, value);
      } else {
        params.delete(`f_${key}`);
      }
      params.set("page", "1"); // reset to page 1 on filter change
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, searchParams, pathname]
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const col of columns) {
      params.delete(`f_${col.key}`);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [router, searchParams, pathname, columns]);

  return (
    <TableRow className="border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-transparent">
      {columns.map((col) => (
        <TableHead key={col.key} className="py-1.5 px-2">
          {col.type === "text" && (
            <input
              type="text"
              placeholder={col.placeholder ?? "Filter..."}
              defaultValue={searchParams.get(`f_${col.key}`) ?? ""}
              className="w-full h-7 px-2 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  pushFilters(col.key, (e.target as HTMLInputElement).value);
                }
              }}
              onChange={(e) => {
                // Debounce auto-apply on change
                if (debounceRef.current) clearTimeout(debounceRef.current);
                const val = e.target.value;
                debounceRef.current = setTimeout(() => {
                  pushFilters(col.key, val);
                }, 500);
              }}
            />
          )}
          {col.type === "select" && (
            <select
              value={searchParams.get(`f_${col.key}`) ?? ""}
              onChange={(e) => pushFilters(col.key, e.target.value)}
              className="w-full h-7 px-1.5 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
            >
              <option value="">All</option>
              {(col.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </TableHead>
      ))}
      {/* Clear all button in the last cell if any filter is active */}
      {hasAnyFilter && (
        <TableHead className="py-1.5 px-1">
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-0.5 h-7 px-1.5 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
            title="Clear all filters"
          >
            <X className="h-3 w-3" />
          </button>
        </TableHead>
      )}
    </TableRow>
  );
}
