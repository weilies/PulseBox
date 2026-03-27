import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../_lib/api-auth";
import * as CollectionsService from "@/lib/services/collections.service";
import { slugify, generateUniqueSlug } from "@/lib/services/slugify";

/**
 * GET /api/collections
 * Query params: type=system|tenant|all (default: all)
 *
 * Returns collections visible to the authenticated user's tenant.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;

  const type = request.nextUrl.searchParams.get("type") ?? "all";

  let query = db
    .from("collections")
    .select("id, slug, name, description, icon, type, tenant_id, created_at, updated_at")
    .order("name", { ascending: true });

  if (type === "system") {
    query = query.eq("type", "system");
  } else if (type === "tenant") {
    query = query.eq("type", "tenant").eq("tenant_id", tenantId);
  } else {
    // Both: system (global) + this tenant's own
    query = query.or(`type.eq.system,and(type.eq.tenant,tenant_id.eq.${tenantId})`);
  }

  const { data, error } = await query;
  if (error) return apiErr(error.message, 500);

  return Response.json({ data: data ?? [] }, { headers: auth.ctx.rlHeaders });
}

/**
 * POST /api/collections
 * Body: { name, description?, icon?, type? }
 *
 * Creates a new tenant collection (type defaults to "tenant").
 * Only super admins may create system collections.
 */
export async function POST(request: NextRequest) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, userId, tenantId } = auth.ctx;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  const name = (body.name as string | undefined)?.trim();
  const description = (body.description as string | undefined)?.trim() || null;
  const icon = (body.icon as string | undefined)?.trim() || null;
  const type = (body.type as string | undefined) ?? "tenant";

  if (!name) return apiErr("name is required");
  if (!["system", "tenant"].includes(type)) return apiErr("type must be 'system' or 'tenant'");

  if (type === "system") {
    // Check super admin
    const { data: sa } = await db
      .from("tenant_users")
      .select("tenants!inner(is_super)")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!sa) return apiErr("Only super admins can create system collections", 403);
  }

  const baseSlug = slugify(name);
  let slug: string;
  try { slug = await generateUniqueSlug(baseSlug, db); }
  catch (e) { return apiErr(e instanceof Error ? e.message : "Slug generation failed"); }

  const { data, error } = await db
    .from("collections")
    .insert({
      name, slug, description, icon,
      type,
      tenant_id: type === "tenant" ? tenantId : null,
      created_by: userId,
    })
    .select("id, slug, name, description, icon, type, tenant_id, created_at")
    .single();

  if (error) return apiErr(error.message, 500);
  return Response.json({ data }, { status: 201, headers: auth.ctx.rlHeaders });
}
