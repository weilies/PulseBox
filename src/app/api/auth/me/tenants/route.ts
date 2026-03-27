import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitHeaders } from "@/app/api/_lib/rate-limit";

/**
 * GET /api/auth/me/tenants
 *
 * List all tenants the authenticated user is authorized to access.
 * Requires user token (Bearer token from email/password auth).
 *
 * Returns:
 * {
 *   "tenants": [
 *     {
 *       "id": "uuid",
 *       "name": "Company Name",
 *       "slug": "company-slug",
 *       "role": "tenant_admin" | "employee" | "manager",
 *       "created_at": "2026-03-20T..."
 *     }
 *   ]
 * }
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Rate-limit by token to prevent abuse
    const rl = checkRateLimit(`token:${token.substring(0, 20)}`);
    if (!rl.ok) {
      return Response.json(
        { error: "Too many requests — slow down" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
      );
    }

    // Create a Supabase client with the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // Verify the token and get the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Query tenant_users to find all tenants this user belongs to
    const { data: tenantUsers, error: queryError } = await supabase
      .from("tenant_users")
      .select(
        `
        role,
        tenants:tenant_id (
          id,
          name,
          slug,
          created_at
        )
      `
      )
      .eq("user_id", user.id);

    if (queryError) {
      return Response.json(
        { error: "Failed to fetch tenants" },
        { status: 500 }
      );
    }

    const tenants = (tenantUsers || []).map((tu: any) => ({
      id: tu.tenants.id,
      name: tu.tenants.name,
      slug: tu.tenants.slug,
      role: tu.role,
      created_at: tu.tenants.created_at,
    }));

    return Response.json({ tenants }, { headers: rateLimitHeaders(rl.remaining, rl.resetAt) });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
