"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateCatalog, deleteCatalog } from "@/app/actions/content-catalog";

interface Props {
  catalogId: string;
  catalogName: string;
  catalogSlug: string;
  description: string;
}

export function CatalogActions({ catalogId, catalogName, catalogSlug: _slug, description }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(catalogName);
  const [desc, setDesc] = useState(description);
  const [loading, setLoading] = useState(false);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.set("catalog_id", catalogId);
    fd.set("name", name);
    fd.set("description", desc);
    const result = await updateCatalog(fd);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Catalog updated");
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.set("catalog_id", catalogId);
    const result = await deleteCatalog(fd);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`"${catalogName}" deleted`);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300" />}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white border-gray-300 text-gray-900">
          <DropdownMenuItem
            className="gap-2 cursor-pointer hover:bg-gray-100 hover:text-blue-600"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-blue-50" />
          <DropdownMenuItem
            className="gap-2 cursor-pointer text-red-400 hover:bg-red-50 hover:text-red-300"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-white border border-gray-300 text-gray-900">
          <form onSubmit={handleEdit}>
            <DialogHeader>
              <DialogTitle className="text-blue-600">Edit Catalog</DialogTitle>
              <DialogDescription className="text-gray-500">Slug cannot be changed.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-900">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required
                  className="bg-gray-100 border-gray-300 text-gray-900" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-900">Description</Label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)}
                  className="bg-gray-100 border-gray-300 text-gray-900" />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <DialogClose render={<Button type="button" variant="outline" className="border-gray-300 text-gray-500 hover:bg-gray-100" />}>Cancel</DialogClose>
              <Button type="submit" disabled={loading} className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30">
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-white border border-red-500/30 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-red-400">Delete Catalog</DialogTitle>
            <DialogDescription className="text-gray-500">
              This will permanently delete <strong className="text-white">{catalogName}</strong> and all its items. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" className="border-zinc-600 text-gray-500 hover:bg-zinc-700" />}>Cancel</DialogClose>
            <Button onClick={handleDelete} disabled={loading} className="bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30">
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
