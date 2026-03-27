/**
 * Types for master-detail collection relationships.
 * See: docs/RELATIONS_PLAN.md
 */

/** Relationship style for relation fields */
export type RelationshipStyle = "child_of" | "reference" | "link";

/** Relation field options (stored in collection_fields.options) */
export type RelationFieldOptions = {
  related_collection_id: string;
  relation_type: "m2o" | "o2o" | "m2m";
  relationship_style: RelationshipStyle;
  junction_collection_id?: string;       // m2m only
  display_field_slug?: string;           // field on related collection to show as label
};

/** Cascade rule for parent deletion */
export type CascadeAction = "cascade" | "restrict" | "nullify";

/** Collection-level metadata (stored in collections.metadata JSONB) */
export type CollectionMetadata = {
  /** Field slug(s) that form the business/display key */
  display_key_fields?: string[];
  /** Composite uniqueness constraints — array of field slug arrays */
  unique_constraints?: string[][];
  /** Date field slug used for effective dating */
  effective_date_field?: string;
  /** Cascade behavior when a parent item is deleted */
  cascade_rules?: {
    on_parent_delete: CascadeAction;
  };
  /** Sort order when this collection appears as a child tab */
  child_tab_sort_order?: number;
};

/** A child collection descriptor returned by getChildCollections() */
export type ChildCollectionDescriptor = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  /** The child_of relation field slug on this child collection */
  fieldSlug: string;
  metadata: CollectionMetadata;
  childTabSortOrder: number;
};
