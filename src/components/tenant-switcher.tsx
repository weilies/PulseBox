"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, Star } from "lucide-react";
import { TENANT_COOKIE } from "@/lib/constants";
import { setDefaultTenant } from "@/app/actions/dashboard";
import { toast } from "sonner";

interface TenantSwitcherProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tenants: any[];
  currentTenantId: string | null;
}

export function TenantSwitcher({ tenants, currentTenantId }: TenantSwitcherProps) {
  const router = useRouter();
  const currentTenant = tenants.find((t) => t.tenant_id === currentTenantId);
  const currentName = currentTenant?.tenants?.name || "Select tenant";
  const nonDefaultTenants = tenants.filter((t) => !t.is_default);

  function switchTenant(tenantId: string) {
    document.cookie = `${TENANT_COOKIE}=${tenantId};path=/;samesite=lax`;
    router.refresh();
  }

  async function handleSetDefault(tenantId: string) {
    const formData = new FormData();
    formData.set("tenantId", tenantId);
    const result = await setDefaultTenant(formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Default tenant updated");
    }
  }

  if (tenants.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="h-4 w-4" />
        {currentName}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
        <Building2 className="h-4 w-4" />
        {currentName}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch Tenant</DropdownMenuLabel>
          {tenants.map((t) => (
            <DropdownMenuItem
              key={t.tenant_id}
              onClick={() => switchTenant(t.tenant_id)}
              className={t.tenant_id === currentTenantId ? "bg-zinc-100 dark:bg-zinc-800" : ""}
            >
              <span className="flex-1">{t.tenants?.name || "Unknown"}</span>
              {t.is_default && <Star className="ml-2 h-3 w-3 fill-amber-400 text-amber-400" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {nonDefaultTenants.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-normal text-zinc-500">Set default</DropdownMenuLabel>
              {nonDefaultTenants.map((t) => (
                <DropdownMenuItem
                  key={`default-${t.tenant_id}`}
                  onClick={() => handleSetDefault(t.tenant_id)}
                >
                  <Star className="mr-2 h-3 w-3" />
                  {t.tenants?.name || "Unknown"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
