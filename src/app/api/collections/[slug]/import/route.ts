import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../_lib/api-auth";
import * as ItemsService from "@/lib/services/items.service";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/collections/:slug/import
 *
 * Body (JSON):
 * {
 *   rows: [{ csvColumnName: value, ... }],
 *   fieldMapping: { csvColumnName: fieldSlug, ... }
 * }
 *
 * The fieldMapping maps CSV column names to collection field slugs.
 * You can omit columns you don't want to import.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, userId, tenantId } = auth.ctx;
  const { slug } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return apiErr("Invalid JSON body"); }

  const rows = body.rows;
  const fieldMapping = body.fieldMapping;

  if (!Array.isArray(rows) || rows.length === 0) {
    return apiErr("rows must be a non-empty array");
  }
  if (!fieldMapping || typeof fieldMapping !== "object" || Array.isArray(fieldMapping)) {
    return apiErr("fieldMapping must be an object mapping CSV column names to field slugs");
  }
  if (rows.length > 1000) {
    return apiErr("Maximum 1000 rows per import request");
  }

  const result = await ItemsService.importItems(db, {
    collectionSlug: slug,
    rows: rows as Record<string, unknown>[],
    fieldMapping: fieldMapping as Record<string, string>,
    userId,
    tenantId,
  });

  if (result.error) {
    if (result.validationErrors) {
      return Response.json(
        {
          error: result.error,
          validationErrors: result.validationErrors,
          totalRows: result.totalRows,
          validCount: result.validCount,
        },
        { status: 422 }
      );
    }
    const status = result.error === "Collection not found" ? 404 : 500;
    return apiErr(result.error, status);
  }

  return Response.json({ data: result.data }, { status: 201, headers: auth.ctx.rlHeaders });
}
