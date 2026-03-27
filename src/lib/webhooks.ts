import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WebhookEvent =
  | "item.created" | "item.updated" | "item.deleted"
  | "item.pre_save" | "item.post_save"
  | "auth.login" | "auth.logout";

export interface WebhookPayload {
  event: string;
  collection?: string;
  tenant_id: string;
  timestamp: string;
  data: Record<string, unknown>;
  action?: string;
  item_id?: string;
}

type WebhookRow = {
  id: string;
  url: string;
  secret: string | null;
  events: string[];
  can_block: boolean;
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function signPayload(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function logEvent(
  tenantId: string,
  webhookId: string,
  eventType: string,
  scopeType: string,
  scopeId: string | null,
  requestUrl: string,
  requestBody: unknown,
  status: "delivered" | "failed" | "blocked",
  responseStatus: number | null,
  responseBody: string | null,
  durationMs: number | null
) {
  const db = createAdminClient();
  await db.from("event_logs").insert({
    tenant_id: tenantId,
    category: "webhook",
    event_type: eventType,
    source_type: "webhook",
    source_id: webhookId,
    scope_type: scopeType,
    scope_id: scopeId,
    request_url: requestUrl,
    request_body: requestBody,
    status,
    response_status: responseStatus,
    response_body: responseBody,
    duration_ms: durationMs,
  });
}

/**
 * Query active webhooks from the unified table matching scope + event.
 */
async function getMatchingWebhooks(
  tenantId: string,
  scopeType: string,
  scopeId: string | null,
  event: string
): Promise<WebhookRow[]> {
  const db = createAdminClient();
  let query = db
    .from("webhooks")
    .select("id, url, secret, events, can_block, config")
    .eq("tenant_id", tenantId)
    .eq("scope_type", scopeType)
    .eq("is_active", true)
    .contains("events", [event]);

  if (scopeId) {
    query = query.eq("scope_id", scopeId);
  }

  const { data } = await query;
  return (data ?? []) as WebhookRow[];
}

// ---------------------------------------------------------------------------
// Fire async webhooks (non-blocking, for item.created/updated/deleted/post_save)
// ---------------------------------------------------------------------------

/**
 * Fire all active webhooks for a collection event.
 * Designed to be called inside `after()` (non-blocking, post-response).
 */
export async function fireWebhooks(
  tenantId: string,
  collectionSlug: string,
  event: WebhookEvent,
  itemData: Record<string, unknown>
): Promise<void> {
  const webhooks = await getMatchingWebhooks(tenantId, "collection", collectionSlug, event);
  if (!webhooks.length) return;

  const payload: WebhookPayload = {
    event,
    collection: collectionSlug,
    tenant_id: tenantId,
    timestamp: new Date().toISOString(),
    data: itemData,
  };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-PulseBox-Event": event,
        "X-PulseBox-Collection": collectionSlug,
        "User-Agent": "PulseBox-Webhooks/1.0",
      };
      if (webhook.secret) {
        headers["X-PulseBox-Signature"] = signPayload(webhook.secret, body);
      }

      let status: "delivered" | "failed" = "failed";
      let responseStatus: number | null = null;
      let responseBody: string | null = null;
      const start = Date.now();

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(webhook.url, {
          method: "POST", headers, body,
          signal: controller.signal,
        });
        clearTimeout(timer);
        responseStatus = res.status;
        responseBody = (await res.text().catch(() => null))?.slice(0, 1000) ?? null;
        status = res.ok ? "delivered" : "failed";
      } catch (err) {
        responseBody = err instanceof Error ? err.message : "Unknown error";
      }

      await logEvent(
        tenantId, webhook.id, event, "collection", collectionSlug,
        webhook.url, payload, status, responseStatus, responseBody,
        Date.now() - start
      );
    })
  );
}

// ---------------------------------------------------------------------------
// Fire post-save webhooks (item.post_save event — non-blocking)
// ---------------------------------------------------------------------------

export async function firePostSaveWebhooks(
  tenantId: string,
  collectionSlug: string,
  action: "create" | "update" | "delete",
  data: unknown,
  itemId?: string
): Promise<void> {
  const webhooks = await getMatchingWebhooks(tenantId, "collection", collectionSlug, "item.post_save");
  if (!webhooks.length) return;

  const payload = {
    event: "item.post_save",
    collection: collectionSlug,
    tenant_id: tenantId,
    action,
    data,
    ...(itemId ? { item_id: itemId } : {}),
  };
  const bodyStr = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-PulseBox-Event": "item.post_save",
        "User-Agent": "PulseBox-Webhooks/1.0",
      };
      if (webhook.secret) {
        headers["X-PulseBox-Signature"] = signPayload(webhook.secret, bodyStr);
      }

      let status: "delivered" | "failed" = "failed";
      let responseStatus: number | null = null;
      let responseBody: string | null = null;
      const start = Date.now();

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(webhook.url, {
          method: "POST", headers, body: bodyStr,
          signal: controller.signal,
        });
        clearTimeout(timer);
        responseStatus = res.status;
        responseBody = (await res.text().catch(() => null))?.slice(0, 1000) ?? null;
        status = res.ok ? "delivered" : "failed";
      } catch (err) {
        responseBody = err instanceof Error ? err.message : "Unknown error";
      }

      await logEvent(
        tenantId, webhook.id, "item.post_save", "collection", collectionSlug,
        webhook.url, payload, status, responseStatus, responseBody,
        Date.now() - start
      );
    })
  );
}

// ---------------------------------------------------------------------------
// Run pre-save webhooks (item.pre_save — synchronous, can block)
// ---------------------------------------------------------------------------

/**
 * Run all pre-save webhooks for a collection.
 * Returns a Response to block the save, or null to allow it.
 */
export async function runPreSaveWebhooks(
  tenantId: string,
  collectionSlug: string,
  action: "create" | "update",
  data: unknown,
  itemId?: string
): Promise<Response | null> {
  const webhooks = await getMatchingWebhooks(tenantId, "collection", collectionSlug, "item.pre_save");
  if (!webhooks.length) return null;

  for (const webhook of webhooks) {
    const timeoutMs = typeof webhook.config.timeout_ms === "number" ? webhook.config.timeout_ms : 5000;
    const failStrict = webhook.config.fail_strict === true;

    const payload = {
      event: "item.pre_save",
      collection: collectionSlug,
      tenant_id: tenantId,
      action,
      data,
      ...(itemId ? { item_id: itemId } : {}),
    };
    const bodyStr = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-PulseBox-Event": "item.pre_save",
      "User-Agent": "PulseBox-Webhooks/1.0",
    };
    if (webhook.secret) {
      headers["X-PulseBox-Signature"] = signPayload(webhook.secret, bodyStr);
    }

    const start = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(webhook.url, {
        method: "POST", headers, body: bodyStr,
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

        await logEvent(
          tenantId, webhook.id, "item.pre_save", "collection", collectionSlug,
          webhook.url, payload, "blocked", res.status, msg,
          Date.now() - start
        );

        if (fieldErrors) {
          return Response.json({ errors: fieldErrors }, { status: 422 });
        }
        return Response.json({ error: msg }, { status: 422 });
      }

      await logEvent(
        tenantId, webhook.id, "item.pre_save", "collection", collectionSlug,
        webhook.url, payload, "delivered", res.status, null,
        Date.now() - start
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await logEvent(
        tenantId, webhook.id, "item.pre_save", "collection", collectionSlug,
        webhook.url, payload, "failed", null, errMsg,
        Date.now() - start
      );

      if (failStrict) {
        return Response.json({ error: "Pre-save hook unreachable" }, { status: 503 });
      }
      // fail-open: allow save if hook is unreachable (default)
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auth event webhooks (auth.login, auth.logout)
// ---------------------------------------------------------------------------

export async function fireAuthWebhooks(
  tenantId: string,
  event: "auth.login" | "auth.logout",
  data: Record<string, unknown>
): Promise<void> {
  const webhooks = await getMatchingWebhooks(tenantId, "auth", null, event);
  if (!webhooks.length) return;

  const payload = {
    event,
    tenant_id: tenantId,
    timestamp: new Date().toISOString(),
    data,
  };
  const bodyStr = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks.map(async (webhook) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-PulseBox-Event": event,
        "User-Agent": "PulseBox-Webhooks/1.0",
      };
      if (webhook.secret) {
        headers["X-PulseBox-Signature"] = signPayload(webhook.secret, bodyStr);
      }

      let status: "delivered" | "failed" = "failed";
      let responseStatus: number | null = null;
      let responseBody: string | null = null;
      const start = Date.now();

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(webhook.url, {
          method: "POST", headers, body: bodyStr,
          signal: controller.signal,
        });
        clearTimeout(timer);
        responseStatus = res.status;
        responseBody = (await res.text().catch(() => null))?.slice(0, 1000) ?? null;
        status = res.ok ? "delivered" : "failed";
      } catch (err) {
        responseBody = err instanceof Error ? err.message : "Unknown error";
      }

      await logEvent(
        tenantId, webhook.id, event, "auth", null,
        webhook.url, payload, status, responseStatus, responseBody,
        Date.now() - start
      );
    })
  );
}
