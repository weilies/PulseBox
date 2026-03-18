/**
 * Server-side timezone resolution.
 * Import from "@/lib/timezone-constants" for client-safe helpers.
 *
 * Resolution order (highest priority first):
 *   1. User's own timezone (profiles.timezone)
 *   2. Tenant default timezone (tenants.timezone)
 *   3. Hard fallback: 'Asia/Singapore'
 */

import { createClient } from "@/lib/supabase/server";

export { COMMON_TIMEZONES, formatDatetime, formatDate } from "@/lib/timezone-constants";

const FALLBACK_TZ = "Asia/Singapore";

/**
 * Resolve the effective timezone for the current user in a given tenant.
 * Use this in Server Components / Server Actions only.
 */
export async function resolveTimezone(userId: string, tenantId: string): Promise<string> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();

  if (profile?.timezone) return profile.timezone;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("timezone")
    .eq("id", tenantId)
    .single();

  return tenant?.timezone || FALLBACK_TZ;
}
