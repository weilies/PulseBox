"use client";

import { useState } from "react";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuGroup,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye } from "lucide-react";
import { UserDetailDialog } from "@/components/user-detail-dialog";

interface RoleOption {
 slug: string;
 name: string;
}

interface MemberActionsProps {
 userId: string;
 tenantId: string;
 currentRole: string;
 fullName: string;
 email: string;
 status: string;
 isSuperAdmin?: boolean;
 isSuperTenant?: boolean;
 allTenants?: any[];
 availableRoles: RoleOption[];
}

export function MemberActions({
 userId,
 tenantId,
 currentRole,
 fullName,
 email,
 status,
 isSuperAdmin,
 isSuperTenant,
 allTenants,
 availableRoles,
}: MemberActionsProps) {
 const [detailOpen, setDetailOpen] = useState(false);

 return (
  <>
   <DropdownMenu>
    <DropdownMenuTrigger
     className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
     <MoreHorizontal className="h-4 w-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
     <DropdownMenuGroup>
      <DropdownMenuItem
       onClick={() => setDetailOpen(true)}
       className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400 dark:text-blue-400"
      >
       <Eye className="mr-2 h-4 w-4" />
       View / Edit
      </DropdownMenuItem>
     </DropdownMenuGroup>
    </DropdownMenuContent>
   </DropdownMenu>

   <UserDetailDialog
    open={detailOpen}
    onOpenChange={setDetailOpen}
    userId={userId}
    fullName={fullName}
    email={email}
    role={currentRole}
    status={status}
    isSuperAdmin={isSuperAdmin}
    allTenants={allTenants}
    tenantId={tenantId}
    availableRoles={availableRoles}
   />
  </>
 );
}
