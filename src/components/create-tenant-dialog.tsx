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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createTenant } from "@/app/actions/dashboard";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateTenantDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("slug", slug);
    if (contactName) formData.set("contactName", contactName);
    if (contactEmail) formData.set("contactEmail", contactEmail);

    const result = await createTenant(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Tenant "${name}" created`);
    }

    // Always refresh — tenant may have been created even if assign step failed
    setOpen(false);
    setName("");
    setSlug("");
    setContactName("");
    setContactEmail("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-2 bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]" />}>
        <Plus className="h-4 w-4" />
        Create Tenant
      </DialogTrigger>
      <DialogContent className="bg-white border border-gray-300 text-gray-900 shadow-[0_0_40px_rgba(0,240,255,0.15)]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-blue-600" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Create New Tenant
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Add a new client organization to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-name" className="text-gray-900">
                Tenant Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="tenant-name"
                placeholder="Acme Corporation"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(slugify(e.target.value));
                }}
                required
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-slug" className="text-gray-900">
                Slug <span className="text-red-400">*</span>
              </Label>
              <Input
                id="tenant-slug"
                placeholder="acme-corporation"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
              <p className="text-xs text-gray-500">
                Unique identifier used in URLs. Auto-generated from name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-contact-name" className="text-gray-900">Person In Charge</Label>
              <Input
                id="tenant-contact-name"
                placeholder="Jane Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-contact-email" className="text-gray-900">Person In Charge Email</Label>
              <Input
                id="tenant-contact-email"
                type="email"
                placeholder="jane@acmecorp.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <DialogClose render={<Button type="button" variant="outline" className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-50 border border-blue-500/40 text-blue-600 hover:bg-blue-500/30 hover:text-[#a8c4ff]"
            >
              {loading ? "Creating..." : "Create Tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
