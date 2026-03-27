-- 00038_audit_tenant_nullable.sql
-- collection_items_audit.tenant_id must allow NULL for system collection items.
-- System collections set tenant_id = null on collection_items, so the audit
-- trigger was failing with "not-null constraint" when inserting system item audits.

ALTER TABLE public.collection_items_audit
  ALTER COLUMN tenant_id DROP NOT NULL;
