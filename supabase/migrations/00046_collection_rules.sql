-- ============================================================
-- 00046_collection_rules.sql
-- Rule Engine v1: collection_rules table
-- ============================================================

CREATE TABLE public.collection_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL,
  app_id          uuid REFERENCES public.apps(id) ON DELETE SET NULL,
  tenant_id       uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- NULL tenant_id = platform-wide rule (applies to all tenants)
  rule_type       text NOT NULL CHECK (rule_type IN ('validation', 'derivation')),
  name            text NOT NULL,
  description     text,
  priority        integer NOT NULL DEFAULT 10,
  is_active       boolean NOT NULL DEFAULT true,
  conditions      jsonb NOT NULL DEFAULT 'null',
  -- null or { "logic": "AND"|"OR", "rules": [{ "field": "...", "op": "...", "value": ... }] }
  actions         jsonb NOT NULL DEFAULT '{}',
  -- validation: { "type": "validation", "field": "...", "op": "...", "value": ..., "message": "..." }
  -- derivation:  { "type": "derivation", "target_field": "...", "formula": "..." }
  require_parent  boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for the most common query: all active rules for a collection
CREATE INDEX idx_collection_rules_slug_active
  ON public.collection_rules(collection_slug, is_active);

CREATE INDEX idx_collection_rules_tenant
  ON public.collection_rules(tenant_id);

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------
ALTER TABLE public.collection_rules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read platform-wide rules (tenant_id IS NULL)
CREATE POLICY "Authenticated users read platform rules"
  ON public.collection_rules FOR SELECT
  TO authenticated
  USING (tenant_id IS NULL);

-- Tenant users can read their own tenant rules
CREATE POLICY "Tenant users read own rules"
  ON public.collection_rules FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- Super admins can write platform rules (tenant_id IS NULL)
CREATE POLICY "Super admins manage platform rules"
  ON public.collection_rules FOR ALL
  TO authenticated
  USING (
    tenant_id IS NULL AND
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role = 'super_admin'
        AND t.is_super = true
    )
  )
  WITH CHECK (
    tenant_id IS NULL AND
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role = 'super_admin'
        AND t.is_super = true
    )
  );

-- Tenant admins can manage their own tenant's rules
CREATE POLICY "Tenant admins manage own rules"
  ON public.collection_rules FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
        AND role IN ('tenant_admin', 'super_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE user_id = auth.uid()
        AND role IN ('tenant_admin', 'super_admin')
    )
  );
