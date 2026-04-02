-- supabase/migrations/00060_multi_column_catalogs.sql

-- Add columns JSONB to content_catalogs
ALTER TABLE public.content_catalogs ADD COLUMN columns JSONB DEFAULT NULL;

-- Add data JSONB to content_catalog_items
ALTER TABLE public.content_catalog_items ADD COLUMN data JSONB DEFAULT '{}';

-- Add comment explaining columns field
COMMENT ON COLUMN public.content_catalogs.columns IS
  'Schema definition: array of column definitions with key, type, required, unique, description';

-- Add comment explaining data field
COMMENT ON COLUMN public.content_catalog_items.data IS
  'Extra fields beyond label/value, keyed by column key from catalog schema';

-- Create GIN index on data JSONB for performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_catalog_items_data ON public.content_catalog_items USING GIN(data);
