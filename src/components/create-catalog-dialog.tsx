"use client";

import { useState } from "react";
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
import { createCatalog } from "@/app/actions/content-catalog";

export function CreateCatalogDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", description);
    const result = await createCatalog(fd);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`Catalog "${name}" created`);
    setOpen(false);
    setName(""); setDescription("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="gap-2 bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]" />
        }
      >
        <Plus className="h-4 w-4" />
        New Catalog
      </DialogTrigger>
      <DialogContent className="bg-white border border-gray-300 text-gray-900 sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-blue-600">New Content Catalog</DialogTitle>
            <DialogDescription className="text-gray-500">
              Create a shared lookup catalog for select fields.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Name</Label>
              <Input
                placeholder="Gender"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">
                Description <span className="text-gray-500 font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="Male / Female / Other"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <DialogClose
              render={<Button type="button" variant="outline" className="border-gray-300 text-gray-500 hover:bg-gray-100" />}
            >
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30"
            >
              {loading ? "Creating..." : "Create Catalog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
