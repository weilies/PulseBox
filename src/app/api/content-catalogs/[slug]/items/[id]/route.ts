import { NextRequest } from "next/server";
import { resolveApiContext, apiErr } from "../../../../_lib/api-auth";

type Params = { params: Promise<{ slug: string; id: string }> };

/**
 * PUT /api/content-catalogs/:slug/items/:id
 * Update a catalog item.
 *
 * Request body (all fields optional):
 * {
 *   "label": "Updated Label",
 *   "value": "updated_value",
 *   "sort_order": 2,
 *   "is_active": true,
 *   "data": { "custom_field": "new_value" }
 * }
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiErr("Invalid JSON body", 400);
  }

  // Fetch catalog to verify ownership
  const { data: catalog, error: catalogError } = await db
    .from("content_catalogs")
    .select("id")
    .eq("slug", slug)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (catalogError) return apiErr(catalogError.message, 500);
  if (!catalog) return apiErr("Catalog not found", 404);

  // Fetch item to verify it belongs to this catalog
  const { data: existingItem, error: itemError } = await db
    .from("content_catalog_items")
    .select("id")
    .eq("id", id)
    .eq("catalog_id", catalog.id)
    .maybeSingle();

  if (itemError) return apiErr(itemError.message, 500);
  if (!existingItem) return apiErr("Item not found", 404);

  // Build update payload (only update fields that were provided)
  const updatePayload: Record<string, unknown> = {};
  if ("label" in body) updatePayload.label = body.label;
  if ("value" in body) updatePayload.value = body.value;
  if ("sort_order" in body) updatePayload.sort_order = body.sort_order;
  if ("is_active" in body) updatePayload.is_active = body.is_active;
  if ("data" in body) updatePayload.data = body.data || {};

  // If nothing was provided, return error
  if (Object.keys(updatePayload).length === 0) {
    return apiErr("At least one field must be provided for update", 400);
  }

  // Update item
  const { data: item, error } = await db
    .from("content_catalog_items")
    .update(updatePayload)
    .eq("id", id)
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
    { headers: auth.ctx.rlHeaders }
  );
}

/**
 * DELETE /api/content-catalogs/:slug/items/:id
 * Delete a catalog item.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await resolveApiContext(request);
  if (!auth.ok) return auth.response;
  const { db, tenantId } = auth.ctx;
  const { slug, id } = await params;

  // Fetch catalog to verify ownership
  const { data: catalog, error: catalogError } = await db
    .from("content_catalogs")
    .select("id")
    .eq("slug", slug)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (catalogError) return apiErr(catalogError.message, 500);
  if (!catalog) return apiErr("Catalog not found", 404);

  // Fetch item to verify it belongs to this catalog
  const { data: existingItem, error: itemError } = await db
    .from("content_catalog_items")
    .select("id")
    .eq("id", id)
    .eq("catalog_id", catalog.id)
    .maybeSingle();

  if (itemError) return apiErr(itemError.message, 500);
  if (!existingItem) return apiErr("Item not found", 404);

  // Delete item
  const { error } = await db
    .from("content_catalog_items")
    .delete()
    .eq("id", id);

  if (error) return apiErr(error.message, 400);

  return Response.json(
    { message: "Item deleted successfully" },
    { headers: auth.ctx.rlHeaders }
  );
}
