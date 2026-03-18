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
import { toast } from "sonner";
import { updateTenant } from "@/app/actions/dashboard";
import { COMMON_TIMEZONES } from "@/lib/timezone-constants";

interface EditTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  currentName: string;
  currentSlug: string;
  currentContactName?: string | null;
  currentContactEmail?: string | null;
  currentTimezone?: string | null;
}

export function EditTenantDialog({
  open,
  onOpenChange,
  tenantId,
  currentName,
  currentSlug,
  currentContactName,
  currentContactEmail,
  currentTimezone,
}: EditTenantDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [slug, setSlug] = useState(currentSlug);
  const [contactName, setContactName] = useState(currentContactName ?? "");
  const [contactEmail, setContactEmail] = useState(currentContactEmail ?? "");
  const [timezone, setTimezone] = useState(currentTimezone ?? "Asia/Singapore");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.set("tenantId", tenantId);
    formData.set("name", name);
    formData.set("slug", slug);
    formData.set("timezone", timezone);
    if (contactName) formData.set("contactName", contactName);
    if (contactEmail) formData.set("contactEmail", contactEmail);

    const result = await updateTenant(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Tenant updated");
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border border-gray-300 text-gray-900 shadow-[0_0_40px_rgba(0,240,255,0.15)]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-blue-600" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Edit Tenant
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Update tenant information.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tenant-name" className="text-gray-900">
                Tenant Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="edit-tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tenant-slug" className="text-gray-900">
                Slug <span className="text-red-400">*</span>
              </Label>
              <Input
                id="edit-tenant-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tenant-contact-name" className="text-gray-900">Person In Charge</Label>
              <Input
                id="edit-tenant-contact-name"
                placeholder="Jane Smith"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-tenant-contact-email" className="text-gray-900">Person In Charge Email</Label>
              <Input
                id="edit-tenant-contact-email"
                type="email"
                placeholder="jane@acmecorp.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-500/50 focus:border-blue-500/60 focus:ring-blue-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-900">
                Default Timezone <span className="text-red-400">*</span>
              </Label>
              <Select value={timezone} onValueChange={(v) => { if (v) setTimezone(v); }}>
                <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300 text-gray-900 max-h-60">
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value} className="text-sm">
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Users can override this in their profile.</p>
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
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
