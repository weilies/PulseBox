"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { fireWebhooks } from "@/lib/webhooks";

async function getContext() {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  const supabase = await createClient();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) throw new Error("No tenant");
  const role = await getUserRole(user.id, tenantId);
  return { user, supabase, tenantId, role };
}

function canManage(role: string | null) {
  return role === "super_admin" || role === "tenant_admin";
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getWebhooks(collectionSlug: string) {
  const { supabase, tenantId } = await getContext();
  const { data, error } = await supabase
    .from("collection_webhooks")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("collection_slug", collectionSlug)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWebhookDeliveries(webhookId: string, limit = 15) {
  const { supabase } = await getContext();
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("id, event_type, status, response_status, response_body, attempt_count, last_attempt_at, created_at")
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function createWebhook(formData: FormData) {
  const { tenantId, user, role } = await getContext();
  if (!canManage(role)) throw new Error("Insufficient permissions");

  const collectionSlug = formData.get("collection_slug") as string;
  const name = formData.get("name") as string;
  const url = formData.get("url") as string;
  const secret = (formData.get("secret") as string) || null;
  const eventsRaw = formData.getAll("events") as string[];

  if (!name || !url || !collectionSlug) throw new Error("name, url, and collection_slug are required");

  const db = createAdminClient();
  const { error } = await db.from("collection_webhooks").insert({
    tenant_id: tenantId,
    collection_slug: collectionSlug,
    name,
    url,
    secret: secret || null,
    events: eventsRaw,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/collections/${collectionSlug}/webhooks`);
}

export async function updateWebhook(id: string, formData: FormData) {
  const { tenantId, role } = await getContext();
  if (!canManage(role)) throw new Error("Insufficient permissions");

  const name = formData.get("name") as string;
  const url = formData.get("url") as string;
  const secret = formData.get("secret") as string;
  const eventsRaw = formData.getAll("events") as string[];
  const isActive = formData.get("is_active") === "true";

  const db = createAdminClient();
  const { error } = await db
    .from("collection_webhooks")
    .update({
      name,
      url,
      secret: secret || null,
      events: eventsRaw,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const collectionSlug = formData.get("collection_slug") as string;
  revalidatePath(`/dashboard/studio/collections/${collectionSlug}/webhooks`);
}

export async function deleteWebhook(id: string, collectionSlug: string) {
  const { tenantId, role } = await getContext();
  if (!canManage(role)) throw new Error("Insufficient permissions");

  const db = createAdminClient();
  const { error } = await db
    .from("collection_webhooks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/collections/${collectionSlug}/webhooks`);
}

export async function testWebhook(id: string) {
  const { tenantId, role } = await getContext();
  if (!canManage(role)) throw new Error("Insufficient permissions");

  const db = createAdminClient();
  const { data: webhook } = await db
    .from("collection_webhooks")
    .select("collection_slug, url, secret, events")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (!webhook) throw new Error("Webhook not found");

  // Fire a synthetic test event
  await fireWebhooks(tenantId, webhook.collection_slug, "item.created", {
    id: "test-00000000-0000-0000-0000-000000000000",
    data: { _test: true, message: "PulseBoard webhook test" },
    created_at: new Date().toISOString(),
  });
}

// ── Collection hooks (onPreSave) ──────────────────────────────────────────────

export async function updateCollectionHooks(
  collectionSlug: string,
  hooks: Record<string, unknown>
) {
  const { tenantId, role } = await getContext();
  if (!canManage(role)) throw new Error("Insufficient permissions");

  const db = createAdminClient();
  const { error } = await db
    .from("collections")
    .update({ hooks })
    .eq("slug", collectionSlug)
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/studio/collections/${collectionSlug}/webhooks`);
}
