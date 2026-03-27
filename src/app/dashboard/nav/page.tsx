import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { Map as MapIcon } from "lucide-react";
import { NavManager } from "@/components/nav-manager";
import type { NavFolder, NavItem } from "@/lib/services/nav.service";

export default async function NavManagementPage() {
 const user = await getUser();
 if (!user) return null;

 const supabase = await createClient();
 const tenantId = await resolveTenant(user.id);
 if (!tenantId) return null;

 const [foldersResult, itemsResult, collectionsResult] = await Promise.all([
 supabase
 .from("nav_folders")
 .select("id, name, icon, parent_id, sort_order")
 .eq("tenant_id", tenantId)
 .order("sort_order"),
 supabase
 .from("nav_items")
 .select("id, resource_type, resource_id, label, icon, folder_id, sort_order")
 .eq("tenant_id", tenantId)
 .order("sort_order"),
 supabase
 .from("collections")
 .select("id, name, slug, type")
 .eq("is_hidden", false)
 .or(`type.eq.system,tenant_id.eq.${tenantId}`)
 .order("name"),
 ]);

 const folders = (foldersResult.data ?? []) as NavFolder[];
 const items = (itemsResult.data ?? []) as NavItem[];
 const collections = (collectionsResult.data ?? []) as Array<{ id: string; name: string; slug: string; type: string }>;

 return (
 <div className="p-6 space-y-6 max-w-6xl">
 <div className="flex items-center gap-3">
 <MapIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
 <div>
 <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
 Navigations
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
 Organize sidebar folders and collection links for this tenant.
 </p>
 </div>
 </div>

 <NavManager
 initialFolders={folders}
 initialItems={items}
 allCollections={collections}
 />
 </div>
 );
}