-- Rename Global Lists → Content Catalogs (tables, columns, JSONB keys)

-- 1. Rename tables
ALTER TABLE global_lists RENAME TO content_catalogs;
ALTER TABLE global_list_items RENAME TO content_catalog_items;

-- 2. Rename FK column
ALTER TABLE content_catalog_items RENAME COLUMN list_id TO catalog_id;

-- 3. Rename JSONB key in collection_fields.options:
--    "global_list_slug" → "catalog_slug"
UPDATE collection_fields
SET options = (options - 'global_list_slug') || jsonb_build_object('catalog_slug', options->'global_list_slug')
WHERE options ? 'global_list_slug';
