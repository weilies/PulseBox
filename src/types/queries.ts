// =============================================================================
// Query Generator — Type definitions
// =============================================================================

export type JoinType = "inner" | "left" | "right" | "full";

export type FilterOperator =
  | "="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "contains"
  | "starts_with"
  | "ends_with"
  | "is_null"
  | "is_not_null"
  | "in";

export type AggregateFunction = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export type FilterLogic = "and" | "or";

export interface QueryCollectionRef {
  id: string;
  slug: string;
  alias: string; // e.g. "A", "B", "C"
}

export interface QueryJoin {
  type: JoinType;
  left: { alias: string; field: string };
  right: { alias: string; field: string };
}

export interface QueryField {
  alias: string;
  field: string;
  display?: string; // custom column name in output
}

export interface QueryFilter {
  alias: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
  logic: FilterLogic; // how this connects to the NEXT filter
}

export interface QueryAggregation {
  function: AggregateFunction;
  alias: string;
  field: string; // "*" for COUNT(*)
  output_name: string;
}

export interface QueryGroupBy {
  alias: string;
  field: string;
}

export interface QuerySort {
  alias: string;
  field: string;
  direction: "asc" | "desc";
}

export interface QueryDefinition {
  collections: QueryCollectionRef[];
  joins: QueryJoin[];
  fields: QueryField[];
  filters: QueryFilter[];
  aggregations: QueryAggregation[];
  group_by: QueryGroupBy[];
  sort: QuerySort[];
  limit: number;
}

export type QueryStatus = "draft" | "published";

export interface SavedQuery {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: QueryStatus;
  definition: QueryDefinition;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the query engine after execution */
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  execution_ms: number;
}

/** Empty definition for new queries */
export const EMPTY_DEFINITION: QueryDefinition = {
  collections: [],
  joins: [],
  fields: [],
  filters: [],
  aggregations: [],
  group_by: [],
  sort: [],
  limit: 500,
};
