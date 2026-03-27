import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { hasPageAccess } from "@/lib/services/permissions.service";

/**
 * GET /api/queries — List saved queries for the current tenant
 * Published queries visible to all tenant members.
 * Draft queries visible only to creator.
 */
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 });

  const hasAccess = await hasPageAccess(supabase, "studio.queries");
  if (!hasAccess) return Response.json({ error: "Access denied" }, { status: 403 });

  // RLS handles draft/published visibility
  const { data, error } = await supabase
    .from("saved_queries")
    .select("id, name, slug, description, status, created_by, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ data });
}

/**
 * POST /api/queries — Create a new saved query
 * Body: { name, description?, definition }
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 });

  const hasAccess = await hasPageAccess(supabase, "studio.queries");
  if (!hasAccess) return Response.json({ error: "Access denied" }, { status: 403 });

  const body = await request.json();
  const { name, description, definition } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  // Generate slug
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const db = createAdminClient();
  const { data, error } = await db
    .from("saved_queries")
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      status: "draft",
      definition: definition || {
        collections: [],
        joins: [],
        fields: [],
        filters: [],
        aggregations: [],
        group_by: [],
        sort: [],
        limit: 500,
      },
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "A query with this name already exists" }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data }, { status: 201 });
}
