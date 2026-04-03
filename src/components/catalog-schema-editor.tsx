"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { updateCatalogColumns } from "@/app/actions/content-catalog";
import type { CatalogColumnDefinition, CatalogSchema } from "@/types/catalog";

interface Props {
  catalogId: string;
  catalogSlug: string;
  initialColumns: CatalogColumnDefinition[];
}

export function CatalogSchemaEditor({ catalogId, catalogSlug, initialColumns }: Props) {
  const [columns, setColumns] = useState<CatalogColumnDefinition[]>(initialColumns);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CatalogColumnDefinition["type"]>("text");
  const [saving, setSaving] = useState(false);

  function slugifyKey(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  async function save(updatedColumns: CatalogColumnDefinition[]) {
    setSaving(true);
    const fd = new FormData();
    fd.set("catalog_id", catalogId);
    fd.set("catalog_slug", catalogSlug);
    const schema: CatalogSchema = { columns: updatedColumns };
    fd.set("columns", updatedColumns.length > 0 ? JSON.stringify(schema) : "");
    const result = await updateCatalogColumns(fd);
    setSaving(false);
    if (result.error) { toast.error(result.error); return false; }
    return true;
  }

  async function handleAdd() {
    const key = slugifyKey(newKey || newLabel);
    if (!key || !newLabel) { toast.error("Key and label are required"); return; }
    if (columns.some((c) => c.key === key)) { toast.error(`Column key "${key}" already exists`); return; }
    const updated = [...columns, { key, label: newLabel, type: newType }];
    const ok = await save(updated);
    if (ok) {
      setColumns(updated);
      setNewKey("");
      setNewLabel("");
      setNewType("text");
      setAdding(false);
      toast.success("Column added");
    }
  }

  async function handleRemove(key: string) {
    const updated = columns.filter((c) => c.key !== key);
    const ok = await save(updated);
    if (ok) { setColumns(updated); toast.success("Column removed"); }
  }

  async function handleMove(index: number, dir: "up" | "down") {
    const updated = [...columns];
    const target = dir === "up" ? index - 1 : index + 1;
    [updated[index], updated[target]] = [updated[target], updated[index]];
    const ok = await save(updated);
    if (ok) setColumns(updated);
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/70 transition-colors"
      >
        <span>Extra Columns Schema <span className="text-gray-500 dark:text-gray-400 font-normal">({columns.length} defined)</span></span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>

      {open && (
        <div className="bg-white dark:bg-gray-900 p-4 space-y-3">
          {columns.length === 0 && !adding && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No extra columns defined. This catalog uses only Label and Value.</p>
          )}

          {columns.map((col, i) => (
            <div key={col.key} className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={i === 0 || saving}
                  onClick={() => handleMove(i, "up")}
                  className="h-4 w-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={i === columns.length - 1 || saving}
                  onClick={() => handleMove(i, "down")}
                  className="h-4 w-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{col.label}</span>
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-mono">{col.key}</span>
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">{col.type}</span>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleRemove(col.key)}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {adding && (
            <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Label</Label>
                  <Input
                    placeholder="Nationality"
                    value={newLabel}
                    onChange={(e) => {
                      setNewLabel(e.target.value);
                      if (!newKey) setNewKey(slugifyKey(e.target.value));
                    }}
                    className="h-8 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Key <span className="text-gray-400">(stored)</span></Label>
                  <Input
                    placeholder="nationality"
                    value={newKey}
                    onChange={(e) => setNewKey(slugifyKey(e.target.value))}
                    className="h-8 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-700 dark:text-gray-300">Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as CatalogColumnDefinition["type"])}>
                  <SelectTrigger className="h-8 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => { setAdding(false); setNewKey(""); setNewLabel(""); setNewType("text"); }}
                  className="h-7 text-xs border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400">
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !newLabel.trim()}
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  Add Column
                </Button>
              </div>
            </div>
          )}

          {!adding && (
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}
              className="gap-1.5 text-xs border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              <Plus className="h-3.5 w-3.5" />
              Add Column
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
