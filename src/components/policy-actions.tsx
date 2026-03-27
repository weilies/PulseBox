"use client";

import { useRouter } from "next/navigation";
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil } from "lucide-react";

interface PolicyActionsProps {
 policyId: string;
 policyName: string;
 isSystem: boolean;
}

export function PolicyActions({ policyId }: PolicyActionsProps) {
 const router = useRouter();

 return (
 <DropdownMenu>
 <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
 <MoreHorizontal className="h-4 w-4" />
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
 <DropdownMenuItem
 onClick={() => router.push(`/dashboard/policies/${policyId}`)}
 className="cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:bg-gray-800 focus:text-blue-600 dark:text-blue-400"
 >
 <Pencil className="mr-2 h-4 w-4" />
 Edit Permissions
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 );
}