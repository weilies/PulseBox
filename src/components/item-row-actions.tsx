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
import type { FormLayout } from "@/types/form-layout";

interface Props {
 item: { id: string; data: Record<string, unknown> };
 fields: Field[];
 collectionId: string;
 collectionSlug: string;
 catalogItems: CatalogItems;
 tenantLanguages: TenantLanguage[];
 currentLocale?: string;
 timezone?: string;
 formLayout?: FormLayout | null;
}

export function ItemRowActions({ item, fields, collectionId, collectionSlug, catalogItems, tenantLanguages, currentLocale = "en", timezone, formLayout }: Props) {
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
 <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
 <MoreHorizontal className="h-4 w-4" />
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
 <DropdownMenuItem
 className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400"
 onClick={() => setEditOpen(true)}
 >
 <Pencil className="mr-2 h-4 w-4" />
 Edit
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
 timezone={timezone}
 formLayout={formLayout}
 onDeleteRequest={() => { setEditOpen(false); setDeleteOpen(true); }}
 />

 <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
 <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
 <DialogHeader>
 <DialogTitle className="text-gray-900 dark:text-gray-100">Delete Item</DialogTitle>
 <DialogDescription className="text-gray-500 dark:text-gray-400">
 This record will be permanently deleted. This cannot be undone.
 </DialogDescription>
 </DialogHeader>
 <DialogFooter className="mt-4">
 <DialogClose render={<Button type="button" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50" />}>
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