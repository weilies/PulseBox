import Link from "next/link";
import { buildGridUrl } from "@/lib/data-grid";

type TablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  basePath: string;
  sortCol: string;
  ascending: boolean;
  /** All current searchParams to preserve filters */
  currentParams?: Record<string, string>;
};

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  basePath,
  sortCol,
  ascending,
  currentParams,
}: TablePaginationProps) {
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

  const buildPageUrl = (page: number) =>
    buildGridUrl(basePath, { sortCol, ascending, page, filters }, extra);

  return (
    <div className="space-y-2">
      {/* Item count + page info */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{totalItems} total item{totalItems !== 1 ? "s" : ""}</span>
        {totalPages > 1 && <span>Page {currentPage} of {totalPages}</span>}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="inline-flex items-center h-8 px-3 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 hover:border-blue-500/40 rounded-md transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="inline-flex items-center h-8 px-3 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 hover:border-blue-500/40 rounded-md transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
