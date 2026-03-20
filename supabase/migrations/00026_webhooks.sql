-- ============================================================
-- 00026_webhooks.sql
-- Outbound webhook subscriptions + delivery log + collection hooks
-- ============================================================

-- Add hooks config column to collections (stores onPreSave hook)
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS hooks jsonb NOT NULL DEFAULT '{}';

-- hooks JSONB schema:
-- {
--   "on_pre_save": {
--     "url":        "https://...",   -- called before save; non-2xx blocks write
--     "timeout_ms": 5000,            -- default: 5000
--     "secret":     "hmac-key",      -- optional HMAC-SHA256 signing key
--     "fail_strict": false           -- true = block save if hook unreachable
--   }
-- }


-- ============================================================
-- COLLECTION_WEBHOOKS (outbound HTTP subscriptions)
-- ============================================================

CREATE TABLE public.collection_webhooks (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  collection_slug text        NOT NULL,
  name            text        NOT NULL,
  url             text        NOT NULL,
  secret          text,                            -- HMAC-SHA256 signing secret
  events          text[]      NOT NULL DEFAULT '{}', -- item.created | item.updated | item.deleted
  is_active       boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_collection_webhooks_tenant ON public.collection_webhooks(tenant_id);
CREATE INDEX idx_collection_webhooks_slug   ON public.collection_webhooks(tenant_id, collection_slug);


-- ============================================================
-- WEBHOOK_DELIVERIES (immutable log — written by admin client)
-- ============================================================

CREATE TABLE public.webhook_deliveries (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      uuid        NOT NULL REFERENCES public.collection_webhooks(id) ON DELETE CASCADE,
  event_type      text        NOT NULL,
  collection_slug text        NOT NULL,
  item_id         text,
  payload         jsonb       NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'delivered', 'failed')),
  response_status int,
  response_body   text,
  attempt_count   int         NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_date    ON public.webhook_deliveries(created_at DESC);


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE public.collection_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries  ENABLE ROW LEVEL SECURITY;

-- Webhooks: tenant_admin+ can manage their tenant's webhooks
CREATE POLICY "webhooks_select" ON public.collection_webhooks
  FOR SELECT USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
  );

CREATE POLICY "webhooks_write" ON public.collection_webhooks
  FOR ALL USING (
    public.is_super_admin()
    OR public.get_my_role_in_tenant(tenant_id) = 'tenant_admin'
  );

-- Deliveries: read-only for tenant members
CREATE POLICY "webhook_deliveries_select" ON public.webhook_deliveries
  FOR SELECT USING (
    webhook_id IN (
      SELECT id FROM public.collection_webhooks
      WHERE tenant_id IN (SELECT public.get_my_tenant_ids())
    )
  );
