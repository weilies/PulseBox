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
import { createRole } from "@/app/actions/roles";

export function CreateRoleDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await createRole(fd);
    setLoading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Role created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" className="gap-2 bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]" />
      }>
        <Plus className="h-4 w-4" />
        New Role
      </DialogTrigger>
      <DialogContent className="bg-white border border-gray-300 text-gray-900 shadow-[0_0_40px_rgba(0,240,255,0.15)] sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-blue-600" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Create Role
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Define a custom role for this tenant.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-900">Role Name <span className="text-red-400">*</span></Label>
              <Input name="name" required className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50" placeholder="e.g. HR Manager" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">Description</Label>
              <Input name="description" className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50" placeholder="Optional" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <DialogClose render={
              <Button type="button" variant="outline" className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600" />
            }>Cancel</DialogClose>
            <Button type="submit" disabled={loading} className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]">
              {loading ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
