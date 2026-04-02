"use client";

import { useCallback } from "react";
import { CatalogColumnDefinition } from "@/types/catalog";

interface FieldDisplaySelectorProps {
  displayColumns: string[];
  onDisplayColumnsChange: (columns: string[]) => void;
  catalogColumns: CatalogColumnDefinition[];
}

export function FieldDisplaySelector({
  displayColumns,
  onDisplayColumnsChange,
  catalogColumns,
}: FieldDisplaySelectorProps) {
  const handleToggleColumn = useCallback(
    (columnKey: string) => {
      if (columnKey === "label") {
        // label is always required, cannot uncheck
        return;
      }

      if (displayColumns.includes(columnKey)) {
        onDisplayColumnsChange(displayColumns.filter((col) => col !== columnKey));
      } else {
        onDisplayColumnsChange([...displayColumns, columnKey]);
      }
    },
    [displayColumns, onDisplayColumnsChange]
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">Show in dropdown:</label>

      <div className="space-y-2 ml-4">
        {["label", "value", ...catalogColumns.map((col) => col.key)].map((columnKey) => {
          const isLabel = columnKey === "label";
          const columnDef = catalogColumns.find((col) => col.key === columnKey);
          const isChecked = displayColumns.includes(columnKey) || isLabel;

          return (
            <div key={columnKey} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`col-${columnKey}`}
                checked={isChecked}
                onChange={() => handleToggleColumn(columnKey)}
                disabled={isLabel}
                className="h-4 w-4 mt-1 disabled:opacity-50"
              />
              <label htmlFor={`col-${columnKey}`} className="text-sm text-gray-300">
                {columnKey}
                {isLabel && <span className="text-xs text-gray-500 ml-1">(always included)</span>}
                {columnDef?.description && (
                  <span className="text-xs text-gray-500 block">{columnDef.description}</span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
