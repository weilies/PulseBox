-- ============================================================
-- 00045_apps_bundle.sql
-- App Bundle Model: apps, app_installs tables
-- + app_id FK on collections
-- + accessible_page seed for app-store
-- ============================================================

-- ----------------------------------------------------------
-- apps table
-- ----------------------------------------------------------
CREATE TABLE public.apps (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  name         text NOT NULL,
  description  text,
  version      text NOT NULL DEFAULT '1.0.0',
  category     text NOT NULL DEFAULT 'platform',  -- hr | finance | operations | platform
  author       text NOT NULL DEFAULT 'nextnovas',
  icon         text,                              -- lucide icon name
  is_system    boolean NOT NULL DEFAULT true,
  bundle       jsonb NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'draft',    -- draft | published
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- app_installs table
-- ----------------------------------------------------------
CREATE TABLE public.app_installs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  app_id        uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  installed_at  timestamptz NOT NULL DEFAULT now(),
  installed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  config        jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'active',  -- active | disabled
  UNIQUE(tenant_id, app_id)
);

-- ----------------------------------------------------------
-- Add app_id FK to collections (nullable — not all collections belong to an app)
-- ----------------------------------------------------------
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS app_id uuid REFERENCES public.apps(id) ON DELETE SET NULL;

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------
CREATE INDEX idx_apps_status ON public.apps(status);
CREATE INDEX idx_app_installs_tenant ON public.app_installs(tenant_id);
CREATE INDEX idx_app_installs_app ON public.app_installs(app_id);
CREATE INDEX idx_collections_app_id ON public.collections(app_id);

-- ----------------------------------------------------------
-- RLS: apps
-- ----------------------------------------------------------
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read published apps
CREATE POLICY "Authenticated users read published apps"
  ON public.apps FOR SELECT
  TO authenticated
  USING (status = 'published' OR is_system = true);

-- Super admins read all apps (including drafts)
CREATE POLICY "Super admins read all apps"
  ON public.apps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role = 'super_admin'
        AND t.is_super = true
    )
  );

-- Only super admins can insert/update/delete apps
CREATE POLICY "Super admins manage apps"
  ON public.apps FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role = 'super_admin'
        AND t.is_super = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role = 'super_admin'
        AND t.is_super = true
    )
  );

-- ----------------------------------------------------------
-- RLS: app_installs
-- ----------------------------------------------------------
ALTER TABLE public.app_installs ENABLE ROW LEVEL SECURITY;

-- Tenant users read their own installs
CREATE POLICY "Tenant users read own app installs"
  ON public.app_installs FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

-- Super admins read all installs
CREATE POLICY "Super admins read all app installs"
  ON public.app_installs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      JOIN public.tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid()
        AND tu.role = 'super_admin'
        AND t.is_super = true
    )
  );

-- Tenant admin can install/update their own tenant's installs
CREATE POLICY "Tenant admin manages own app installs"
  ON public.app_installs FOR ALL
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

-- ----------------------------------------------------------
-- Seed: nav_items for app-store is handled via sidebar PAGE_CONFIG (no DB table)
-- ----------------------------------------------------------

-- ----------------------------------------------------------
-- Seed: 3 starter apps (published, minimal bundle)
-- ----------------------------------------------------------
INSERT INTO public.apps (slug, name, description, version, category, author, icon, is_system, bundle, status)
VALUES
(
  'workforce',
  'Workforce Management',
  'Core employee records, org structure, and employment history. Foundation for all HR modules.',
  '1.0.0',
  'hr',
  'nextnovas',
  'users',
  true,
  '{
    "collections": [],
    "fields": [],
    "content_catalogs": [],
    "nav_folders": [],
    "nav_items": [],
    "default_policies": [],
    "rules": []
  }'::jsonb,
  'published'
),
(
  'leave',
  'Leave Management',
  'Leave types, entitlements, application workflow, and balance tracking.',
  '1.0.0',
  'hr',
  'nextnovas',
  'calendar-days',
  true,
  '{
    "collections": [],
    "fields": [],
    "content_catalogs": [],
    "nav_folders": [],
    "nav_items": [],
    "default_policies": [],
    "rules": []
  }'::jsonb,
  'published'
),
(
  'payroll',
  'Payroll',
  'Salary computation, tax derivations, payslip generation, and bank file exports.',
  '1.0.0',
  'hr',
  'nextnovas',
  'banknote',
  true,
  '{
    "collections": [],
    "fields": [],
    "content_catalogs": [],
    "nav_folders": [],
    "nav_items": [],
    "default_policies": [],
    "rules": []
  }'::jsonb,
  'published'
)
ON CONFLICT (slug) DO NOTHING;
