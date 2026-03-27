import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { executeQuery } from "@/lib/query-engine";
import type { QueryDefinition } from "@/types/queries";
import Papa from "papaparse";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/queries/:id/export?format=csv|json
 *
 * Exports query results. Requires "export" permission on ALL referenced collections.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return Response.json({ error: "No tenant" }, { status: 400 });

  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (!["csv", "json"].includes(format)) {
    return Response.json({ error: "format must be 'csv' or 'json'" }, { status: 400 });
  }

  // Load query
  const { data: query } = await supabase
    .from("saved_queries")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!query) return Response.json({ error: "Query not found" }, { status: 404 });

  const definition = query.definition as QueryDefinition;

  // Check export permission on ALL referenced collections
  const { data: exportIds } = await supabase.rpc("get_accessible_collection_ids", {
    p_permission: "export",
  });
  const exportSet = new Set<string>((exportIds as string[]) ?? []);

  for (const col of definition.collections) {
    if (!exportSet.has(col.id)) {
      return Response.json(
        { error: `Export permission denied for collection: ${col.slug}` },
        { status: 403 }
      );
    }
  }

  // Also need read access to execute
  const { data: readIds } = await supabase.rpc("get_accessible_collection_ids", {
    p_permission: "read",
  });
  const readSet = new Set<string>((readIds as string[]) ?? []);

  const db = createAdminClient();

  try {
    const result = await executeQuery(db, definition, tenantId, readSet);

    if (format === "json") {
      return Response.json({
        query: query.name,
        total: result.total,
        columns: result.columns,
        data: result.rows,
      });
    }

    // CSV
    const csv = Papa.unparse(result.rows);
    const filename = `${query.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
