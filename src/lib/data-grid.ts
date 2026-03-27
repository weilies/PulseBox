/**
 * Shared constants and utilities for paginated, sortable, filterable data grids.
 */

export const PAGE_SIZE = 20;

export type SortDefault = "asc" | "desc";

export type GridColumnConfig = {
  field: string;
  defaultDir: SortDefault;
};

export type GridConfig = {
  /** Columns that can be sorted. First entry is the default sort. */
  sortable: GridColumnConfig[];
  /** Columns that can be filtered via URL params (f_{field}). */
  filterable?: string[];
};

export type GridParams = {
  page: number;
  sortCol: string;
  ascending: boolean;
  filters: Record<string, string>;
};

/**
 * Parse searchParams into validated grid state.
 */
export function buildGridParams(
  searchParams: Record<string, string | string[] | undefined>,
  config: GridConfig
): GridParams {
  const page = Math.max(1, parseInt(String(searchParams.page ?? "1")));

  const sortParam = String(searchParams.sort ?? "");
  const match = config.sortable.find((c) => c.field === sortParam);
  const defaultCol = config.sortable[0];

  const sortCol = match?.field ?? defaultCol?.field ?? "created_at";
  const defaultDir = match?.defaultDir ?? defaultCol?.defaultDir ?? "desc";

  const dirParam = String(searchParams.dir ?? "");
  const ascending =
    dirParam === "asc" ? true : dirParam === "desc" ? false : defaultDir === "asc";

  // Collect f_* filter params
  const filters: Record<string, string> = {};
  const allowed = new Set(config.filterable ?? []);
  for (const [key, val] of Object.entries(searchParams)) {
    if (key.startsWith("f_") && val) {
      const col = key.slice(2);
      if (allowed.size === 0 || allowed.has(col)) {
        filters[col] = String(val);
      }
    }
  }

  return { page, sortCol, ascending, filters };
}

/**
 * Build a URL string with grid state (sort, dir, page, filters).
 * Strips empty filter values.
 */
export function buildGridUrl(
  basePath: string,
  params: Partial<GridParams> & { page?: number; sortCol?: string; ascending?: boolean },
  /** Extra non-grid params to preserve in the URL (e.g. tenant) */
  extra?: Record<string, string>
): string {
  const parts = new URLSearchParams();

  // Preserve extra params first
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) parts.set(k, v);
    }
  }

  if (params.sortCol) parts.set("sort", params.sortCol);
  if (params.ascending !== undefined) parts.set("dir", params.ascending ? "asc" : "desc");
  if (params.page && params.page > 1) parts.set("page", String(params.page));

  if (params.filters) {
    for (const [k, v] of Object.entries(params.filters)) {
      if (v) parts.set(`f_${k}`, v);
    }
  }

  const qs = parts.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
