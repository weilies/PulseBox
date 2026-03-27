"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { EditItemDialog, type Field, type CatalogItems } from "@/components/item-form-dialog";
import type { TenantLanguage } from "@/types/translations";
import { getFieldLabel } from "@/lib/i18n";
import { formatDate, formatDatetime } from "@/lib/timezone-constants";

type Item = {
  id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

interface Props {
  item: Item;
  fields: Field[];
  displayTitle: string;
  collectionSlug: string;
  collectionId: string;
  collectionType: string;
  catalogItems: CatalogItems;
  relatedLabels: Record<string, Record<string, string>>;
  timezone: string;
  currentLocale: string;
  canWrite: boolean;
  tenantLanguages: TenantLanguage[];
  displayKeyFields: string[];
}

function renderValue(
  field: Field,
  value: unknown,
  catalogItems: CatalogItems,
  relatedLabels: Record<string, Record<string, string>>,
  timezone: string,
): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.field_type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return formatDate(value as string);
    case "datetime":
      return formatDatetime(value as string, timezone);
    case "select": {
      const slug = field.options?.catalog_slug as string | undefined;
      if (slug && catalogItems[slug]) {
        const found = catalogItems[slug].find((i) => i.value === value);
        return found?.label ?? String(value);
      }
      return String(value);
    }
    case "relation": {
      const id = String(value);
      return relatedLabels[field.slug]?.[id] ?? id.slice(0, 8);
    }
    default:
      return String(value).slice(0, 100);
  }
}

export function ParentItemHeader({
  item,
  fields,
  displayTitle,
  collectionSlug,
  collectionId,
  collectionType,
  catalogItems,
  relatedLabels,
  timezone,
  currentLocale,
  canWrite,
  tenantLanguages,
  displayKeyFields,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);

  // Show summary fields: display key fields first, then other fields (skip child_of relations)
  const summaryFields = fields.filter((f) => {
    // Skip child_of relation fields (those are shown in tabs)
    if (f.field_type === "relation" && f.options?.relationship_style === "child_of") return false;
    // Skip file, json, richtext from summary
    if (["file", "json", "richtext"].includes(f.field_type)) return false;
    return true;
  });

  // Show up to 6 fields in summary
  const visibleFields = summaryFields.slice(0, 6);

  return (
    <>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2
              className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate"
              style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
            >
              {displayTitle}
            </h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {visibleFields.map((f) => {
                const val = item.data[f.slug];
                const displayed = renderValue(f, val, catalogItems, relatedLabels, timezone);
                // Skip displaying if it's already in the title
                if (displayKeyFields.includes(f.slug)) return null;
                return (
                  <span key={f.slug} className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="text-gray-400 dark:text-gray-500">{getFieldLabel(f, currentLocale)}:</span>{" "}
                    <span className="text-gray-700 dark:text-gray-300">{displayed}</span>
                  </span>
                );
              })}
            </div>
          </div>
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="shrink-0 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 gap-1.5"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {canWrite && (
        <EditItemDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          item={{ id: item.id, data: item.data }}
          fields={fields}
          collectionId={collectionId}
          collectionSlug={collectionSlug}
          catalogItems={catalogItems}
          tenantLanguages={tenantLanguages}
          currentLocale={currentLocale}
          timezone={timezone}
        />
      )}
    </>
  );
}
