import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../_lib/api-auth";
import * as ItemsService from "@/lib/services/items.service";
import Papa from "papaparse";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/collections/:slug/export
 * Query params: format=csv (default) | json
 *
 * Returns all items as CSV or JSON.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  const format = request.nextUrl.searchParams.get("format") ?? "csv";
  if (!["csv", "json"].includes(format)) {
    return apiErr("format must be 'csv' or 'json'");
  }

  const result = await ItemsService.exportItems(db, { collectionSlug: slug, tenantId });
  if (result.error) return apiErr(result.error, result.error === "Collection not found" ? 404 : 500);

  const { collectionName, fields, items } = result.data!;

  if (format === "json") {
    const rows = items.map((item) => ({
      _id: item.id,
      _created_at: item.created_at,
      _updated_at: item.updated_at,
      ...fields.reduce<Record<string, unknown>>((acc, f) => {
        acc[f.slug] = (item.data as Record<string, unknown>)[f.slug] ?? null;
        return acc;
      }, {}),
    }));
    return Response.json({ collection: collectionName, total: rows.length, data: rows });
  }

  // CSV
  const rows = items.map((item) => {
    const row: Record<string, unknown> = {};
    for (const f of fields) {
      const val = (item.data as Record<string, unknown>)[f.slug];
      row[f.name] = Array.isArray(val) ? val.join(", ") : (val ?? "");
    }
    return row;
  });

  const csv = Papa.unparse(rows);
  const filename = `${slug}-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
