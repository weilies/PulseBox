"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportItems } from "@/app/actions/studio";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type Field = {
  slug: string;
  name: string;
  field_type: string;
  options: Record<string, unknown>;
};

function flattenValue(value: unknown, fieldType: string): string {
  if (value === null || value === undefined || value === "") return "";

  switch (fieldType) {
    case "boolean":
      return value ? "Yes" : "No";
    case "multiselect":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value);
    default:
      return String(value);
  }
}

function buildRows(
  fields: Field[],
  items: { id: string; data: Record<string, unknown>; created_at: string; updated_at: string }[]
) {
  return items.map((item) => {
    const row: Record<string, string> = {};
    for (const f of fields) {
      row[f.name] = flattenValue(item.data?.[f.slug], f.field_type);
    }
    row["Created At"] = item.created_at;
    row["Updated At"] = item.updated_at;
    return row;
  });
}

interface ExportButtonsProps {
  collectionSlug: string;
  collectionName: string;
}

export function ExportButtons({ collectionSlug, collectionName }: ExportButtonsProps) {
  const [loading, setLoading] = useState<"csv" | "excel" | null>(null);

  async function handleExport(format: "csv" | "excel") {
    setLoading(format);
    try {
      const raw = await exportItems(collectionSlug);
      type ExportItem = { id: string; data: Record<string, unknown>; created_at: string; updated_at: string };
      type ExportPayload = { collectionName: string; fields: Field[]; items: ExportItem[] };
      const result = raw as { data?: ExportPayload; error?: string };
      if (result.error || !result.data) {
        toast.error(result.error ?? "Export failed");
        return;
      }

      const { fields, items } = result.data;
      if (items.length === 0) {
        toast.error("No items to export");
        return;
      }

      const rows = buildRows(fields, items);
      const safeName = collectionName.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 50);

      if (format === "csv") {
        const csv = Papa.unparse(rows);
        downloadBlob(csv, `${safeName}.csv`, "text/csv;charset=utf-8;");
        toast.success(`Exported ${items.length} items as CSV`);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, safeName.slice(0, 31));
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        downloadBlob(buf, `${safeName}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        toast.success(`Exported ${items.length} items as Excel`);
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleExport("csv")}
        disabled={loading !== null}
        className="gap-1.5 border-zinc-700/50 text-zinc-400 hover:border-gray-300 hover:text-blue-600"
      >
        <Download className="h-3.5 w-3.5" />
        {loading === "csv" ? "Exporting..." : "CSV"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleExport("excel")}
        disabled={loading !== null}
        className="gap-1.5 border-zinc-700/50 text-zinc-400 hover:border-gray-300 hover:text-blue-600"
      >
        <Download className="h-3.5 w-3.5" />
        {loading === "excel" ? "Exporting..." : "Excel"}
      </Button>
    </div>
  );
}

function downloadBlob(data: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = data instanceof ArrayBuffer
    ? new Blob([data], { type: mimeType })
    : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
