/**
 * Resolves relation field UUIDs to human-readable labels for API responses.
 * Returns a `_display` map: { fieldSlug: "label" } per item.
 */

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

type FieldInfo = {
  slug: string;
  field_type: string;
  options: Record<string, unknown>;
};

const LABEL_KEYS = ["name", "title", "label", "full_name", "display_name", "code", "slug"];

function deriveLabel(data: Record<string, unknown>, id: string): string {
  for (const key of LABEL_KEYS) {
    const val = data[key];
    if (val && typeof val === "string" && val.trim()) return val.trim();
  }
  for (const val of Object.values(data)) {
    if (val && typeof val === "string" && val.trim()) return val.trim().slice(0, 60);
  }
  return id.slice(0, 8);
}

/**
 * Fetch relation fields for a collection and resolve all relation UUIDs
 * in the given items to display labels.
 *
 * Returns items with a `_display` property added.
 */
export async function resolveDisplayLabels(
  db: AdminClient,
  collectionId: string,
  items: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (items.length === 0) return items;

  // 1. Fetch relation fields for this collection (non-m2m only)
  const { data: fieldRows } = await db
    .from("collection_fields")
    .select("slug, field_type, options")
    .eq("collection_id", collectionId)
    .eq("field_type", "relation");

  const relationFields: FieldInfo[] = (fieldRows ?? []).filter(
    (f) => (f.options as Record<string, unknown>)?.relation_type !== "m2m"
  ) as FieldInfo[];

  if (relationFields.length === 0) return items;

  // 2. Collect all unique UUIDs per related collection
  const idsPerCollection: Record<string, Set<string>> = {};
  const fieldToCollection: Record<string, string> = {};

  for (const field of relationFields) {
    const relColId = field.options?.related_collection_id as string | undefined;
    if (!relColId) continue;
    fieldToCollection[field.slug] = relColId;
    if (!idsPerCollection[relColId]) idsPerCollection[relColId] = new Set();

    for (const item of items) {
      const data = item.data as Record<string, unknown>;
      const val = data?.[field.slug];
      if (val && typeof val === "string") {
        idsPerCollection[relColId].add(val);
      }
    }
  }

  // 3. Batch fetch related items (one query per related collection)
  const labelMap: Record<string, Record<string, string>> = {}; // collectionId -> { itemId: label }

  await Promise.all(
    Object.entries(idsPerCollection).map(async ([colId, ids]) => {
      if (ids.size === 0) return;
      const { data: relItems } = await db
        .from("collection_items")
        .select("id, data")
        .eq("collection_id", colId)
        .in("id", [...ids]);

      labelMap[colId] = {};
      for (const ri of relItems ?? []) {
        labelMap[colId][ri.id] = deriveLabel(ri.data as Record<string, unknown>, ri.id);
      }
    })
  );

  // 4. Build _display for each item
  return items.map((item) => {
    const data = item.data as Record<string, unknown>;
    const display: Record<string, string> = {};
    let hasDisplay = false;

    for (const field of relationFields) {
      const val = data?.[field.slug];
      if (!val || typeof val !== "string") continue;
      const colId = fieldToCollection[field.slug];
      if (!colId) continue;
      const label = labelMap[colId]?.[val];
      if (label) {
        display[field.slug] = label;
        hasDisplay = true;
      }
    }

    return hasDisplay ? { ...item, _display: display } : item;
  });
}

/**
 * Resolve _display for a single item.
 */
export async function resolveDisplayLabelsForItem(
  db: AdminClient,
  collectionId: string,
  item: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const [resolved] = await resolveDisplayLabels(db, collectionId, [item]);
  return resolved;
}

/**
 * Resolve catalog field values to their labels.
 * Returns items with catalog field values resolved in _display.
 */
export async function resolveCatalogLabels(
  db: AdminClient,
  collectionId: string,
  items: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (items.length === 0) return items;

  // Fetch select/multiselect fields with catalog_slug
  const { data: fieldRows } = await db
    .from("collection_fields")
    .select("slug, field_type, options")
    .eq("collection_id", collectionId)
    .in("field_type", ["select", "multiselect"]);

  const catalogFields = (fieldRows ?? []).filter(
    (f) => (f.options as Record<string, unknown>)?.catalog_slug
  );

  if (catalogFields.length === 0) return items;

  // Fetch catalog items
  const slugs = catalogFields.map((f) => (f.options as Record<string, unknown>).catalog_slug as string);
  const { data: catalogs } = await db
    .from("content_catalogs")
    .select("slug, content_catalog_items(value, label)")
    .in("slug", slugs);

  const catalogMap: Record<string, Record<string, string>> = {};
  for (const catalog of catalogs ?? []) {
    catalogMap[catalog.slug] = {};
    for (const ci of (catalog.content_catalog_items as { value: string; label: string }[]) ?? []) {
      catalogMap[catalog.slug][ci.value] = ci.label;
    }
  }

  // Add catalog labels to _display
  return items.map((item) => {
    const data = item.data as Record<string, unknown>;
    const existing = (item._display ?? {}) as Record<string, string | string[]>;
    const display = { ...existing };
    let hasNew = false;

    for (const field of catalogFields) {
      const catSlug = (field.options as Record<string, unknown>).catalog_slug as string;
      const lookup = catalogMap[catSlug];
      if (!lookup) continue;

      const val = data?.[field.slug];
      if (val === null || val === undefined) continue;

      if (field.field_type === "multiselect" && Array.isArray(val)) {
        const labels = val.map((v) => lookup[String(v)] ?? String(v));
        display[field.slug] = labels;
        hasNew = true;
      } else {
        const label = lookup[String(val)];
        if (label) {
          display[field.slug] = label;
          hasNew = true;
        }
      }
    }

    return hasNew ? { ...item, _display: display } : item;
  });
}
