"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
const BUCKET = "collection-files";
const MEDIA_BUCKET = "media";
const SIGNED_URL_TTL = 3600; // 1 hour

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path (not a URL) — store this in item data.
 */
export async function uploadCollectionFile(formData: FormData): Promise<{ path?: string; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = await resolveTenant(user.id);
  if (!tenantId) return { error: "No active tenant" };

  const file = formData.get("file") as File | null;
  const collectionSlug = formData.get("collection_slug") as string;
  const fieldSlug = formData.get("field_slug") as string;

  if (!file || file.size === 0) return { error: "No file provided" };
  if (!collectionSlug || !fieldSlug) return { error: "Missing collection_slug or field_slug" };
  if (file.size > 10 * 1024 * 1024) return { error: "File exceeds 10 MB limit" };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const filename = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const path = `${tenantId}/${collectionSlug}/${fieldSlug}/${filename}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) return { error: error.message };
  return { path };
}

/**
 * Generate a short-lived signed URL for a stored file path.
 * Call this when rendering a file field value.
 */
export async function getSignedFileUrl(path: string): Promise<{ url?: string; error?: string }> {
  if (!path) return { error: "No path provided" };

  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error) return { error: error.message };
  return { url: data.signedUrl };
}

/**
 * Delete a file from storage by path.
 * Called when an item is deleted or a file field is replaced.
 */
export async function deleteCollectionFile(path: string): Promise<{ error?: string }> {
  if (!path) return {};

  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) return { error: error.message };
  return {};
}

// ---------------------------------------------------------------------------
// Media bucket — avatars and other platform-level files
// ---------------------------------------------------------------------------

/**
 * Upload a user avatar to the media bucket.
 * Stores path in profiles.avatar_path and returns a short-lived signed URL.
 */
export async function uploadAvatar(formData: FormData): Promise<{ url?: string; path?: string; error?: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };
  if (file.size > 5 * 1024 * 1024) return { error: "File exceeds 5 MB limit" };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `avatars/${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();

  // Delete old avatar if one exists
  const { data: profile } = await admin.from("profiles").select("avatar_path").eq("id", user.id).single();
  if (profile?.avatar_path) {
    await admin.storage.from(MEDIA_BUCKET).remove([profile.avatar_path]);
  }

  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (uploadError) return { error: uploadError.message };

  // Save path to profile
  await admin.from("profiles").update({ avatar_path: path }).eq("id", user.id);

  // Return signed URL for immediate display
  const { data: signedData } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return { path, url: signedData?.signedUrl };
}

/**
 * Upload an avatar for any user (admin operation — bypasses RLS).
 * Used when a super_admin edits another user's profile.
 */
export async function uploadAvatarForUser(formData: FormData): Promise<{ url?: string; path?: string; error?: string }> {
  const currentUser = await getUser();
  if (!currentUser) return { error: "Not authenticated" };

  const targetUserId = formData.get("targetUserId") as string | null;
  if (!targetUserId) return { error: "Missing targetUserId" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };
  if (file.size > 5 * 1024 * 1024) return { error: "File exceeds 5 MB limit" };

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const path = `avatars/${targetUserId}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();

  // Delete old avatar if one exists
  const { data: profile } = await admin.from("profiles").select("avatar_path").eq("id", targetUserId).single();
  if (profile?.avatar_path) {
    await admin.storage.from(MEDIA_BUCKET).remove([profile.avatar_path]);
  }

  const { error: uploadError } = await admin.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (uploadError) return { error: uploadError.message };

  await admin.from("profiles").update({ avatar_path: path }).eq("id", targetUserId);

  const { data: signedData } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  return { path, url: signedData?.signedUrl };
}

/**
 * Get a signed URL for a media bucket file path.
 */
export async function getMediaSignedUrl(path: string): Promise<{ url?: string; error?: string }> {
  if (!path) return { error: "No path provided" };
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}
