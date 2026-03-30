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
import { updateUserProfile, deleteUser, assignUserToTenant, removeUserFromTenant, updateUserRole, updateUserStatus } from "@/app/actions/dashboard";
import { AvatarUpload } from "@/components/avatar-upload";
import { DestructiveAlert } from "@/components/destructive-alert";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { STATUS_LABELS } from "@/lib/constants";

interface RoleOption {
 slug: string;
 name: string;
}

interface TenantOption {
 id: string;
 name: string;
 slug?: string;
}

interface UserDetailDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 userId: string;
 fullName: string;
 email: string;
 role: string;
 status: string;
 isSuperAdmin?: boolean;
 allTenants?: TenantOption[];
 tenantId: string;
 availableRoles: RoleOption[];
}

export function UserDetailDialog({
 open,
 onOpenChange,
 userId,
 fullName,
 email,
 role,
 status,
 isSuperAdmin,
 allTenants,
 tenantId,
 availableRoles,
}: UserDetailDialogProps) {
 const router = useRouter();
 const [name, setName] = useState(fullName);
 const [selectedRole, setSelectedRole] = useState(role);
 const [selectedStatus, setSelectedStatus] = useState(status);
 const [targetTenantId, setTargetTenantId] = useState(tenantId);
 const [saving, setSaving] = useState(false);
 const [deleting, setDeleting] = useState(false);
 const [removing, setRemoving] = useState(false);
 const [confirmDelete, setConfirmDelete] = useState(false);
 const [confirmRemove, setConfirmRemove] = useState(false);
 const [confirmRoleChange, setConfirmRoleChange] = useState(false);

 const hasChanges = name !== fullName || selectedRole !== role || selectedStatus !== status;

 const currentRoleLabel = availableRoles.find(r => r.slug === selectedRole)?.name ?? selectedRole;
 const originalRoleLabel = availableRoles.find(r => r.slug === role)?.name ?? role;
 const currentStatusLabel = STATUS_LABELS[selectedStatus] ?? selectedStatus;
 const currentTenantName = allTenants?.find(t => t.id === targetTenantId)?.name ?? targetTenantId;

 async function doSave() {
  setSaving(true);
  setConfirmRoleChange(false);

  const promises: Promise<{ error?: string }>[] = [];

  if (name !== fullName) {
   const formData = new FormData();
   formData.set("userId", userId);
   formData.set("fullName", name);
   formData.set("tenantId", tenantId);
   promises.push(updateUserProfile(formData));
  }

  if (selectedRole !== role) {
   const formData = new FormData();
   formData.set("userId", userId);
   formData.set("tenantId", tenantId);
   formData.set("role", selectedRole);
   promises.push(updateUserRole(formData));
  }

  if (selectedStatus !== status) {
   const formData = new FormData();
   formData.set("userId", userId);
   formData.set("tenantId", tenantId);
   formData.set("status", selectedStatus);
   promises.push(updateUserStatus(formData));
  }

  const results = await Promise.all(promises);
  const errors = results.filter((r) => r.error).map((r) => r.error!);
  setSaving(false);

  if (errors.length > 0) {
   toast.error(errors.join("; "));
  } else {
   toast.success("User updated");
   onOpenChange(false);
  }
 }

 async function handleSave() {
  if (!name.trim()) return;
  if (selectedRole !== role) {
   setConfirmRoleChange(true);
   return;
  }
  await doSave();
 }

 async function handleDelete() {
  setDeleting(true);

  const formData = new FormData();
  formData.set("userId", userId);
  formData.set("tenantId", tenantId);

  const result = await deleteUser(formData);
  setDeleting(false);

  if (result.error) {
   toast.error(result.error);
   setConfirmDelete(false);
  } else {
   toast.success("User deleted");
   onOpenChange(false);
   router.refresh();
  }
 }

 async function handleRemove() {
  setRemoving(true);

  const formData = new FormData();
  formData.set("userId", userId);
  formData.set("tenantId", tenantId);

  const result = await removeUserFromTenant(formData);
  setRemoving(false);

  if (result.error) {
   toast.error(result.error);
   setConfirmRemove(false);
  } else {
   toast.success("User removed from tenant");
   onOpenChange(false);
   router.refresh();
  }
 }

 async function handleMoveTenant() {
  if (targetTenantId === tenantId) return;
  setSaving(true);

  const addData = new FormData();
  addData.set("tenantId", targetTenantId);
  addData.set("email", email);
  addData.set("role", selectedRole);

  const removeData = new FormData();
  removeData.set("tenantId", tenantId);
  removeData.set("userId", userId);

  const result = await assignUserToTenant(addData);
  if (!result.error) {
   await removeUserFromTenant(removeData);
   toast.success("User moved to new tenant");
   onOpenChange(false);
   router.refresh();
  } else {
   toast.error(result.error);
  }
  setSaving(false);
 }

 return (
  <Dialog open={open} onOpenChange={onOpenChange}>
   <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
    <DialogHeader>
     <DialogTitle>User Details</DialogTitle>
     <DialogDescription>View and edit user information.</DialogDescription>
    </DialogHeader>

    <div className="mt-4 space-y-4 overflow-y-auto pr-2 flex-1">
     {/* Avatar */}
     <div className="flex items-center gap-4">
      <AvatarUpload
       initials={
        fullName
         ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
         : email.slice(0, 2).toUpperCase()
       }
       targetUserId={userId}
       size="lg"
      />
      <p className="text-xs text-gray-400 dark:text-gray-500">Click avatar to upload photo</p>
     </div>

     <div className="space-y-2">
      <Label htmlFor="detail-name">Full Name</Label>
      <Input
       id="detail-name"
       value={name}
       onChange={(e) => setName(e.target.value)}
      />
     </div>

     <div className="space-y-2">
      <Label>Email</Label>
      <Input value={email} disabled className="bg-muted" />
     </div>

     <div className="grid grid-cols-2 gap-4">
      {/* Role dropdown */}
      <div className="space-y-2">
       <Label>Role</Label>
       <Select value={selectedRole} onValueChange={(v) => { if (v) { setSelectedRole(v); setConfirmRoleChange(false); } }}>
        <SelectTrigger>
         <SelectValue>{currentRoleLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
         {availableRoles.map((r) => (
          <SelectItem key={r.slug} value={r.slug}>
           {r.name}
          </SelectItem>
         ))}
        </SelectContent>
       </Select>
      </div>

      {/* Status dropdown */}
      <div className="space-y-2">
       <Label>Status</Label>
       <Select value={selectedStatus} onValueChange={(v) => v && setSelectedStatus(v)}>
        <SelectTrigger>
         <SelectValue>{currentStatusLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
         <SelectItem value="active">Active</SelectItem>
         <SelectItem value="inactive">Inactive</SelectItem>
         <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
       </Select>
      </div>
     </div>

     {isSuperAdmin && allTenants && (
      <div className="space-y-2 border-t pt-4">
       <Label>Move to Tenant</Label>
       <div className="flex gap-2">
        <Select value={targetTenantId} onValueChange={(v) => v && setTargetTenantId(v)}>
         <SelectTrigger className="flex-1">
          <SelectValue>{currentTenantName}</SelectValue>
         </SelectTrigger>
         <SelectContent>
          {allTenants.map((t) => (
           <SelectItem key={t.id} value={t.id}>
            {t.name || t.slug || t.id}
           </SelectItem>
          ))}
         </SelectContent>
        </Select>
        <Button variant="secondary" size="sm" onClick={handleMoveTenant} disabled={saving || targetTenantId === tenantId}>
         Move
        </Button>
       </div>
      </div>
     )}

     {/* Remove from Tenant */}
     <div className="border-t pt-4">
      {!confirmRemove ? (
       <Button
        variant="destructive"
        size="sm"
        className="w-full"
        onClick={() => setConfirmRemove(true)}
       >
        Remove from Tenant
       </Button>
      ) : (
       <ConfirmActionDialog
        isOpen={confirmRemove}
        severity="danger"
        message="Remove this user from the tenant? They will lose access but their account remains."
        confirmLabel="Confirm Remove"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
        isLoading={removing}
       />
      )}
     </div>

     {/* Role change confirmation */}
     {confirmRoleChange && (
      <DestructiveAlert
       severity="warning"
       message={`Change role from ${originalRoleLabel} to ${currentRoleLabel}? This will update what this user can access.`}
      >
       <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => setConfirmRoleChange(false)}>
         Back
        </Button>
        <Button
         size="sm"
         onClick={doSave}
         disabled={saving}
         variant="default"
        >
         {saving ? "Saving..." : "Confirm & Save"}
        </Button>
       </div>
      </DestructiveAlert>
     )}
    </div>

    <DialogFooter className="mt-6">
     <div className="w-full space-y-4">
      {confirmDelete && (
       <ConfirmActionDialog
        isOpen={confirmDelete}
        severity="danger"
        title="Delete User"
        message="This will permanently delete the user account and all associated data. This cannot be undone."
        confirmLabel="Confirm Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        isLoading={deleting}
       />
      )}
      <div className="flex items-center justify-between">
       <div>
        {!confirmDelete && (
         <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmDelete(true)}
         >
          Delete User
         </Button>
        )}
       </div>
       <div className="flex gap-2">
        <DialogClose render={<Button type="button" variant="outline" />}>
         Close
        </DialogClose>
        <Button onClick={handleSave} disabled={saving || !hasChanges || confirmRoleChange || confirmDelete}>
         {saving ? "Saving..." : "Save Changes"}
        </Button>
       </div>
      </div>
     </div>
    </DialogFooter>
   </DialogContent>
  </Dialog>
 );
}
