import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { executeQuery } from "@/lib/query-engine";
import type { QueryDefinition } from "@/types/queries";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/queries/:id/execute — Run a saved query
 *
 * For draft queries: only the creator can execute.
 * For published queries: any tenant member with read access to all referenced collections.
 *
 * Also accepts { definition } in body for playground "test run" mode
 * (pass id = "preview" and definition in body).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 });

  const { id } = await params;
  const db = createAdminClient();

  let definition: QueryDefinition;

  if (id === "preview") {
    // Playground mode: definition comes from request body
    const body = await request.json();
    definition = body.definition;
    if (!definition || !definition.collections) {
      return Response.json({ error: "definition is required for preview" }, { status: 400 });
    }
  } else {
    // Load saved query
    const { data: query } = await supabase
      .from("saved_queries")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!query) return Response.json({ error: "Query not found" }, { status: 404 });
    definition = query.definition as QueryDefinition;
  }

  // Check user has read access to ALL referenced collections
  const { data: accessibleIds } = await supabase.rpc("get_accessible_collection_ids", {
    p_permission: "read",
  });
  const accessibleSet = new Set<string>((accessibleIds as string[]) ?? []);

  try {
    const result = await executeQuery(db, definition, tenantId, accessibleSet);
    return Response.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    return Response.json({ error: message }, { status: 403 });
  }
}
