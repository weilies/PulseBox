import type { SupabaseClient } from "@supabase/supabase-js";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateUniqueSlug(
  base: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data } = await supabase
    .from("collections")
    .select("slug")
    .eq("slug", base)
    .maybeSingle();

  if (!data) return base;

  for (let i = 0; i < 20; i++) {
    const suffix = String(Math.floor(10000 + Math.random() * 90000));
    const candidate = `${base}-${suffix}`;
    const { data: exists } = await supabase
      .from("collections")
      .select("slug")
      .eq("slug", candidate)
      .maybeSingle();
    if (!exists) return candidate;
  }

  throw new Error("Could not generate a unique slug. Please try a different name.");
}
