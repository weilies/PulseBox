"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePolicy } from "@/app/actions/roles";

interface DeletePolicyButtonProps {
 policyId: string;
 policyName: string;
}

export function DeletePolicyButton({ policyId, policyName }: DeletePolicyButtonProps) {
 const router = useRouter();
 const [open, setOpen] = useState(false);
 const [loading, setLoading] = useState(false);

 async function handleDelete() {
  setLoading(true);
  const fd = new FormData();
  fd.set("policy_id", policyId);
  const result = await deletePolicy(fd);
  setLoading(false);
  if (result.error) { toast.error(result.error); return; }
  toast.success("Policy deleted");
  setOpen(false);
  router.push("/dashboard/policies");
 }

 return (
  <>
   <Button
    variant="outline"
    size="sm"
    className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
    onClick={() => setOpen(true)}
   >
    <Trash2 className="h-4 w-4 mr-2" />
    Delete Policy
   </Button>
   <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="bg-white dark:bg-gray-900 border border-red-500/30 text-gray-900 dark:text-gray-100">
     <DialogHeader>
      <DialogTitle className="text-red-400">Delete Policy</DialogTitle>
      <DialogDescription className="text-gray-500 dark:text-gray-400">
       Delete <strong className="text-gray-900 dark:text-gray-100">&quot;{policyName}&quot;</strong>? Any roles using this policy will lose its permissions. This cannot be undone.
      </DialogDescription>
     </DialogHeader>
     <DialogFooter className="mt-4">
      <Button variant="outline" onClick={() => setOpen(false)} className="border-gray-300 dark:border-gray-600">Cancel</Button>
      <Button
       onClick={handleDelete}
       disabled={loading}
       className="bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
      >
       {loading ? "Deleting..." : "Delete Policy"}
      </Button>
     </DialogFooter>
    </DialogContent>
   </Dialog>
  </>
 );
}
