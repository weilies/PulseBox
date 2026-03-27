-- 00037_relation_performance_indexes.sql
-- Performance indexes for parent-child JSONB lookups and effective dating.

-- 1. Composite index for the most common child-item query pattern:
--    SELECT ... FROM collection_items WHERE collection_id = $1 AND tenant_id = $2 AND data->>$3 = $4
--    The GIN index on data supports this, but a B-tree index on collection_id + tenant_id
--    with created_at for ordering is more efficient for paginated reads.
--    (This may already exist from 00036 — IF NOT EXISTS makes it idempotent)
CREATE INDEX IF NOT EXISTS idx_items_collection_tenant_created
  ON collection_items (collection_id, tenant_id, created_at DESC);

-- 2. Index on collection_fields for relation field lookups
--    Used by getChildCollections() and display resolution
CREATE INDEX IF NOT EXISTS idx_fields_collection_type
  ON collection_fields (collection_id, field_type);

-- 3. Partial index on collection_items for items that have a non-null JSONB data
--    This helps the planner skip items with empty data in JSONB filter queries
CREATE INDEX IF NOT EXISTS idx_items_collection_id_data
  ON collection_items USING GIN (data)
  WHERE data IS NOT NULL AND data != '{}'::jsonb;
