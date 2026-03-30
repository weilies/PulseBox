-- supabase/migrations/00058_user_mgmt_audit.sql

CREATE TABLE public.user_mgmt_audit (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id     UUID REFERENCES auth.users(id),
  actor_type   TEXT NOT NULL DEFAULT 'user',
  target_type  TEXT NOT NULL,   -- 'user' | 'role' | 'policy'
  target_id    TEXT NOT NULL,   -- UUID or slug of the affected entity
  target_label TEXT,            -- display name: email, role name, policy name
  action       TEXT NOT NULL,   -- e.g. 'user.created', 'role.deleted'
  old_data     JSONB,
  new_data     JSONB,
  status       TEXT NOT NULL DEFAULT 'success',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_mgmt_audit ENABLE ROW LEVEL SECURITY;

-- Tenant members may read their own tenant's audit entries.
-- Writes are done via service-role (admin client) — no INSERT policy needed.
CREATE POLICY "user_mgmt_audit_select" ON public.user_mgmt_audit
  FOR SELECT USING (
    tenant_id IN (
      SELECT tu.tenant_id
      FROM   public.tenant_users tu
      WHERE  tu.user_id   = auth.uid()
      AND    tu.is_active = true
    )
  );
