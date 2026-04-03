/**
 * Replaces password field values with "<secret>" before any log write.
 * Call this on any data object before passing it to the activity logger.
 */
export type MinimalField = { slug: string; field_type: string };

export function sanitizePasswordFields(
  data: Record<string, unknown>,
  fields: MinimalField[]
): Record<string, unknown> {
  const passwordSlugs = new Set(
    fields.filter((f) => f.field_type === "password").map((f) => f.slug)
  );
  if (passwordSlugs.size === 0) return data;

  const sanitized = { ...data };
  for (const slug of passwordSlugs) {
    if (slug in sanitized) {
      sanitized[slug] = "<secret>";
    }
  }
  return sanitized;
}
