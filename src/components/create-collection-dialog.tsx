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
import { createCollection } from "@/app/actions/studio";

function slugify(text: string) {
 return text
 .toLowerCase()
 .replace(/[^a-z0-9]+/g, "-")
 .replace(/^-|-$/g, "");
}

interface Props {
 isSuperAdmin: boolean;
 defaultType?: "system" | "tenant";
}

export function CreateCollectionDialog({ isSuperAdmin, defaultType }: Props) {
 const router = useRouter();
 const [open, setOpen] = useState(false);
 const [name, setName] = useState("");
 const [description, setDescription] = useState("");
 const [icon, setIcon] = useState("");
 const [type, setType] = useState<"system" | "tenant">(defaultType ?? (isSuperAdmin ? "system" : "tenant"));
 const [loading, setLoading] = useState(false);

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 setLoading(true);

 const formData = new FormData();
 formData.set("name", name);
 formData.set("description", description);
 formData.set("icon", icon);
 formData.set("type", type);

 const result = await createCollection(formData);
 setLoading(false);

 if (result.error) {
 toast.error(result.error);
 return;
 }

 toast.success(`Collection "${name}" created`);
 setOpen(false);
 resetForm();
 router.refresh();
 }

 function resetForm() {
 setName("");
 setDescription("");
 setIcon("");
 setType(defaultType ?? (isSuperAdmin ? "system" : "tenant"));
 }

 const slugPreview = slugify(name);

 return (
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger
 render={
 <Button
 variant="outline" size="sm" className="gap-2 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600"
 />
 }
 >
 <Plus className="h-4 w-4" />
 New Collection
 </DialogTrigger>

 <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 shadow-[0_0_40px_rgba(0,240,255,0.15)] sm:max-w-md">
 <form onSubmit={handleSubmit}>
 <DialogHeader>
 <DialogTitle
 className="text-blue-600 dark:text-blue-400"
 style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
 >
 New Collection
 </DialogTitle>
 <DialogDescription className="text-gray-500 dark:text-gray-400">
 Define a new data collection and its schema.
 </DialogDescription>
 </DialogHeader>

 <div className="mt-4 space-y-4">
 {/* Name */}
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">Name</Label>
 <Input
 placeholder="Employees"
 value={name}
 onChange={(e) => setName(e.target.value)}
 required
 className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50 focus:border-blue-500/60"
 />
 {slugPreview && (
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Slug preview:{" "}
 <code className="text-blue-600 dark:text-blue-400">{slugPreview}</code>
 {" "}(final slug may have a suffix if taken)
 </p>
 )}
 </div>

 {/* Description */}
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">
 Description{" "}
 <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
 </Label>
 <Input
 placeholder="Stores employee records"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50 focus:border-blue-500/60"
 />
 </div>

 {/* Icon */}
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">
 Icon{" "}
 <span className="text-gray-500 dark:text-gray-400 font-normal">(lucide name, optional)</span>
 </Label>
 <Input
 placeholder="users"
 value={icon}
 onChange={(e) => setIcon(e.target.value)}
 className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50 focus:border-blue-500/60"
 />
 </div>

 {/* Type (super_admin only) */}
 {isSuperAdmin && (
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">Type</Label>
 <Select
 value={type}
 onValueChange={(v) => setType(v as "system" | "tenant")}
 >
 <SelectTrigger className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
 <SelectItem value="system">System (platform-wide)</SelectItem>
 <SelectItem value="tenant">Tenant (scoped to current tenant)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 )}
 </div>

 <DialogFooter className="mt-6">
 <DialogClose
 render={
 <Button
 type="button"
 variant="outline"
 className="border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400"
 />
 }
 >
 Cancel
 </DialogClose>
 <Button
 type="submit"
 disabled={loading || !name.trim()}
 className="bg-blue-50 dark:bg-blue-950 border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
 >
 {loading ? "Creating..." : "Create Collection"}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}