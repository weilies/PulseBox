import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "./rate-limit";

export type ApiContext = {
  userId: string;
  tenantId: string;
  /** Admin client — RLS bypassed. Enforce tenant isolation in application code. */
  db: ReturnType<typeof createAdminClient>;
};

/**
 * Authenticate a REST API request.
 *
 * Expects:
 *   Authorization: Bearer <supabase-access-token>
 *   X-Tenant-Id: <tenant-uuid>
 *
 * Returns `{ ok: true, ctx }` on success or `{ ok: false, response }` on failure.
 */
export async function resolveApiContext(request: NextRequest): Promise<
  | { ok: true; ctx: ApiContext }
  | { ok: false; response: Response }
> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return fail(401, "Missing Authorization header. Use: Authorization: Bearer <access-token>");
  }

  const token = authHeader.slice(7).trim();
  const tenantId = request.headers.get("X-Tenant-Id");

  if (!tenantId) {
    return fail(400, "Missing X-Tenant-Id header");
  }

  // Rate-limit per token prefix (first 20 chars)
  const rlKey = `tok:${token.slice(0, 20)}`;
  const rl = checkRateLimit(rlKey);
  if (!rl.ok) {
    return fail(429, "Too many requests — slow down", rateLimitHeaders(rl.remaining, rl.resetAt));
  }

  // Validate token against Supabase Auth
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return fail(401, "Invalid or expired token");
  }

  // Validate tenant membership
  const db = createAdminClient();
  const { data: membership } = await db
    .from("tenant_users")
    .select("id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    return fail(403, "Access denied: you are not a member of this tenant");
  }

  return { ok: true, ctx: { userId: user.id, tenantId, db } };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(
  status: number,
  message: string,
  extraHeaders?: Record<string, string>
): { ok: false; response: Response } {
  return {
    ok: false,
    response: Response.json({ error: message }, { status, headers: extraHeaders }),
  };
}

export function apiErr(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

export function paginate(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
}
