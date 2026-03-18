export type TenantLanguage = {
  id: string;
  tenant_id: string;
  language_code: string;
  language_name: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

/**
 * LocaleTranslations: locale-first structure used by the UI for per-locale form binding.
 * { languageCode: { fieldSlug: value } }
 *
 * Example:
 * {
 *   "zh-CN": { "name": "人力资源", "description": "..." },
 *   "ms":    { "name": "Sumber Manusia" }
 * }
 */
export type LocaleTranslations = Record<string, Record<string, string>>;
