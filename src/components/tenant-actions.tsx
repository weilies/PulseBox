"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { deleteTenant } from "@/app/actions/dashboard";
import { EditTenantDialog } from "@/components/edit-tenant-dialog";

interface TenantActionsProps {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  isSuper: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  timezone?: string | null;
}

export function TenantActions({ tenantId, tenantName, tenantSlug, isSuper, contactName, contactEmail, timezone }: TenantActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    setConfirmOpen(false);

    const formData = new FormData();
    formData.set("tenantId", tenantId);

    const result = await deleteTenant(formData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Tenant "${tenantName}" deleted`);
    }

    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading} />}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-white border-gray-300">
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => setEditOpen(true)}
              className="text-gray-900 focus:bg-gray-100 focus:text-blue-600"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {!isSuper && (
              <DropdownMenuItem
                onClick={() => setConfirmOpen(true)}
                className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Delete Confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-white border border-red-500/30 text-gray-900 shadow-[0_0_40px_rgba(239,68,68,0.15)] max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <TriangleAlert className="h-5 w-5 text-red-400" />
              </div>
              <DialogTitle className="text-red-400" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
                Delete Tenant
              </DialogTitle>
            </div>
            <DialogDescription className="text-gray-500 pt-1">
              Delete <span className="text-gray-900 font-semibold">&quot;{tenantName}&quot;</span>? This will:
              <ul className="mt-1.5 ml-3 list-disc text-xs space-y-0.5">
                <li>Remove all user assignments for this tenant</li>
                <li>Permanently delete users who belong <em>only</em> to this tenant</li>
                <li>Users in multiple tenants will only have this tenant removed</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-blue-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              className="bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 hover:text-red-300"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditTenantDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenantId}
        currentName={tenantName}
        currentSlug={tenantSlug}
        currentContactName={contactName}
        currentContactEmail={contactEmail}
        currentTimezone={timezone}
      />
    </>
  );
}
