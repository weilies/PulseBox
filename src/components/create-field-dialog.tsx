"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createField } from "@/app/actions/studio";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "boolean", label: "Toggle (Boolean)" },
  { value: "select", label: "Select (single)" },
  { value: "multiselect", label: "Multi-Select" },
  { value: "file", label: "File / Image" },
  { value: "richtext", label: "Rich Text" },
  { value: "json", label: "JSON" },
  { value: "relation", label: "Relation (link to another collection)" },
];

type SimpleCollection = { id: string; name: string; slug: string };

interface Props {
  collectionId: string;
  collectionSlug: string;
  allCollections: SimpleCollection[];
}

export function CreateFieldDialog({ collectionId, collectionSlug, allCollections }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Core
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isTranslatable, setIsTranslatable] = useState(false);

  // Text options
  const [maxLength, setMaxLength] = useState("");

  // Number options
  const [numMin, setNumMin] = useState("");
  const [numMax, setNumMax] = useState("");
  const [decimals, setDecimals] = useState("");

  // Select/Multiselect
  const [selectMode, setSelectMode] = useState<"choices" | "catalog">("choices");
  const [choices, setChoices] = useState(""); // comma-separated
  const [catalogSlug, setCatalogSlug] = useState("");

  // Relation
  const [relatedCollectionId, setRelatedCollectionId] = useState("");
  const [relationType, setRelationType] = useState<"m2o" | "o2o" | "m2m">("m2o");

  function buildOptions(): Record<string, unknown> {
    switch (fieldType) {
      case "text":
        return maxLength ? { max_length: Number(maxLength) } : {};
      case "number":
        return {
          ...(numMin !== "" ? { min: Number(numMin) } : {}),
          ...(numMax !== "" ? { max: Number(numMax) } : {}),
          ...(decimals !== "" ? { decimals: Number(decimals) } : {}),
        };
      case "select":
      case "multiselect":
        if (selectMode === "catalog") {
          return { catalog_slug: catalogSlug };
        }
        return {
          choices: choices
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        };
      case "relation":
        return {
          related_collection_id: relatedCollectionId,
          relation_type: relationType,
        };
      default:
        return {};
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fieldType) {
      toast.error("Please select a field type");
      return;
    }
    if (fieldType === "relation" && !relatedCollectionId) {
      toast.error("Please select a related collection");
      return;
    }

    setLoading(true);
    const options = buildOptions();

    const formData = new FormData();
    formData.set("collection_id", collectionId);
    formData.set("collection_slug", collectionSlug);
    formData.set("name", name);
    formData.set("field_type", fieldType);
    formData.set("is_required", String(isRequired));
    formData.set("is_unique", String(isUnique));
    formData.set("is_translatable", String(isTranslatable));
    formData.set("options", JSON.stringify(options));

    const result = await createField(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Field "${name}" added`);
    setOpen(false);
    resetForm();
    router.refresh();
  }

  function resetForm() {
    setName("");
    setFieldType("");
    setIsRequired(false);
    setIsUnique(false);
    setIsTranslatable(false);
    setMaxLength("");
    setNumMin("");
    setNumMax("");
    setDecimals("");
    setSelectMode("choices");
    setChoices("");
    setCatalogSlug("");
    setRelatedCollectionId("");
    setRelationType("m2o");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="gap-2 bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
          />
        }
      >
        <Plus className="h-4 w-4" />
        Add Field
      </DialogTrigger>

      <DialogContent className="bg-white border border-gray-300 text-gray-900 shadow-[0_0_40px_rgba(0,240,255,0.15)] sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle
              className="text-blue-600"
              style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
            >
              Add Field
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Define a new field for this collection.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-gray-900">Field Name</Label>
              <Input
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50"
              />
              {name && (
                <p className="text-xs text-gray-500">
                  Stored as key:{" "}
                  <code className="text-blue-600">{slugify(name)}</code>
                </p>
              )}
            </div>

            {/* Field Type */}
            <div className="space-y-2">
              <Label className="text-gray-900">Field Type</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v ?? "")}>
                <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900">
                  <SelectValue placeholder="Select a type..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300 text-gray-900">
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* i18n hint */}
            {fieldType && fieldType !== "text" && fieldType !== "richtext" && (
              <p className="text-xs text-gray-500/60">
                Translatable (i18n) is available for Text and Rich Text fields.
              </p>
            )}

            {/* Flags */}
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded border-gray-300 bg-gray-100 accent-blue-400"
                />
                <span className="text-sm text-gray-900">Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUnique}
                  onChange={(e) => setIsUnique(e.target.checked)}
                  className="rounded border-gray-300 bg-gray-100 accent-blue-400"
                />
                <span className="text-sm text-gray-900">Unique</span>
              </label>
              {(fieldType === "text" || fieldType === "richtext") && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTranslatable}
                    onChange={(e) => setIsTranslatable(e.target.checked)}
                    className="rounded border-gray-300 bg-gray-100 accent-blue-400"
                  />
                  <span className="text-sm text-gray-900">
                    Translatable{" "}
                    <span className="text-xs text-gray-500">(i18n)</span>
                  </span>
                </label>
              )}
            </div>

            {/* --- Type-specific options --- */}

            {/* Text */}
            {fieldType === "text" && (
              <div className="space-y-2 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-3">
                <Label className="text-gray-500 text-xs uppercase tracking-wide">Text Options</Label>
                <div className="space-y-1">
                  <Label className="text-sm text-gray-900">Max Length</Label>
                  <Input
                    type="number"
                    placeholder="255"
                    value={maxLength}
                    onChange={(e) => setMaxLength(e.target.value)}
                    className="bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
              </div>
            )}

            {/* Number */}
            {fieldType === "number" && (
              <div className="space-y-2 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-3">
                <Label className="text-gray-500 text-xs uppercase tracking-wide">Number Options</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-900">Min</Label>
                    <Input
                      type="number"
                      value={numMin}
                      onChange={(e) => setNumMin(e.target.value)}
                      className="bg-gray-100 border-gray-300 text-gray-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-900">Max</Label>
                    <Input
                      type="number"
                      value={numMax}
                      onChange={(e) => setNumMax(e.target.value)}
                      className="bg-gray-100 border-gray-300 text-gray-900"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-900">Decimals</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={decimals}
                      onChange={(e) => setDecimals(e.target.value)}
                      className="bg-gray-100 border-gray-300 text-gray-900"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Select / Multiselect */}
            {(fieldType === "select" || fieldType === "multiselect") && (
              <div className="space-y-3 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-3">
                <Label className="text-gray-500 text-xs uppercase tracking-wide">Select Options</Label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="select_mode"
                      value="choices"
                      checked={selectMode === "choices"}
                      onChange={() => setSelectMode("choices")}
                      className="accent-blue-400"
                    />
                    <span className="text-sm text-gray-900">Manual choices</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="select_mode"
                      value="catalog"
                      checked={selectMode === "catalog"}
                      onChange={() => setSelectMode("catalog")}
                      className="accent-blue-400"
                    />
                    <span className="text-sm text-gray-900">Content Catalog</span>
                  </label>
                </div>

                {selectMode === "choices" ? (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-900">Choices (comma-separated)</Label>
                    <Input
                      placeholder="Active, Inactive, Pending"
                      value={choices}
                      onChange={(e) => setChoices(e.target.value)}
                      className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-900">Catalog Slug</Label>
                    <Input
                      placeholder="gender"
                      value={catalogSlug}
                      onChange={(e) => setCatalogSlug(e.target.value)}
                      className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50"
                    />
                    <p className="text-xs text-gray-500">
                      e.g. gender, country, marital-status, employment-type
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Relation */}
            {fieldType === "relation" && (
              <div className="space-y-3 rounded-lg border border-zinc-700/50 bg-zinc-800/20 p-3">
                <Label className="text-gray-500 text-xs uppercase tracking-wide">Relation Options</Label>

                <div className="space-y-1">
                  <Label className="text-sm text-gray-900">Related Collection</Label>
                  <Select value={relatedCollectionId} onValueChange={(v) => setRelatedCollectionId(v ?? "")}>
                    <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select collection..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300 text-gray-900">
                      {allCollections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{" "}
                          <span className="text-xs text-zinc-500">({c.slug})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm text-gray-900">Relation Type</Label>
                  <Select
                    value={relationType}
                    onValueChange={(v) => setRelationType(v as "m2o" | "o2o" | "m2m")}
                  >
                    <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300 text-gray-900">
                      <SelectItem value="m2o">Many-to-One (M2O)</SelectItem>
                      <SelectItem value="o2o">One-to-One (O2O)</SelectItem>
                      <SelectItem value="m2m">Many-to-Many (M2M) — auto-creates junction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
                  onClick={resetForm}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !fieldType}
              className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
            >
              {loading ? "Adding..." : "Add Field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
