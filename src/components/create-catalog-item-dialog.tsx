"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
 Dialog, DialogClose, DialogContent, DialogDescription,
 DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CatalogItemEditor } from "@/components/catalog-item-editor";
import { CatalogSchema } from "@/types/catalog";

function slugify(text: string) {
 return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

interface CreateProps {
 catalogId: string;
 catalogSlug: string;
}

export function CreateCatalogItemDialog({ catalogId, catalogSlug }: CreateProps) {
 const router = useRouter();
 const [open, setOpen] = useState(false);
 const [label, setLabel] = useState("");
 const [value, setValue] = useState("");
 const [loading, setLoading] = useState(false);
 const [itemData, setItemData] = useState<Record<string, unknown>>({});
 const [catalogSchema, setCatalogSchema] = useState<CatalogSchema | null>(null);

 useEffect(() => {
  if (!open || !catalogSlug) return;
  fetch(`/api/content-catalogs/${catalogSlug}`)
   .then((res) => res.json())
   .then((data) => {
    if (data?.data?.columns) {
     setCatalogSchema(data.data.columns as CatalogSchema);
    }
   })
   .catch(() => {/* silent fail */});
 }, [open, catalogSlug]);

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  try {
   const response = await fetch(`/api/content-catalogs/${catalogSlug}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, value, catalog_id: catalogId, data: itemData }),
   });
   if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    toast.error(body?.error ?? "Failed to create item");
    return;
   }
   toast.success("Item added");
   setOpen(false);
   setLabel(""); setValue(""); setItemData({});
   router.refresh();
  } finally {
   setLoading(false);
  }
 }

 const extraColumns = catalogSchema?.columns.filter(
  (col) => col.key !== "label" && col.key !== "value"
 ) ?? [];

 return (
  <Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger
   render={<Button variant="outline" size="sm" className="gap-2 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600" />}
  >
   <Plus className="h-4 w-4" />
   Add Item
  </DialogTrigger>
  <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 sm:max-w-md">
   <form onSubmit={handleSubmit}>
   <DialogHeader>
    <DialogTitle className="text-blue-600 dark:text-blue-400">Add Item</DialogTitle>
    <DialogDescription className="text-gray-500 dark:text-gray-400">Add a new option to this catalog.</DialogDescription>
   </DialogHeader>
   <div className="mt-4 space-y-4">
    <div className="space-y-2">
    <Label className="text-gray-900 dark:text-gray-100">Label <span className="text-gray-500 dark:text-gray-400 font-normal">(display text)</span></Label>
    <Input
     placeholder="Male"
     value={label}
     onChange={(e) => { setLabel(e.target.value); setValue(slugify(e.target.value)); }}
     required
     className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50"
    />
    </div>
    <div className="space-y-2">
    <Label className="text-gray-900 dark:text-gray-100">Value <span className="text-gray-500 dark:text-gray-400 font-normal">(stored key)</span></Label>
    <Input
     placeholder="male"
     value={value}
     onChange={(e) => setValue(e.target.value)}
     required
     className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50"
    />
    </div>
    {extraColumns.length > 0 && (
    <CatalogItemEditor
     columnSchema={extraColumns}
     initialData={itemData}
     onChange={setItemData}
    />
    )}
   </div>
   <DialogFooter className="mt-6">
    <DialogClose render={<Button type="button" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" />}>Cancel</DialogClose>
    <Button type="submit" disabled={loading || !label.trim() || !value.trim()}
    className="bg-blue-50 dark:bg-blue-950 border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30">
    {loading ? "Adding..." : "Add Item"}
    </Button>
   </DialogFooter>
   </form>
  </DialogContent>
  </Dialog>
 );
}

// ---------------------------------------------------------------------------
// Edit variant (controlled)
// ---------------------------------------------------------------------------

interface EditProps {
 open: boolean;
 onOpenChange: (v: boolean) => void;
 item: { id: string; label: string; value: string; is_active: boolean; data?: Record<string, unknown> };
 catalogSlug: string;
 onDeleteRequest?: () => void;
}

export function EditCatalogItemDialog({ open, onOpenChange, item, catalogSlug, onDeleteRequest }: EditProps) {
 const router = useRouter();
 const [label, setLabel] = useState(item.label);
 const [value, setValue] = useState(item.value);
 const [isActive, setIsActive] = useState(item.is_active);
 const [loading, setLoading] = useState(false);
 const [itemData, setItemData] = useState<Record<string, unknown>>((item.data as Record<string, unknown>) || {});
 const [catalogSchema, setCatalogSchema] = useState<CatalogSchema | null>(null);

 useEffect(() => {
  if (open) {
   setLabel(item.label);
   setValue(item.value);
   setIsActive(item.is_active);
   setItemData((item.data as Record<string, unknown>) || {});
  }
 }, [open, item]);

 useEffect(() => {
  if (!open || !catalogSlug) return;
  fetch(`/api/content-catalogs/${catalogSlug}`)
   .then((res) => res.json())
   .then((data) => {
    if (data?.data?.columns) {
     setCatalogSchema(data.data.columns as CatalogSchema);
    }
   })
   .catch(() => {/* silent fail */});
 }, [open, catalogSlug]);

 async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  try {
   const response = await fetch(`/api/content-catalogs/${catalogSlug}/items/${item.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, value, is_active: isActive, data: itemData }),
   });
   if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    toast.error(body?.error ?? "Failed to update item");
    return;
   }
   toast.success("Item updated");
   onOpenChange(false);
   router.refresh();
  } finally {
   setLoading(false);
  }
 }

 const extraColumns = catalogSchema?.columns.filter(
  (col) => col.key !== "label" && col.key !== "value"
 ) ?? [];

 return (
  <Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 sm:max-w-md">
   <form onSubmit={handleSubmit}>
   <DialogHeader>
    <DialogTitle className="text-blue-600 dark:text-blue-400">Edit Item</DialogTitle>
    <DialogDescription className="text-gray-500 dark:text-gray-400">Update this catalog option.</DialogDescription>
   </DialogHeader>
   <div className="mt-4 space-y-4">
    <div className="space-y-2">
    <Label className="text-gray-900 dark:text-gray-100">Label</Label>
    <Input value={label} onChange={(e) => setLabel(e.target.value)} required
     className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
    </div>
    <div className="space-y-2">
    <Label className="text-gray-900 dark:text-gray-100">Value</Label>
    <Input value={value} onChange={(e) => setValue(e.target.value)} required
     className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" />
    </div>
    <div className="flex items-center gap-3">
    <input
     type="checkbox"
     id="is_active"
     checked={isActive}
     onChange={(e) => setIsActive(e.target.checked)}
     className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 accent-blue-400"
    />
    <Label htmlFor="is_active" className="text-gray-900 dark:text-gray-100 cursor-pointer">Active</Label>
    </div>
    {extraColumns.length > 0 && (
    <CatalogItemEditor
     columnSchema={extraColumns}
     initialData={itemData}
     onChange={setItemData}
    />
    )}
   </div>
   <DialogFooter className="mt-6">
    <div className="flex w-full items-center justify-between">
    {onDeleteRequest ? (
     <Button type="button" variant="outline" size="sm" className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300" onClick={onDeleteRequest}>
     Delete
     </Button>
    ) : <span />}
    <div className="flex gap-2">
     <DialogClose render={<Button type="button" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" />}>Cancel</DialogClose>
     <Button type="submit" disabled={loading}
     className="bg-blue-50 dark:bg-blue-950 border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30">
     {loading ? "Saving..." : "Save"}
     </Button>
    </div>
    </div>
   </DialogFooter>
   </form>
  </DialogContent>
  </Dialog>
 );
}
