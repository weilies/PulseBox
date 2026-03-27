import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Webhook, CircleCheck, CircleX, Clock, Info } from "lucide-react";
import Link from "next/link";
import { WebhookDialog } from "@/components/webhook-dialog";
import { WebhookActions } from "@/components/webhook-actions";
import { getAllWebhooks, getWebhookDeliveries } from "@/app/actions/webhooks";

export default async function WebhooksPage() {
 const user = await getUser();
 if (!user) notFound();

 const supabase = await createClient();
 const tenantId = await resolveTenant(user.id);
 if (!tenantId) notFound();

 const role = await getUserRole(user.id, tenantId);
 const canEdit = role === "super_admin" || role === "tenant_admin";

 const { data: allCollections } = await supabase
 .from("collections")
 .select("slug, name")
 .eq("is_hidden", false)
 .order("name");

 const webhooks = await getAllWebhooks();

 // Fetch recent deliveries for each webhook (last 5)
 const deliveriesByWebhook: Record<string, Awaited<ReturnType<typeof getWebhookDeliveries>>> = {};
 await Promise.all(
 webhooks.map(async (wh) => {
  deliveriesByWebhook[wh.id] = await getWebhookDeliveries(wh.id, 5);
 })
 );

 // Group by scope_type + scope_id
 type GroupKey = string;
 const grouped: Record<GroupKey, typeof webhooks> = {};
 for (const wh of webhooks) {
 const key = `${wh.scope_type}::${wh.scope_id ?? "_global"}`;
 if (!grouped[key]) grouped[key] = [];
 grouped[key].push(wh);
 }

 const groupKeys = Object.keys(grouped).sort();

 function groupLabel(key: string): { label: string; badge: string } {
 const [scopeType, scopeId] = key.split("::");
 if (scopeType === "auth") return { label: "Auth Events", badge: "auth" };
 if (scopeType === "system") return { label: "System Events", badge: "system" };
 return { label: scopeId === "_global" ? "Global" : scopeId, badge: "collection" };
 }

 return (
 <div className="space-y-6 p-6 max-w-5xl">
  {/* Header */}
  <div className="flex items-center justify-between flex-wrap gap-3">
  <div className="flex items-center gap-3">
   <div className="rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 p-2">
   <Webhook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
   </div>
   <div>
   <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
    Webhooks
   </h1>
   <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
    All webhooks and event hooks across your tenant
   </p>
   </div>
  </div>
  {canEdit && (
   <WebhookDialog collections={allCollections ?? []} />
  )}
  </div>

  {/* Guide */}
  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 overflow-hidden">
  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
   <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
   <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">How Webhooks work</span>
  </div>
  <div className="px-4 py-3 space-y-2 text-xs text-gray-500 dark:text-gray-400">
   <div className="grid sm:grid-cols-2 gap-2">
   <div className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
    <p className="font-medium text-gray-600 dark:text-gray-300 mb-1">Async events (fire-and-forget)</p>
    <p><code className="text-blue-600 dark:text-blue-400">item.created</code>, <code className="text-blue-600 dark:text-blue-400">item.updated</code>, <code className="text-blue-600 dark:text-blue-400">item.deleted</code>, <code className="text-blue-600 dark:text-blue-400">item.post_save</code></p>
    <p className="mt-1">Sent after the action completes. Cannot block the save.</p>
   </div>
   <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
    <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Blocking events</p>
    <p><code className="text-blue-600 dark:text-blue-400">item.pre_save</code></p>
    <p className="mt-1">Sent before save. Return 4xx/5xx to reject with a custom error.</p>
   </div>
   </div>
   <p>
   All webhook calls are logged in the{" "}
   <Link href="/dashboard/studio/logs" className="text-blue-600 dark:text-blue-400 hover:underline">
    Activity Log
   </Link>.
   </p>
  </div>
  </div>

  {/* Webhooks list */}
  {webhooks.length === 0 ? (
  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
   <Webhook className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
   <p className="text-sm text-gray-500 dark:text-gray-400">No webhooks configured yet.</p>
   {canEdit && (
   <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
    Click &ldquo;Add Webhook&rdquo; to get started.
   </p>
   )}
  </div>
  ) : (
  <div className="space-y-6">
   {groupKeys.map((key) => {
   const { label, badge } = groupLabel(key);
   return (
    <div key={key} className="space-y-2">
    <div className="flex items-center gap-2">
     <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</h2>
     <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400">
     {badge}
     </Badge>
     <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400">
     {grouped[key].length} webhook{grouped[key].length !== 1 ? "s" : ""}
     </Badge>
    </div>

    <div className="space-y-3">
     {grouped[key].map((wh) => (
     <div key={wh.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
      <div className="flex-1 min-w-0">
       <div className="flex items-center gap-2 flex-wrap">
       <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{wh.name}</span>
       <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        wh.is_active
         ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
         : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
        }`}
       >
        <span className={`h-1.5 w-1.5 rounded-full ${wh.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
        {wh.is_active ? "Active" : "Inactive"}
       </span>
       {wh.can_block && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        Blocking
        </span>
       )}
       </div>
       <code className="text-xs text-gray-400 dark:text-gray-500 font-mono">{wh.url}</code>
      </div>
      <div className="flex items-center gap-2 shrink-0">
       <div className="hidden sm:flex gap-1">
       {(wh.events as string[]).map((ev) => (
        <span
        key={ev}
        className="rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 font-mono"
        >
        {ev}
        </span>
       ))}
       </div>
       {canEdit && (
       <WebhookActions
        webhook={wh as Parameters<typeof WebhookActions>[0]["webhook"]}
        collectionSlug={(wh.scope_id as string) ?? ""}
       />
       )}
      </div>
      </div>

      {/* Recent deliveries */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50">
      <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-2">Recent deliveries</p>
      {!deliveriesByWebhook[wh.id]?.length ? (
       <p className="text-xs text-gray-400 dark:text-gray-500 italic">No deliveries yet.</p>
      ) : (
       <div className="space-y-1">
       {deliveriesByWebhook[wh.id].map((d) => (
        <div key={d.id} className="flex items-center gap-2 text-xs">
        {d.status === "delivered" ? (
         <CircleCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
        ) : d.status === "failed" ? (
         <CircleX className="h-3.5 w-3.5 text-red-400 shrink-0" />
        ) : (
         <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
        )}
        <code className="text-blue-600 dark:text-blue-400 font-mono">{d.event_type}</code>
        {d.response_status && (
         <span className={`font-mono ${d.response_status < 300 ? "text-emerald-600" : "text-red-400"}`}>
         {d.response_status}
         </span>
        )}
        <span className="text-gray-400 dark:text-gray-500 truncate">
         {new Date(d.created_at).toLocaleString()}
        </span>
        </div>
       ))}
       </div>
      )}
      </div>
     </div>
     ))}
    </div>
    </div>
   );
   })}
  </div>
  )}
 </div>
 );
}
