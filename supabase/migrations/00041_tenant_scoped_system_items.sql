-- Migration: Tenant-scope system collection items
-- Previously, system collection items had tenant_id = NULL (super-admin only).
-- Going forward, every item belongs to the tenant that created it — schema is
-- shared, but data is per-tenant (same as tenant collections).
-- ============================================================

-- Step 1: Backfill existing null-tenant items to the super tenant
-- (all null-tenant items were created by super-admin users who belong to the super tenant)
DO $$
DECLARE
  super_tenant_id UUID;
BEGIN
  SELECT id INTO super_tenant_id FROM public.tenants WHERE is_super = true LIMIT 1;

  IF super_tenant_id IS NOT NULL THEN
    UPDATE public.collection_items
    SET tenant_id = super_tenant_id
    WHERE tenant_id IS NULL;

    UPDATE public.collection_items_audit
    SET tenant_id = super_tenant_id
    WHERE tenant_id IS NULL;
  END IF;
END $$;

-- Step 2: Update collection_items RLS — drop the IS NULL super-admin bypass
-- (no longer needed since all items now carry a real tenant_id)
DROP POLICY IF EXISTS "collection_items_select" ON public.collection_items;
CREATE POLICY "collection_items_select" ON public.collection_items
  FOR SELECT USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

DROP POLICY IF EXISTS "collection_items_insert" ON public.collection_items;
CREATE POLICY "collection_items_insert" ON public.collection_items
  FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_my_tenant_ids()));

DROP POLICY IF EXISTS "collection_items_update" ON public.collection_items;
CREATE POLICY "collection_items_update" ON public.collection_items
  FOR UPDATE USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

DROP POLICY IF EXISTS "collection_items_delete" ON public.collection_items;
CREATE POLICY "collection_items_delete" ON public.collection_items
  FOR DELETE USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

-- Step 3: Update audit RLS to match
DROP POLICY IF EXISTS "audit_select" ON public.collection_items_audit;
CREATE POLICY "audit_select" ON public.collection_items_audit
  FOR SELECT USING (tenant_id IN (SELECT public.get_my_tenant_ids()));
