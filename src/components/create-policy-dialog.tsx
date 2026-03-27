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
import { createPolicy } from "@/app/actions/roles";

export function CreatePolicyDialog() {
 const router = useRouter();
 const [open, setOpen] = useState(false);
 const [loading, setLoading] = useState(false);

 async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
 e.preventDefault();
 setLoading(true);
 const fd = new FormData(e.currentTarget);
 fd.set("permissions", "[]"); // start empty, configured in edit view
 const result = await createPolicy(fd);
 setLoading(false);
 if (result.error) { toast.error(result.error); return; }
 toast.success("Policy created");
 setOpen(false);
 router.refresh();
 }

 return (
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger render={
 <Button variant="outline" size="sm" className="gap-2 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600" />
 }>
 <Plus className="h-4 w-4" />
 New Policy
 </DialogTrigger>
 <DialogContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 shadow-[0_0_40px_rgba(0,240,255,0.15)] sm:max-w-md">
 <form onSubmit={handleSubmit}>
 <DialogHeader>
 <DialogTitle className="text-blue-600 dark:text-blue-400" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
 Create Policy
 </DialogTitle>
 <DialogDescription className="text-gray-500 dark:text-gray-400">
 A policy defines a named set of permissions. Assign it to roles after creation.
 </DialogDescription>
 </DialogHeader>
 <div className="mt-4 space-y-4">
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">Policy Name <span className="text-red-400">*</span></Label>
 <Input name="name" required className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50" placeholder="e.g. Can view HR collections" />
 </div>
 <div className="space-y-2">
 <Label className="text-gray-900 dark:text-gray-100">Description</Label>
 <Input name="description" className="bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500/50 dark:placeholder:text-gray-400/50" placeholder="Optional" />
 </div>
 </div>
 <DialogFooter className="mt-6">
 <DialogClose render={
 <Button type="button" variant="outline" className="border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400" />
 }>Cancel</DialogClose>
 <Button type="submit" disabled={loading} className="bg-blue-50 dark:bg-blue-950 border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30 hover:text-[#a8c4ff]">
 {loading ? "Creating..." : "Create Policy"}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}