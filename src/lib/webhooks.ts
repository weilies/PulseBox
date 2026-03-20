import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookEvent = "item.created" | "item.updated" | "item.deleted";

export interface WebhookPayload {
  event: WebhookEvent;
  collection: string;
  tenant_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function signPayload(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Fire all active webhooks for a collection event.
 * Designed to be called with `after()` (non-blocking, post-response).
 */
export async function fireWebhooks(
  tenantId: string,
  collectionSlug: string,
  event: WebhookEvent,
  itemData: Record<string, unknown>
): Promise<void> {
  const db = createAdminClient();

  const { data: webhooks } = await db
    .from("collection_webhooks")
    .select("id, url, secret, events")
    .eq("tenant_id", tenantId)
    .eq("collection_slug", collectionSlug)
    .eq("is_active", true);

  if (!webhooks?.length) return;

  const matching = webhooks.filter((w) => (w.events as string[]).includes(event));
  if (!matching.length) return;

  const payload: WebhookPayload = {
    event,
    collection: collectionSlug,
    tenant_id: tenantId,
    timestamp: new Date().toISOString(),
    data: itemData,
  };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    matching.map(async (webhook) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-PulseBoard-Event": event,
        "X-PulseBoard-Collection": collectionSlug,
        "User-Agent": "PulseBoard-Webhooks/1.0",
      };
      if (webhook.secret) {
        headers["X-PulseBoard-Signature"] = signPayload(webhook.secret, body);
      }

      let status: "delivered" | "failed" = "failed";
      let responseStatus: number | null = null;
      let responseBody: string | null = null;

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(webhook.url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        responseStatus = res.status;
        responseBody = (await res.text().catch(() => null))?.slice(0, 1000) ?? null;
        status = res.ok ? "delivered" : "failed";
      } catch (err) {
        responseBody = err instanceof Error ? err.message : "Unknown error";
      }

      await db.from("webhook_deliveries").insert({
        webhook_id: webhook.id,
        event_type: event,
        collection_slug: collectionSlug,
        item_id: (itemData.id as string) ?? null,
        payload,
        status,
        response_status: responseStatus,
        response_body: responseBody,
        attempt_count: 1,
        last_attempt_at: new Date().toISOString(),
      });
    })
  );
}

/**
 * Call a collection-level onPreSave hook.
 * Returns a Response to block the save, or null to allow it.
 */
export async function runPreSaveHook(
  hook: Record<string, unknown>,
  collectionSlug: string,
  tenantId: string,
  action: "create" | "update",
  data: unknown,
  itemId?: string
): Promise<Response | null> {
  const url = hook.url as string;
  const timeoutMs = typeof hook.timeout_ms === "number" ? hook.timeout_ms : 5000;
  const failStrict = hook.fail_strict === true;

  const bodyStr = JSON.stringify({
    event: "item.pre_save",
    collection: collectionSlug,
    tenant_id: tenantId,
    action,
    data,
    ...(itemId ? { item_id: itemId } : {}),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-PulseBoard-Event": "item.pre_save",
    "User-Agent": "PulseBoard-Webhooks/1.0",
  };
  if (typeof hook.secret === "string") {
    headers["X-PulseBoard-Signature"] = signPayload(hook.secret, bodyStr);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      let msg = "Pre-save hook rejected the request";
      let fieldErrors: unknown = undefined;
      try {
        const json = await res.json();
        if (json.message) msg = json.message;
        if (json.errors) fieldErrors = json.errors;
      } catch { /* ignore */ }

      if (fieldErrors) {
        return Response.json({ errors: fieldErrors }, { status: 422 });
      }
      return Response.json({ error: msg }, { status: 422 });
    }
  } catch {
    if (failStrict) {
      return Response.json({ error: "Pre-save hook unreachable" }, { status: 503 });
    }
    // fail-open: allow save if hook is unreachable (default)
  }

  return null;
}
