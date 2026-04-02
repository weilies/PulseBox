"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { CatalogColumnDefinition } from "@/types/catalog";

interface CatalogItemEditorProps {
  columnSchema: CatalogColumnDefinition[];
  initialData?: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function CatalogItemEditor({
  columnSchema,
  initialData = {},
  onChange,
}: CatalogItemEditorProps) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      const updated = { ...data, [key]: value };
      setData(updated);
      onChange(updated);
    },
    [data, onChange]
  );

  return (
    <div className="space-y-4">
      {columnSchema.map((column) => (
        <div key={column.key} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {column.key}
            {column.required && <span className="text-red-500 ml-1">*</span>}
            {column.description && (
              <span className="text-xs text-gray-500 block">{column.description}</span>
            )}
          </label>

          {column.type === "boolean" ? (
            <input
              type="checkbox"
              checked={(data[column.key] as boolean) || false}
              onChange={(e) => handleFieldChange(column.key, e.target.checked)}
              className="h-4 w-4"
            />
          ) : column.type === "number" ? (
            <Input
              type="number"
              value={(data[column.key] as number) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value ? Number(e.target.value) : null)}
              placeholder={`Enter ${column.type}`}
            />
          ) : column.type === "date" ? (
            <Input
              type="date"
              value={(data[column.key] as string) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value || null)}
            />
          ) : column.type === "datetime" ? (
            <Input
              type="datetime-local"
              value={(data[column.key] as string) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value || null)}
            />
          ) : (
            <Input
              type="text"
              value={(data[column.key] as string) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value || null)}
              placeholder={`Enter ${column.type}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
