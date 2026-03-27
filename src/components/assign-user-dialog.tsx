"use client";

import { useState } from "react";
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
import { UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { assignUserToTenant } from "@/app/actions/dashboard";
import { ROLES } from "@/lib/constants";

const ROLE_LABELS: Record<string, string> = {
 [ROLES.TENANT_ADMIN]: "Tenant Admin",
 [ROLES.SUPER_ADMIN]: "Super Admin",
};

interface AssignUserDialogProps {
 tenantId: string;
 isSuperTenant?: boolean;
}

export function AssignUserDialog({ tenantId, isSuperTenant }: AssignUserDialogProps) {
 const [open, setOpen] = useState(false);
 const [loading, setLoading] = useState(false);
 const [role, setRole] = useState<string>(ROLES.TENANT_ADMIN);

 async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setLoading(true);

  const form = e.currentTarget;
  const formData = new FormData(form);
  formData.set("tenantId", tenantId);
  formData.set("role", role);

  const result = await assignUserToTenant(formData);
  setLoading(false);

  if (result.error) {
   toast.error(result.error);
  } else {
   toast.success("User assigned to tenant");
   setOpen(false);
   form.reset();
   setRole(ROLES.TENANT_ADMIN);
  }
 }

 return (
  <Dialog open={open} onOpenChange={setOpen}>
   <DialogTrigger render={<Button size="sm" variant="outline" className="gap-2" />}>
    <UserRoundPlus className="h-4 w-4" />
    Add Existing User
   </DialogTrigger>
   <DialogContent>
    <form onSubmit={handleSubmit}>
     <DialogHeader>
      <DialogTitle>Add Existing User</DialogTitle>
      <DialogDescription>
       Assign an existing platform user to this tenant. The user must
       already have an account.
      </DialogDescription>
     </DialogHeader>
     <div className="mt-4 space-y-4">
      <div className="space-y-2">
       <Label htmlFor="assign-email">User Email</Label>
       <Input
        id="assign-email"
        name="email"
        type="email"
        placeholder="user@example.com"
        required
       />
      </div>
      <div className="space-y-2">
       <Label>Role</Label>
       <Select value={role} onValueChange={(v) => v && setRole(v)}>
        <SelectTrigger>
         <SelectValue>{ROLE_LABELS[role] ?? role}</SelectValue>
        </SelectTrigger>
        <SelectContent>
         <SelectItem value={ROLES.TENANT_ADMIN}>Tenant Admin</SelectItem>
         {isSuperTenant && (
          <SelectItem value={ROLES.SUPER_ADMIN}>Super Admin</SelectItem>
         )}
        </SelectContent>
       </Select>
      </div>
     </div>
     <DialogFooter className="mt-6">
      <DialogClose render={<Button type="button" variant="outline" />}>
       Cancel
      </DialogClose>
      <Button type="submit" disabled={loading}>
       {loading ? "Assigning..." : "Add User"}
      </Button>
     </DialogFooter>
    </form>
   </DialogContent>
  </Dialog>
 );
}
