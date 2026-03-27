-- 00036_collection_relations.sql
-- Master-detail collection relationships: metadata column, backfill, indexes
-- See: docs/RELATIONS_PLAN.md

-- 1. Add metadata column to collections (collection-level config)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN collections.metadata IS
  'Collection-level config: display_key_fields, unique_constraints, effective_date_field, cascade_rules, child_tab_sort_order';

-- 2. Backfill: set relationship_style = "reference" for all existing relation fields
--    This ensures backward compatibility — existing M2O/O2O/M2M fields keep working
UPDATE collection_fields
SET options = options || '{"relationship_style": "reference"}'
WHERE field_type = 'relation'
  AND (options->>'relationship_style') IS NULL;

-- 3. Composite index for parent-child item lookups
--    The most common query pattern: filter items by (collection_id, tenant_id) + order by created_at
CREATE INDEX IF NOT EXISTS idx_items_collection_tenant_created
  ON collection_items (collection_id, tenant_id, created_at DESC);
