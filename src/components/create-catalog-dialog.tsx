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
 <Button variant="outline" size="sm" className="gap-2 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600" />
 }
 >
 <Plus className="h-4 w-4" />
 New Catalog
 </DialogTrigger>
 <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 sm:max-w-md">
 <form onSubmit={handleSubmit}>
 <DialogHeader>
 <DialogTitle className="text-blue-600 dark:text-blue-400">New Content Catalog</DialogTitle>
 <DialogDescription className="text-gray-500 dark:text-gray-400">
 Create a shared lookup catalog for select fields.
 </DialogDescription>
 </DialogHeader>
 <div className="mt-4 space-y-4">
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">Name</Label>
 <Input
 placeholder="Gender"
 value={name}
 onChange={(e) => setName(e.target.value)}
 required
 className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50"
 />
 </div>
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">
 Description <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
 </Label>
 <Input
 placeholder="Male / Female / Other"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50"
 />
 </div>
 </div>
 <DialogFooter className="mt-6">
 <DialogClose
 render={<Button type="button" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" />}
 >
 Cancel
 </DialogClose>
 <Button
 type="submit"
 disabled={loading || !name.trim()}
 className="bg-blue-50 dark:bg-blue-950 border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30"
 >
 {loading ? "Creating..." : "Create Catalog"}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}