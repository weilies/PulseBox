"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deletePolicy } from "@/app/actions/roles";

interface PolicyActionsProps {
  policyId: string;
  policyName: string;
  isSystem: boolean;
}

export function PolicyActions({ policyId, policyName, isSystem }: PolicyActionsProps) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete policy "${policyName}"? Any roles assigned this policy will lose its permissions.`)) return;
    const fd = new FormData();
    fd.set("policy_id", policyId);
    const result = await deletePolicy(fd);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Policy deleted");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border-gray-300 text-gray-900">
        <DropdownMenuItem
          onClick={() => router.push(`/dashboard/policies/${policyId}`)}
          className="cursor-pointer text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:text-blue-600"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit Permissions
        </DropdownMenuItem>
        {!isSystem && (
          <DropdownMenuItem
            onClick={handleDelete}
            className="cursor-pointer text-red-400 hover:bg-red-50 hover:text-red-300 focus:text-red-400"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Policy
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
