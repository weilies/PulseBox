-- ============================================================
-- 00015 Field-level Translations
--
-- Adds:
--   • is_translatable flag on collection_fields
--       Only text / richtext fields may be marked translatable.
--   • tenant_languages — per-tenant locale registry
--   • collection_item_translations — field-level translation values
--       Canonical value stays in collection_items.data;
--       translations hold locale overrides.
--   • Missing performance indexes on existing tables
--   • get_translated_value() fallback helper (exact → base → default)
--   • Trigger: cascade-delete translations when parent item is deleted
--       (item_id has no FK so we use a BEFORE DELETE trigger)
--   • RLS policies for both new tables
--   • Seed English as default language for all existing tenants
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- PART 1: is_translatable flag on collection_fields
-- ─────────────────────────────────────────────────────────────

ALTER TABLE collection_fields
  ADD COLUMN is_translatable BOOLEAN NOT NULL DEFAULT false;

-- Only text and richtext make sense as translatable content.
-- Structured types (number, date, boolean, file, relation, json) are locale-agnostic.
ALTER TABLE collection_fields
  ADD CONSTRAINT chk_translatable_field_type
  CHECK (is_translatable = false OR field_type IN ('text', 'richtext'));


-- ─────────────────────────────────────────────────────────────
-- PART 2: tenant_languages
-- Per-tenant registry of supported locales.
-- Every tenant must have exactly one is_default = true language
-- (enforced by partial unique index below).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE tenant_languages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  language_code VARCHAR(10) NOT NULL,   -- BCP 47: 'en', 'zh-CN', 'ms', 'th'
  language_name TEXT        NOT NULL,   -- 'English', '中文 (简体)', 'Bahasa Melayu'
  is_default    BOOLEAN     NOT NULL DEFAULT false,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_language UNIQUE(tenant_id, language_code)
);

-- Enforce exactly one default per tenant
CREATE UNIQUE INDEX idx_tenant_languages_default
  ON tenant_languages(tenant_id)
  WHERE is_default = true;

CREATE INDEX idx_tenant_languages_tenant
  ON tenant_languages(tenant_id);


-- ─────────────────────────────────────────────────────────────
-- PART 3: collection_item_translations
-- Stores translated values per item × field × locale.
-- The canonical (default-language) value stays in collection_items.data.
-- NULL value means "use fallback" — do not display empty string.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE collection_item_translations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID        NOT NULL,               -- no FK; cascade via trigger
  collection_id   UUID        NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tenant_id       UUID        REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL = system items
  field_slug      TEXT        NOT NULL,
  language_code   VARCHAR(10) NOT NULL,
  value           TEXT,                               -- NULL = explicitly cleared
  translated_by   UUID        REFERENCES auth.users(id),
  translated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_item_field_lang UNIQUE(item_id, field_slug, language_code)
);

-- Primary read path: "all translations for item X"
CREATE INDEX idx_cit_item_id
  ON collection_item_translations(item_id);

-- Read with locale filter: "translations for item X in locale Y"
-- Covered by the UNIQUE constraint but explicit index aids planner
CREATE INDEX idx_cit_item_lang
  ON collection_item_translations(item_id, language_code);

-- Bulk export: "all translations in collection X, locale Y"
CREATE INDEX idx_cit_collection_lang
  ON collection_item_translations(collection_id, language_code);

-- Tenant-scoped translation management / reporting
CREATE INDEX idx_cit_tenant_lang
  ON collection_item_translations(tenant_id, language_code)
  WHERE tenant_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- PART 4: Missing performance indexes on existing tables
--
-- Rationale for each index is noted inline.
-- ─────────────────────────────────────────────────────────────

-- collection_fields: loaded by collection_id on EVERY schema/items page.
-- This is the single most impactful missing index in the codebase —
-- every schema render, item form load, and export does a full table scan
-- on collection_fields without it.
CREATE INDEX idx_collection_fields_collection
  ON collection_fields(collection_id);

-- Ordered field list (schema page sorts by sort_order)
CREATE INDEX idx_collection_fields_collection_sort
  ON collection_fields(collection_id, sort_order);

-- collection_items: paginated queries filter (tenant_id, collection_id)
-- then ORDER BY created_at / updated_at. The existing composite index
-- (tenant_id, collection_id) covers the filter but not the sort.
-- These covering indexes eliminate the extra sort step.
CREATE INDEX idx_collection_items_pagination
  ON collection_items(tenant_id, collection_id, created_at DESC);

CREATE INDEX idx_collection_items_pagination_updated
  ON collection_items(tenant_id, collection_id, updated_at DESC);

-- content_catalog_items: fetched per catalog_id on every items page
-- that has a select/multiselect field backed by a catalog.
CREATE INDEX idx_catalog_items_catalog_sort
  ON content_catalog_items(catalog_id, sort_order);

CREATE INDEX idx_catalog_items_catalog_active
  ON content_catalog_items(catalog_id, is_active);

-- tenant_users: get_my_tenant_ids() is a SECURITY DEFINER function
-- called on every single RLS check in the system. It queries tenant_users
-- by user_id. This is the hottest query path — index is critical.
CREATE INDEX idx_tenant_users_user_active
  ON tenant_users(user_id, is_active);

CREATE INDEX idx_tenant_users_tenant
  ON tenant_users(tenant_id);

-- RBAC: has_permission() joins role_policies → policy_permissions.
-- Both lookups happen on every permission-gated page render.
CREATE INDEX idx_role_policies_policy
  ON role_policies(policy_id);

CREATE INDEX idx_policy_permissions_policy_type
  ON policy_permissions(policy_id, resource_type);

-- nav_items: sidebar loads items grouped by tenant + folder
CREATE INDEX idx_nav_items_tenant_folder
  ON nav_items(tenant_id, folder_id);


-- ─────────────────────────────────────────────────────────────
-- PART 5: Cascade-delete translations when parent item is deleted
-- We cannot use a FK on item_id (collection_items has no stable
-- referenced constraint that survives cross-table cascade), so we
-- use a BEFORE DELETE trigger instead.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cascade_delete_item_translations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM collection_item_translations WHERE item_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cascade_delete_item_translations
  BEFORE DELETE ON collection_items
  FOR EACH ROW EXECUTE FUNCTION cascade_delete_item_translations();


-- ─────────────────────────────────────────────────────────────
-- PART 6: get_translated_value() — fallback chain helper
--
-- Resolution order:
--   1. Exact locale   (e.g. 'zh-CN')
--   2. Base language  ('zh')
--   3. Caller-supplied fallback (usually the canonical data value)
--
-- Used by the future REST API layer for locale-aware responses.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_translated_value(
  p_item_id    UUID,
  p_field_slug TEXT,
  p_locale     TEXT,
  p_fallback   TEXT DEFAULT NULL
)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_value TEXT;
  v_base  TEXT;
BEGIN
  -- 1. Exact locale match
  SELECT value INTO v_value
  FROM collection_item_translations
  WHERE item_id      = p_item_id
    AND field_slug   = p_field_slug
    AND language_code = p_locale;
  IF FOUND AND v_value IS NOT NULL THEN RETURN v_value; END IF;

  -- 2. Base language fallback (zh-CN → zh)
  v_base := split_part(p_locale, '-', 1);
  IF v_base <> p_locale THEN
    SELECT value INTO v_value
    FROM collection_item_translations
    WHERE item_id      = p_item_id
      AND field_slug   = p_field_slug
      AND language_code = v_base;
    IF FOUND AND v_value IS NOT NULL THEN RETURN v_value; END IF;
  END IF;

  -- 3. Return caller-supplied fallback (canonical data value)
  RETURN p_fallback;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- PART 7: RLS policies
-- ─────────────────────────────────────────────────────────────

-- tenant_languages --
ALTER TABLE tenant_languages ENABLE ROW LEVEL SECURITY;

-- Any tenant member can read their tenant's languages
CREATE POLICY "tenant_members_read_languages"
  ON tenant_languages FOR SELECT
  USING (tenant_id IN (SELECT public.get_my_tenant_ids()));

-- Only tenant_admin / super_admin can manage languages
CREATE POLICY "tenant_admins_manage_languages"
  ON tenant_languages FOR ALL
  USING (
    public.is_super_admin()
    OR (
      tenant_id IN (SELECT public.get_my_tenant_ids())
      AND public.get_my_role_in_tenant(tenant_id) IN ('super_admin', 'tenant_admin')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      tenant_id IN (SELECT public.get_my_tenant_ids())
      AND public.get_my_role_in_tenant(tenant_id) IN ('super_admin', 'tenant_admin')
    )
  );

-- collection_item_translations --
ALTER TABLE collection_item_translations ENABLE ROW LEVEL SECURITY;

-- Read: same tenant isolation as collection_items
CREATE POLICY "members_select_translations"
  ON collection_item_translations FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR tenant_id IS NULL
    OR public.is_super_admin()
  );

CREATE POLICY "members_insert_translations"
  ON collection_item_translations FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "members_update_translations"
  ON collection_item_translations FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR public.is_super_admin()
  );

CREATE POLICY "members_delete_translations"
  ON collection_item_translations FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids())
    OR public.is_super_admin()
  );


-- ─────────────────────────────────────────────────────────────
-- PART 8: Seed English as default language for all existing tenants
-- New tenants get English auto-seeded by the handle_new_tenant trigger
-- (to be added in a future migration if needed).
-- ─────────────────────────────────────────────────────────────

INSERT INTO tenant_languages (tenant_id, language_code, language_name, is_default, sort_order)
SELECT id, 'en', 'English', true, 0
FROM tenants
ON CONFLICT (tenant_id, language_code) DO NOTHING;
