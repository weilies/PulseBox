/**
 * Resolve a translated field label.
 * Looks up `options.labels[locale]`, falling back to the canonical `name`.
 */
export function getFieldLabel(
  field: { name: string; options?: Record<string, unknown> | null },
  locale: string
): string {
  if (!locale || locale === "en") return field.name;
  const labels = field.options?.labels as Record<string, string> | undefined;
  return labels?.[locale] || field.name;
}

/**
 * Resolve a translated collection name.
 * Looks up `metadata.name_translations[locale]`, falling back to canonical `name`.
 */
export function getCollectionName(
  collection: { name: string; metadata?: Record<string, unknown> | null },
  locale: string
): string {
  if (!locale || locale === "en") return collection.name;
  const translations = collection.metadata?.name_translations as Record<string, string> | undefined;
  return translations?.[locale] || collection.name;
}

/**
 * Resolve a translated collection description.
 * Looks up `metadata.description_translations[locale]`, falling back to canonical `description`.
 */
export function getCollectionDescription(
  collection: { description: string | null; metadata?: Record<string, unknown> | null },
  locale: string
): string | null {
  if (!locale || locale === "en") return collection.description;
  const translations = collection.metadata?.description_translations as Record<string, string> | undefined;
  return translations?.[locale] || collection.description;
}
