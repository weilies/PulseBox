import { createAdminClient } from "@/lib/supabase/admin";

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/**
 * Server-side field validation for collection items.
 *
 * Reads field definitions (is_required, options.validation) and applies:
 *   - required checks
 *   - number min/max
 *   - text max_length, pattern
 *   - custom external webhook_url per field (non-blocking on failure)
 *
 * Called before every item insert/update from the API route.
 * Works with JS disabled — entirely server-side.
 *
 * Field-level validation config (stored in collection_fields.options.validation):
 * {
 *   "min": 0,
 *   "max": 100,
 *   "pattern": "^[A-Z]{3}$",
 *   "error_message": "Must be a 3-letter uppercase code",
 *   "webhook_url": "https://...",
 *   "webhook_timeout_ms": 3000
 * }
 */
export async function validateItemData(
  collectionId: string,
  data: Record<string, unknown>,
  isUpdate = false
): Promise<ValidationResult> {
  const db = createAdminClient();
  const errors: FieldError[] = [];

  const { data: fields } = await db
    .from("collection_fields")
    .select("slug, name, field_type, is_required, options")
    .eq("collection_id", collectionId);

  if (!fields?.length) return { valid: true, errors: [] };

  for (const field of fields) {
    const value = data[field.slug];
    const opts = (field.options ?? {}) as Record<string, unknown>;
    const validation = (opts.validation ?? {}) as Record<string, unknown>;
    const isEmpty = value === undefined || value === null || value === "";

    // Required — only enforced on create (isUpdate=false)
    if (field.is_required && !isUpdate && isEmpty) {
      errors.push({ field: field.slug, message: `${field.name} is required` });
      continue;
    }
    if (isEmpty) continue;

    // Number rules
    if (field.field_type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({ field: field.slug, message: `${field.name} must be a number` });
        continue;
      }
      if (typeof validation.min === "number" && num < validation.min) {
        errors.push({ field: field.slug, message: `${field.name} must be at least ${validation.min}` });
      }
      if (typeof validation.max === "number" && num > validation.max) {
        errors.push({ field: field.slug, message: `${field.name} must be at most ${validation.max}` });
      }
    }

    // Text / richtext rules
    if (field.field_type === "text" || field.field_type === "richtext") {
      const str = String(value);
      if (typeof opts.max_length === "number" && str.length > opts.max_length) {
        errors.push({
          field: field.slug,
          message: `${field.name} exceeds maximum length of ${opts.max_length}`,
        });
      }
      if (typeof validation.pattern === "string") {
        try {
          if (!new RegExp(validation.pattern).test(str)) {
            const msg =
              typeof validation.error_message === "string"
                ? validation.error_message
                : `${field.name} does not match the required format`;
            errors.push({ field: field.slug, message: msg });
          }
        } catch {
          // Invalid regex — skip silently
        }
      }
    }

    // Per-field external validation webhook (server call, fail-open)
    if (typeof validation.webhook_url === "string") {
      try {
        const timeout =
          typeof validation.webhook_timeout_ms === "number" ? validation.webhook_timeout_ms : 3000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(validation.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: field.slug, value, data }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          let msg = `${field.name} failed custom validation`;
          try {
            const json = await res.json();
            if (json.message) msg = json.message;
            else if (json.error) msg = json.error;
          } catch { /* ignore */ }
          errors.push({ field: field.slug, message: msg });
        }
      } catch {
        // Network/timeout error — fail-open, don't block save
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
