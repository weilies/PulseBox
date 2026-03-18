"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteRole } from "@/app/actions/roles";

interface RoleActionsProps {
  roleId: string;
  roleName: string;
  isSystem: boolean;
}

export function RoleActions({ roleId, roleName, isSystem }: RoleActionsProps) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return;
    const fd = new FormData();
    fd.set("role_id", roleId);
    const result = await deleteRole(fd);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Role deleted");
    router.refresh();
  }

  if (isSystem) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors">
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border-gray-300 text-gray-900">
        <DropdownMenuItem
          onClick={() => router.push(`/dashboard/roles/${roleId}`)}
          className="cursor-pointer hover:bg-gray-100 hover:text-blue-600"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit / Assign Policies
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleDelete}
          className="cursor-pointer text-red-400 hover:bg-red-50 hover:text-red-300 focus:text-red-400"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Role
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
