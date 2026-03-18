-- Make collection_items.tenant_id nullable so system collection items have no tenant
ALTER TABLE collection_items ALTER COLUMN tenant_id DROP NOT NULL;

-- Drop module_id from collections (modules feature removed)
-- CASCADE drops dependent RLS policies (collections_select, collection_fields_select)
-- and the tenant_collection_no_module check constraint
ALTER TABLE collections DROP COLUMN IF EXISTS module_id CASCADE;

-- Recreate collections_select without module licensing logic:
-- system collections visible to all authenticated users; tenant collections scoped to own tenant
CREATE POLICY "collections_select" ON public.collections
  FOR SELECT USING (
    public.is_super_admin()
    OR (type = 'tenant' AND tenant_id IN (SELECT public.get_my_tenant_ids()))
    OR type = 'system'
  );

-- Recreate collection_fields_select to mirror parent collection visibility
CREATE POLICY "collection_fields_select" ON public.collection_fields
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_id
        AND (
          public.is_super_admin()
          OR (c.type = 'tenant' AND c.tenant_id IN (SELECT public.get_my_tenant_ids()))
          OR c.type = 'system'
        )
    )
  );
