-- supabase/migrations/00059_user_mgmt_audit_indexes.sql
-- Add indexes and constraints to user_mgmt_audit table

-- Performance indexes for common query patterns
CREATE INDEX idx_user_mgmt_audit_tenant_created
  ON public.user_mgmt_audit(tenant_id, created_at DESC);

CREATE INDEX idx_user_mgmt_audit_actor
  ON public.user_mgmt_audit(actor_id, tenant_id);

CREATE INDEX idx_user_mgmt_audit_action
  ON public.user_mgmt_audit(tenant_id, action);

-- Enum constraints for data integrity
ALTER TABLE public.user_mgmt_audit
  ADD CONSTRAINT user_mgmt_audit_actor_type_check
    CHECK (actor_type IN ('user', 'system'));

ALTER TABLE public.user_mgmt_audit
  ADD CONSTRAINT user_mgmt_audit_target_type_check
    CHECK (target_type IN ('user', 'role', 'policy'));

ALTER TABLE public.user_mgmt_audit
  ADD CONSTRAINT user_mgmt_audit_status_check
    CHECK (status IN ('success', 'failed'));
