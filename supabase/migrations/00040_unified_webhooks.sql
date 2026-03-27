-- ============================================================================
-- Unified Webhooks & Event Logs
-- Merges collection_webhooks + collections.hooks into a single webhooks table.
-- Replaces webhook_deliveries with a general-purpose event_logs table.
-- ============================================================================

-- 1. Unified webhooks table
CREATE TABLE IF NOT EXISTS public.webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  secret      TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  scope_type  TEXT NOT NULL DEFAULT 'collection',   -- 'collection' | 'auth' | 'system'
  scope_id    TEXT,                                  -- collection slug (null for auth/system)
  events      TEXT[] NOT NULL DEFAULT '{}',          -- e.g. {'item.created','item.pre_save','auth.login'}
  can_block   BOOLEAN NOT NULL DEFAULT false,        -- true = response can reject the action (pre_save, auth gate)
  config      JSONB NOT NULL DEFAULT '{}',           -- { timeout_ms, fail_strict, ... }
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_tenant ON public.webhooks(tenant_id);
CREATE INDEX idx_webhooks_scope ON public.webhooks(scope_type, scope_id);
CREATE INDEX idx_webhooks_events ON public.webhooks USING GIN(events);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks_tenant_isolation" ON public.webhooks
  FOR ALL USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.is_active = true
    )
  );

-- 2. Unified event_logs table
CREATE TABLE IF NOT EXISTS public.event_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,              -- 'webhook', 'api', 'auth', 'data', 'email'
  event_type      TEXT NOT NULL,              -- 'item.created', 'auth.login', etc.
  source_type     TEXT,                       -- 'webhook', 'api', 'user', 'system'
  source_id       TEXT,                       -- webhook id, api key id, etc.
  actor_id        UUID,                       -- user who triggered
  actor_type      TEXT DEFAULT 'user',        -- 'user', 'system', 'api'
  scope_type      TEXT,                       -- 'collection', 'auth'
  scope_id        TEXT,                       -- collection slug
  request_url     TEXT,
  request_body    JSONB,
  response_status INTEGER,
  response_body   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'delivered', 'failed', 'blocked', 'pending'
  duration_ms     INTEGER,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_logs_tenant ON public.event_logs(tenant_id);
CREATE INDEX idx_event_logs_category ON public.event_logs(category);
CREATE INDEX idx_event_logs_created ON public.event_logs(created_at DESC);
CREATE INDEX idx_event_logs_source ON public.event_logs(source_type, source_id);
CREATE INDEX idx_event_logs_scope ON public.event_logs(scope_type, scope_id);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_logs_tenant_isolation" ON public.event_logs
  FOR ALL USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid() AND tu.is_active = true
    )
  );

-- 3. Migrate data from collection_webhooks → webhooks (outbound webhooks)
INSERT INTO public.webhooks (id, tenant_id, name, url, secret, is_active, scope_type, scope_id, events, can_block, config, created_by, created_at, updated_at)
SELECT
  id, tenant_id, name, url, secret, is_active,
  'collection', collection_slug,
  events,
  false,        -- outbound webhooks never block
  '{}',
  created_by, created_at, COALESCE(updated_at, created_at)
FROM public.collection_webhooks;

-- 4. Migrate collections.hooks.on_pre_save → webhooks (blocking)
INSERT INTO public.webhooks (tenant_id, name, url, secret, is_active, scope_type, scope_id, events, can_block, config, created_at, updated_at)
SELECT
  c.tenant_id,
  'onPreSave – ' || c.name,
  (c.hooks->'on_pre_save'->>'url'),
  (c.hooks->'on_pre_save'->>'secret'),
  true,
  'collection',
  c.slug,
  ARRAY['item.pre_save'],
  true,
  jsonb_build_object(
    'timeout_ms', COALESCE((c.hooks->'on_pre_save'->>'timeout_ms')::int, 5000),
    'fail_strict', COALESCE((c.hooks->'on_pre_save'->>'fail_strict')::boolean, false)
  ),
  now(), now()
FROM public.collections c
WHERE c.tenant_id IS NOT NULL
  AND c.hooks->'on_pre_save'->>'url' IS NOT NULL
  AND c.hooks->'on_pre_save'->>'url' != '';

-- 5. Migrate collections.hooks.on_post_save → webhooks (non-blocking)
INSERT INTO public.webhooks (tenant_id, name, url, secret, is_active, scope_type, scope_id, events, can_block, config, created_at, updated_at)
SELECT
  c.tenant_id,
  'onPostSave – ' || c.name,
  (c.hooks->'on_post_save'->>'url'),
  (c.hooks->'on_post_save'->>'secret'),
  true,
  'collection',
  c.slug,
  ARRAY['item.post_save'],
  false,
  '{}',
  now(), now()
FROM public.collections c
WHERE c.tenant_id IS NOT NULL
  AND c.hooks->'on_post_save'->>'url' IS NOT NULL
  AND c.hooks->'on_post_save'->>'url' != '';

-- 6. Migrate webhook_deliveries → event_logs
INSERT INTO public.event_logs (id, tenant_id, category, event_type, source_type, source_id, scope_type, scope_id, status, response_status, response_body, created_at)
SELECT
  wd.id,
  cw.tenant_id,
  'webhook',
  wd.event_type,
  'webhook',
  wd.webhook_id::text,
  'collection',
  cw.collection_slug,
  wd.status,
  wd.response_status,
  wd.response_body,
  wd.created_at
FROM public.webhook_deliveries wd
JOIN public.collection_webhooks cw ON cw.id = wd.webhook_id;

-- 7. Add logs page to accessible pages
CREATE OR REPLACE FUNCTION public.get_accessible_pages()
RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF public.is_super_admin() THEN
    RETURN QUERY VALUES
      ('dashboard'),
      ('users'),
      ('tenants'),
      ('studio.system-collections'),
      ('studio.content-catalog'),
      ('studio.tenant-collections'),
      ('studio.navigations'),
      ('studio.queries'),
      ('studio.logs'),
      ('roles'),
      ('policies'),
      ('apps'),
      ('webhooks');
    RETURN;
  END IF;

  RETURN QUERY
    SELECT DISTINCT pp.resource_id
    FROM public.tenant_users tu
    JOIN public.role_policies rp ON rp.role_id = tu.role_id
    JOIN public.policy_permissions pp ON pp.policy_id = rp.policy_id
    WHERE tu.user_id = auth.uid()
      AND tu.is_active = true
      AND pp.resource_type = 'page'
      AND (pp.permissions ->> 'access')::boolean = true;
END;
$$;
