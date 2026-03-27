import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitHeaders } from "@/app/api/_lib/rate-limit";

/**
 * POST /api/auth/user-token
 *
 * Exchange user credentials for a Supabase access token.
 * Proxies to Supabase internally so the Supabase URL/anon key
 * never needs to be exposed in client documentation.
 *
 * Body: { "email": "user@company.com", "password": "..." }
 * Returns: { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 3600 }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return Response.json(
        { error: "Missing email or password" },
        { status: 400 }
      );
    }

    // Rate-limit by email to prevent brute-force
    const rl = checkRateLimit(`user:${email.toLowerCase()}`);
    if (!rl.ok) {
      return Response.json(
        { error: "Too many requests — slow down" },
        { status: 429, headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const { access_token, expires_in } = data.session;

    return Response.json(
      {
        access_token,
        token_type: "Bearer",
        expires_in: expires_in ?? 3600,
      },
      { headers: rateLimitHeaders(rl.remaining, rl.resetAt) }
    );
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
