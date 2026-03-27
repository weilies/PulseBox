import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { hasPageAccess } from "@/lib/services/permissions.service";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/queries/:id — Get a single saved query
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 });

  const { id } = await params;

  // RLS handles visibility (draft = creator only, published = tenant)
  const { data, error } = await supabase
    .from("saved_queries")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Query not found" }, { status: 404 });

  return Response.json({ data });
}

/**
 * PATCH /api/queries/:id — Update a saved query
 * Body: { name?, description?, definition?, status? }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 });

  const { id } = await params;
  const body = await request.json();

  // Verify query exists and user can edit (creator or super_admin)
  const db = createAdminClient();
  const { data: existing } = await db
    .from("saved_queries")
    .select("id, created_by, tenant_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Query not found" }, { status: 404 });

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  if (existing.created_by !== user.id && !isSuperAdmin) {
    return Response.json({ error: "Only the query creator can edit" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { updated_by: user.id, updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    updates.name = body.name.trim();
    updates.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.definition !== undefined) updates.definition = body.definition;
  if (body.status !== undefined && ["draft", "published"].includes(body.status)) {
    updates.status = body.status;
  }

  const { data, error } = await db
    .from("saved_queries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ data });
}

/**
 * DELETE /api/queries/:id — Delete a saved query
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 });

  const { id } = await params;

  const db = createAdminClient();
  const { data: existing } = await db
    .from("saved_queries")
    .select("id, created_by")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Query not found" }, { status: 404 });

  const { data: isSuperAdmin } = await supabase.rpc("is_super_admin");
  if (existing.created_by !== user.id && !isSuperAdmin) {
    return Response.json({ error: "Only the query creator can delete" }, { status: 403 });
  }

  await db.from("saved_queries").delete().eq("id", id);

  return Response.json({ ok: true });
}
