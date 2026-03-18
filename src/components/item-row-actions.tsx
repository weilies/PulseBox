"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteItem } from "@/app/actions/studio";
import { EditItemDialog, type Field, type CatalogItems } from "@/components/item-form-dialog";
import type { TenantLanguage } from "@/types/translations";

interface Props {
  item: { id: string; data: Record<string, unknown> };
  fields: Field[];
  collectionId: string;
  collectionSlug: string;
  catalogItems: CatalogItems;
  tenantLanguages: TenantLanguage[];
  currentLocale?: string;
}

export function ItemRowActions({ item, fields, collectionId, collectionSlug, catalogItems, tenantLanguages, currentLocale = "en" }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.set("item_id", item.id);
    fd.set("collection_slug", collectionSlug);
    const result = await deleteItem(fd);
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Item deleted");
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white border-gray-300 text-gray-900">
          <DropdownMenuItem
            className="cursor-pointer hover:bg-gray-100 hover:text-blue-600"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-blue-50" />
          <DropdownMenuItem
            className="cursor-pointer text-red-400 hover:bg-red-50 hover:text-red-300"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={item}
        fields={fields}
        collectionId={collectionId}
        collectionSlug={collectionSlug}
        catalogItems={catalogItems}
        tenantLanguages={tenantLanguages}
        currentLocale={currentLocale}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-white border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Delete Item</DialogTitle>
            <DialogDescription className="text-gray-500">
              This record will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <DialogClose render={<Button type="button" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={handleDelete}
              disabled={loading}
              variant="destructive"
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
