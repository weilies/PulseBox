import Link from "next/link";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { buildGridUrl } from "@/lib/data-grid";

type SortableHeadProps = {
  label: string;
  field: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  basePath: string;
  /** All current searchParams to preserve filters/page state */
  currentParams?: Record<string, string>;
  className?: string;
};

export function SortableHead({
  label,
  field,
  currentSort,
  currentDir,
  basePath,
  currentParams,
  className,
}: SortableHeadProps) {
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";

  // Separate filters and extra params
  const filters: Record<string, string> = {};
  const extra: Record<string, string> = {};
  if (currentParams) {
    for (const [k, v] of Object.entries(currentParams)) {
      if (k.startsWith("f_") && v) {
        filters[k.slice(2)] = v;
      } else if (!["sort", "dir", "page"].includes(k) && v) {
        extra[k] = v;
      }
    }
  }

  const href = buildGridUrl(basePath, {
    sortCol: field,
    ascending: nextDir === "asc",
    page: 1,
    filters,
  }, extra);

  return (
    <TableHead className={`text-gray-500 dark:text-gray-400 ${className ?? ""}`}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap ${
          isActive ? "text-blue-600 dark:text-blue-400" : ""
        }`}
      >
        {label}
        {isActive && currentDir === "desc" && <ChevronDown className="h-3 w-3" />}
        {isActive && currentDir === "asc" && <ChevronUp className="h-3 w-3" />}
        {!isActive && <ChevronsUpDown className="h-3 w-3 opacity-30" />}
      </Link>
    </TableHead>
  );
}
