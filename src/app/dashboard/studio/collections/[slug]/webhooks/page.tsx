import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { Database, Layers, ArrowLeft, Webhook, CircleCheck, CircleX, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { WebhookDialog } from "@/components/webhook-dialog";
import { WebhookActions } from "@/components/webhook-actions";
import { CollectionHooksForm } from "@/components/collection-hooks-form";
import { getWebhooks, getWebhookDeliveries } from "@/app/actions/webhooks";

export default async function WebhooksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getUser();
  if (!user) notFound();

  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  const role = tenantId ? await getUserRole(user.id, tenantId) : null;

  const { data: currentTenant } = tenantId
    ? await supabase.from("tenants").select("is_super").eq("id", tenantId).maybeSingle()
    : { data: null };
  const isSuperAdmin = role === "super_admin" && currentTenant?.is_super === true;

  const { data: collection } = await supabase
    .from("collections")
    .select("id, slug, name, type, hooks")
    .eq("slug", slug)
    .maybeSingle();

  if (!collection) notFound();

  const isSystem = collection.type === "system";
  const canEdit = isSuperAdmin || !isSystem;

  const webhooks = await getWebhooks(slug);

  // Fetch deliveries for all webhooks (last 5 each)
  const deliveriesByWebhook: Record<string, Awaited<ReturnType<typeof getWebhookDeliveries>>> = {};
  await Promise.all(
    webhooks.map(async (wh) => {
      deliveriesByWebhook[wh.id] = await getWebhookDeliveries(wh.id, 5);
    })
  );

  const hooks = (collection.hooks ?? {}) as Record<string, unknown>;
  const preSaveHook = hooks.on_pre_save as Record<string, unknown> | undefined;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Back nav */}
      <Link
        href={isSystem ? "/dashboard/studio/system-collections" : "/dashboard/studio/tenant-collections"}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isSystem ? "Back to System Collections" : "Back to Tenant Collections"}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-gray-300 bg-gray-100 p-2">
            {isSystem ? (
              <Database className="h-4 w-4 text-blue-600" />
            ) : (
              <Layers className="h-4 w-4 text-blue-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
                {collection.name}
              </h1>
              <Badge
                variant="outline"
                className={isSystem
                  ? "border-blue-500/40 text-blue-600 text-xs"
                  : "border-violet-500/40 text-violet-400 text-xs"}
              >
                {isSystem ? "System" : "Tenant"}
              </Badge>
            </div>
            <code className="text-xs text-gray-500 font-mono">{collection.slug}</code>
          </div>
        </div>
        {canEdit && <WebhookDialog collectionSlug={slug} />}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        <Link
          href={`/dashboard/studio/collections/${slug}/schema`}
          className="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          Schema
        </Link>
        <Link
          href={`/dashboard/studio/collections/${slug}/items`}
          className="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          Items
        </Link>
        <Link
          href={`/dashboard/studio/collections/${slug}/webhooks`}
          className="px-4 py-2 text-sm text-blue-600 border-b-2 border-blue-400 font-medium"
        >
          Webhooks
        </Link>
      </div>

      {/* onPreSave hook */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Collection Hooks</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            <code className="text-blue-600 font-mono">onPreSave</code> — called before every write.
            Return non-2xx to block the save with a custom error. Works server-side; no JS required.
          </p>
        </div>

        <CollectionHooksForm
          collectionSlug={slug}
          canEdit={canEdit}
          preSaveUrl={(preSaveHook?.url as string) ?? ""}
          preSaveTimeoutMs={(preSaveHook?.timeout_ms as number) ?? 5000}
          preSaveSecret={(preSaveHook?.secret as string) ?? ""}
          preSaveFailStrict={(preSaveHook?.fail_strict as boolean) ?? false}
        />
      </div>

      {/* Outbound webhooks */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Outbound Webhooks</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            HTTP POST fired after <code className="text-blue-600 font-mono">item.created</code>,{" "}
            <code className="text-blue-600 font-mono">item.updated</code>, or{" "}
            <code className="text-blue-600 font-mono">item.deleted</code>. Non-blocking — does not delay the response.
          </p>
        </div>

        {webhooks.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white py-10 text-center">
            <Webhook className="h-6 w-6 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No webhooks yet.</p>
            {canEdit && (
              <p className="text-xs text-gray-400 mt-1">
                Add one to receive HTTP callbacks when items change.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {/* Webhook header row */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{wh.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          wh.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${wh.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                        {wh.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <code className="text-xs text-gray-400 font-mono">{wh.url}</code>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex gap-1">
                      {(wh.events as string[]).map((ev) => (
                        <span
                          key={ev}
                          className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-xs text-blue-600 font-mono"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                    {canEdit && (
                      <WebhookActions
                        webhook={wh as Parameters<typeof WebhookActions>[0]["webhook"]}
                        collectionSlug={slug}
                      />
                    )}
                  </div>
                </div>

                {/* Recent deliveries */}
                <div className="px-4 py-2 bg-gray-50">
                  <p className="text-xs text-gray-400 font-medium mb-2">Recent deliveries</p>
                  {deliveriesByWebhook[wh.id]?.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No deliveries yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {deliveriesByWebhook[wh.id]?.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-xs">
                          {d.status === "delivered" ? (
                            <CircleCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          ) : d.status === "failed" ? (
                            <CircleX className="h-3.5 w-3.5 text-red-400 shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          )}
                          <code className="text-blue-600 font-mono">{d.event_type}</code>
                          {d.response_status && (
                            <span className={`font-mono ${d.response_status < 300 ? "text-emerald-600" : "text-red-400"}`}>
                              {d.response_status}
                            </span>
                          )}
                          <span className="text-gray-400 truncate">
                            {new Date(d.created_at).toLocaleString()}
                          </span>
                          {d.response_body && (
                            <span className="text-gray-400 truncate max-w-xs hidden md:block" title={d.response_body}>
                              {d.response_body}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Field-level validation note */}
      <div className="rounded-lg border border-gray-100 bg-white/50 p-4">
        <p className="text-xs text-gray-500">
          <span className="text-gray-900 font-medium">Field-level validation</span> is configured per-field in the{" "}
          <Link href={`/dashboard/studio/collections/${slug}/schema`} className="text-blue-600 hover:underline">
            Schema
          </Link>{" "}
          tab. Add <code className="text-blue-600 font-mono">options.validation</code> rules (
          <code className="text-blue-600 font-mono">pattern</code>,{" "}
          <code className="text-blue-600 font-mono">min</code>,{" "}
          <code className="text-blue-600 font-mono">max</code>,{" "}
          <code className="text-blue-600 font-mono">webhook_url</code>
          ) to run server-side checks before every save. See the{" "}
          <Link href="/developer#webhooks" className="text-blue-600 hover:underline">
            Developer Docs
          </Link>{" "}
          for the full reference.
        </p>
      </div>
    </div>
  );
}
