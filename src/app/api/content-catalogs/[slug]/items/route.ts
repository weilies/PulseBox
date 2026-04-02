import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../_lib/api-auth";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/content-catalogs/:slug/items
 * Returns all items for a catalog, ordered by sort_order.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  // Fetch catalog to verify it exists and belongs to tenant
  const { data: catalog, error: catalogError } = await db
    .from("content_catalogs")
    .select("id")
    .eq("slug", slug)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (catalogError) return apiErr(catalogError.message, 500);
  if (!catalog) return apiErr("Catalog not found", 404);

  // Fetch all items for this catalog
  const { data: items, error } = await db
    .from("content_catalog_items")
    .select(
      `
      id,
      catalog_id,
      value,
      label,
      sort_order,
      is_active,
      data
    `
    )
    .eq("catalog_id", catalog.id)
    .order("sort_order", { ascending: true });

  if (error) return apiErr(error.message, 500);

  return Response.json(
    { data: items ?? [] },
    { headers: auth.ctx.rlHeaders }
  );
}

/**
 * POST /api/content-catalogs/:slug/items
 * Create a new catalog item.
 *
 * Request body:
 * {
 *   "label": "Option Label",
 *   "value": "option_value",
 *   "sort_order": 1,
 *   "is_active": true,
 *   "data": { "custom_field": "value" }
 * }
 */
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiErr("Invalid JSON body", 400);
  }

  // Validate required fields
  if (!body.label || !body.value) {
    return apiErr("label and value are required", 400);
  }

  // Fetch catalog to get its ID and verify ownership
  const { data: catalog, error: catalogError } = await db
    .from("content_catalogs")
    .select("id")
    .eq("slug", slug)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (catalogError) return apiErr(catalogError.message, 500);
  if (!catalog) return apiErr("Catalog not found", 404);

  // Insert item
  const { data: item, error } = await db
    .from("content_catalog_items")
    .insert({
      catalog_id: catalog.id,
      label: body.label as string,
      value: body.value as string,
      data: (body.data as Record<string, unknown>) || {},
      sort_order: (body.sort_order as number) || 1,
      is_active: body.is_active !== false,
    })
    .select(
      `
      id,
      catalog_id,
      value,
      label,
      sort_order,
      is_active,
      data
    `
    )
    .single();

  if (error) return apiErr(error.message, 400);

  return Response.json(
    { data: item },
    { status: 201, headers: auth.ctx.rlHeaders }
  );
}
