"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";

interface QueryListActionsProps {
 queryId: string;
 queryName: string;
}

export function QueryListActions({ queryId, queryName }: QueryListActionsProps) {
 const router = useRouter();
 const [open, setOpen] = useState(false);
 const [deleting, setDeleting] = useState(false);

 const handleDelete = async () => {
  setDeleting(true);
  try {
   const res = await fetch(`/api/queries/${queryId}`, { method: "DELETE" });
   if (res.ok) {
    setOpen(false);
    router.refresh();
   }
  } finally {
   setDeleting(false);
  }
 };

 return (
  <>
   <Button
    variant="ghost"
    size="sm"
    className="h-7 w-7 p-0 text-gray-400 dark:text-gray-500 hover:text-red-400 hover:bg-red-500/10"
    onClick={() => setOpen(true)}
   >
    <Trash2 className="h-3.5 w-3.5" />
   </Button>

   <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="bg-white dark:bg-gray-900 border border-red-500/30 text-gray-900 dark:text-gray-100">
     <DialogHeader>
      <DialogTitle className="text-red-400">Delete Query</DialogTitle>
      <DialogDescription className="text-gray-500 dark:text-gray-400">
       Delete <strong className="text-gray-900 dark:text-gray-100">&quot;{queryName}&quot;</strong>? This cannot be undone.
      </DialogDescription>
     </DialogHeader>
     <DialogFooter className="mt-4">
      <Button variant="outline" onClick={() => setOpen(false)} className="border-gray-300 dark:border-gray-600">Cancel</Button>
      <Button
       onClick={handleDelete}
       disabled={deleting}
       className="bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
      >
       {deleting ? "Deleting..." : "Delete Query"}
      </Button>
     </DialogFooter>
    </DialogContent>
   </Dialog>
  </>
 );
}
