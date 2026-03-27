"use client";

import { useRouter } from "next/navigation";
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Eye } from "lucide-react";

interface RoleActionsProps {
 roleId: string;
 isSystem: boolean;
}

export function RoleActions({ roleId, isSystem }: RoleActionsProps) {
 const router = useRouter();

 return (
  <DropdownMenu>
   <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
    <MoreHorizontal className="h-4 w-4" />
   </DropdownMenuTrigger>
   <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
    <DropdownMenuItem
     onClick={() => router.push(`/dashboard/roles/${roleId}`)}
     className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
    >
     {isSystem ? (
      <>
       <Eye className="mr-2 h-4 w-4" />
       View Details
      </>
     ) : (
      <>
       <Pencil className="mr-2 h-4 w-4" />
       Edit / Assign Policies
      </>
     )}
    </DropdownMenuItem>
   </DropdownMenuContent>
  </DropdownMenu>
 );
}