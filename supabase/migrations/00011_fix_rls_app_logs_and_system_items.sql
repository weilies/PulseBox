-- Fix 1: app_logs insert policy
-- The current policy requires auth.uid() = user_id, but the client logger
-- may flush before user_id is resolved (null), causing all inserts to fail.
-- Fix: allow any authenticated user to insert logs.

DROP POLICY IF EXISTS "Users can insert own logs" ON public.app_logs;

CREATE POLICY "Users can insert own logs" ON public.app_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- Fix 2: collection_items policies for system collections (tenant_id IS NULL)
-- After migration 00010, system collection items have tenant_id = NULL.
-- NULL IN (...) always returns false, so super_admins couldn't insert/select
-- system items. Add super_admin bypass to all collection_items policies.

DROP POLICY IF EXISTS "collection_items_select" ON public.collection_items;
CREATE POLICY "collection_items_select" ON public.collection_items
  FOR SELECT USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR (tenant_id IS NULL AND public.is_super_admin())
  );

DROP POLICY IF EXISTS "collection_items_insert" ON public.collection_items;
CREATE POLICY "collection_items_insert" ON public.collection_items
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR (tenant_id IS NULL AND public.is_super_admin())
  );

DROP POLICY IF EXISTS "collection_items_update" ON public.collection_items;
CREATE POLICY "collection_items_update" ON public.collection_items
  FOR UPDATE USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR (tenant_id IS NULL AND public.is_super_admin())
  );

DROP POLICY IF EXISTS "collection_items_delete" ON public.collection_items;
CREATE POLICY "collection_items_delete" ON public.collection_items
  FOR DELETE USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR (tenant_id IS NULL AND public.is_super_admin())
  );


-- Fix 3: audit table also needs the same fix for system items
DROP POLICY IF EXISTS "audit_select" ON public.collection_items_audit;
CREATE POLICY "audit_select" ON public.collection_items_audit
  FOR SELECT USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR (tenant_id IS NULL AND public.is_super_admin())
  );
