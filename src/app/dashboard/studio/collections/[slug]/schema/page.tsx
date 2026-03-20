import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { CreateFieldDialog } from "@/components/create-field-dialog";
import { FieldActions } from "@/components/field-actions";
import { Database, Layers, ArrowLeft, GripVertical } from "lucide-react";
import Link from "next/link";
import { getFieldLabel, getCollectionName, getCollectionDescription } from "@/lib/i18n";
import { LANG_COOKIE } from "@/lib/constants";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  datetime: "Date & Time",
  boolean: "Toggle",
  file: "File",
  select: "Select",
  multiselect: "Multi-Select",
  richtext: "Rich Text",
  json: "JSON",
  relation: "Relation",
};

const FIELD_TYPE_COLORS: Record<string, string> = {
  text: "border-blue-500/40 text-blue-600",
  number: "border-orange-500/40 text-orange-400",
  date: "border-yellow-500/40 text-yellow-400",
  datetime: "border-yellow-500/40 text-yellow-400",
  boolean: "border-green-500/40 text-green-400",
  file: "border-pink-500/40 text-pink-400",
  select: "border-purple-500/40 text-purple-400",
  multiselect: "border-purple-500/40 text-purple-400",
  richtext: "border-blue-500/40 text-blue-600",
  json: "border-zinc-500/40 text-zinc-400",
  relation: "border-blue-500/40 text-blue-600",
};

type Field = {
  id: string;
  slug: string;
  name: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_translatable: boolean;
  sort_order: number;
  options: Record<string, unknown>;
};

type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  collection_fields: Field[];
};

export default async function SchemaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getUser();
  if (!user) notFound();

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  const role = tenantId ? await getUserRole(user.id, tenantId) : null;

  const { data: currentTenant } = tenantId
    ? await supabase.from("tenants").select("is_super").eq("id", tenantId).maybeSingle()
    : { data: null };
  const isSuperAdmin = role === "super_admin" && (currentTenant?.is_super === true);

  const { data: collection } = await supabase
    .from("collections")
    .select("*, collection_fields(*)")
    .eq("slug", slug)
    .maybeSingle() as { data: Collection | null };

  if (!collection) notFound();

  const { data: allCollections } = await supabase
    .from("collections")
    .select("id, name, slug")
    .eq("is_hidden", false)
    .order("name");

  const fields = [...(collection.collection_fields ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const isSystem = collection.type === "system";
  const canEdit = isSuperAdmin || !isSystem;

  const cookieStore = await cookies();
  const currentLocale = cookieStore.get(LANG_COOKIE)?.value ?? "en";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Back nav */}
      <Link
        href={isSystem ? "/dashboard/studio/system-collections" : "/dashboard/studio/tenant-collections"}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isSystem ? "Back to System Collections" : "Back to Tenant Collections"}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-gray-300 bg-gray-100 p-2">
            {isSystem ? (
              <Database className="h-4 w-4 text-blue-600" />
            ) : (
              <Layers className="h-4 w-4 text-blue-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
                {getCollectionName(collection, currentLocale)}
              </h1>
              <Badge
                variant="outline"
                className={isSystem
                  ? "border-blue-500/40 text-blue-600 text-xs"
                  : "border-violet-500/40 text-violet-400 text-xs"}
              >
                {isSystem ? "System" : "Tenant"}
              </Badge>
            </div>
            <code className="text-xs text-gray-500 font-mono">{collection.slug}</code>
            {(getCollectionDescription(collection, currentLocale) ?? collection.description) && (
              <p className="mt-1 text-sm text-gray-500">{getCollectionDescription(collection, currentLocale)}</p>
            )}
          </div>
        </div>

        {canEdit && (
          <CreateFieldDialog
            collectionId={collection.id}
            collectionSlug={collection.slug}
            allCollections={allCollections ?? []}
          />
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200">
        <Link
          href={`/dashboard/studio/collections/${collection.slug}/schema`}
          className="px-4 py-2 text-sm text-blue-600 border-b-2 border-blue-400 font-medium"
        >
          Schema
        </Link>
        <Link
          href={`/dashboard/studio/collections/${collection.slug}/items`}
          className="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          Items
        </Link>
        <Link
          href={`/dashboard/studio/collections/${collection.slug}/webhooks`}
          className="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          Webhooks
        </Link>
      </div>

      {/* Fields subtitle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {fields.length} field{fields.length !== 1 ? "s" : ""} defined.
          Each field maps to a key in the item&apos;s <code className="text-xs text-blue-600 font-mono">data</code> JSONB.
          {isSystem && !isSuperAdmin && <span className="ml-2">(read-only)</span>}
        </p>
      </div>

      {/* Fields list */}
      {fields.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white flex flex-col items-center justify-center py-12 text-center">
          <p className="text-gray-500 text-sm">No fields yet.</p>
          {canEdit && (
            <p className="text-gray-500/60 text-xs mt-1">Add your first field to start defining this collection&apos;s schema.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <FieldRow
              key={field.id}
              field={field}
              index={index}
              total={fields.length}
              collectionId={collection.id}
              collectionSlug={collection.slug}
              allCollections={allCollections ?? []}
              canEdit={canEdit}
              currentLocale={currentLocale}
            />
          ))}
        </div>
      )}

      {/* API hint */}
      <div className="rounded-lg border border-gray-100 bg-white/50 p-4">
        <p className="text-xs text-gray-500">
          <span className="text-gray-900 font-medium">API endpoint:</span>{" "}
          <code className="text-blue-600 font-mono">/api/collections/{collection.slug}/items</code>
          {" — "}available in Phase 9.
        </p>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  index,
  total,
  collectionId,
  collectionSlug,
  allCollections,
  canEdit,
  currentLocale,
}: {
  field: Field;
  index: number;
  total: number;
  collectionId: string;
  collectionSlug: string;
  allCollections: { id: string; name: string; slug: string }[];
  canEdit: boolean;
  currentLocale: string;
}) {
  const opts = field.options as Record<string, unknown>;
  const typeColor = FIELD_TYPE_COLORS[field.field_type] ?? "border-zinc-500/40 text-zinc-400";

  let relationDetail: string | null = null;
  if (field.field_type === "relation" && opts?.relation_type) {
    const relCol = allCollections.find((c) => c.id === opts.related_collection_id);
    const relLabel = relCol ? relCol.name : "unknown";
    relationDetail = `${String(opts.relation_type).toUpperCase()} → ${relLabel}`;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 hover:border-gray-300 hover:bg-gray-50 transition-colors">
      <GripVertical className="h-4 w-4 text-gray-500/40 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900">{getFieldLabel(field, currentLocale)}</span>
          <code className="text-xs text-gray-500 bg-gray-100 rounded px-1 font-mono">{field.slug}</code>
          <Badge variant="outline" className={`text-xs ${typeColor}`}>
            {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
          </Badge>
          {field.is_required && (
            <Badge variant="outline" className="text-xs border-red-500/40 text-red-400">Required</Badge>
          )}
          {field.is_unique && (
            <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400">Unique</Badge>
          )}
          {field.is_translatable && (
            <Badge variant="outline" className="text-xs border-violet-500/40 text-violet-400">i18n</Badge>
          )}
          {relationDetail && (
            <span className="text-xs text-blue-600/70">{relationDetail}</span>
          )}
        </div>
      </div>

      {canEdit && (
        <FieldActions
          fieldId={field.id}
          fieldName={field.name}
          fieldOptions={field.options}
          sortOrder={field.sort_order}
          collectionId={collectionId}
          collectionSlug={collectionSlug}
          isFirst={index === 0}
          isLast={index === total - 1}
        />
      )}
    </div>
  );
}
