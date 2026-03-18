-- 00016_seed_i18n_languages.sql
-- Seed Chinese (Simplified) and Japanese for all existing tenants.
-- English was already seeded by migration 00015.

INSERT INTO tenant_languages (tenant_id, language_code, language_name, is_default, is_active, sort_order)
SELECT id, 'zh-CN', '中文 (简体)', false, true, 1
FROM tenants
ON CONFLICT (tenant_id, language_code) DO NOTHING;

INSERT INTO tenant_languages (tenant_id, language_code, language_name, is_default, is_active, sort_order)
SELECT id, 'ja', '日本語', false, true, 2
FROM tenants
ON CONFLICT (tenant_id, language_code) DO NOTHING;
