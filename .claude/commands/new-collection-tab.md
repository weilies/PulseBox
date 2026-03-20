Add a new tab to the PulseBoard collection detail pages.

## Arguments

`$ARGUMENTS` should be in the format: `<tab-slug> "<Tab Label>" "<one-line description of what this tab does>"`

Example: `plugins "Plugins" "Manage tenant-level plugins for this collection"`

## What to build

You are adding a **new tab** to the collection detail route group at:
`src/app/dashboard/studio/collections/[slug]/`

The collection detail pages have three existing tabs: **Schema**, **Items**, **Webhooks**.

### Step 1 — Create the new page

Create `src/app/dashboard/studio/collections/[slug]/<tab-slug>/page.tsx` as a **server component** following this exact pattern:

```tsx
import { createClient } from "@/lib/supabase/server";
import { getUser, getUserRole } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenant";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Database, Layers, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCollectionName } from "@/lib/i18n";
import { LANG_COOKIE } from "@/lib/constants";

type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
};

export default async function <TabLabel>Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const user = await getUser();
  if (!user) notFound();
  const tenantId = await resolveTenant(user.id);
  if (!tenantId) notFound();

  const supabase = await createClient();
  const role = await getUserRole(user.id, tenantId);
  const { data: currentTenant } = await supabase
    .from("tenants")
    .select("is_super")
    .eq("id", tenantId)
    .maybeSingle();
  const isSuperAdmin = role === "super_admin" && currentTenant?.is_super === true;

  const { data: collection } = await supabase
    .from("collections")
    .select("id, slug, name, description, type, metadata")
    .eq("slug", slug)
    .maybeSingle() as { data: Collection | null };

  if (!collection) notFound();

  const isSystem = collection.type === "system";
  const canWrite = isSuperAdmin || !isSystem;

  const cookieStore = await cookies();
  const currentLocale = cookieStore.get(LANG_COOKIE)?.value ?? "en";

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
                {getCollectionName(collection, currentLocale)}
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
        {/* Optional: action button rendered here if canWrite */}
      </div>

      {/* Tab bar — IMPORTANT: keep all existing tabs, mark the new one active */}
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
          className="px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
        >
          Webhooks
        </Link>
        <Link
          href={`/dashboard/studio/collections/${slug}/<tab-slug>`}
          className="px-4 py-2 text-sm text-blue-600 border-b-2 border-blue-400 font-medium"
        >
          <Tab Label>
        </Link>
      </div>

      {/* Tab content — implement based on the description provided */}
    </div>
  );
}
```

### Step 2 — Update the tab bar in the three existing pages

Add the new tab link to the tab bar in each of these files. Insert it **after** the Webhooks tab link. The inactive style is `"px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"`.

Files to update:
- `src/app/dashboard/studio/collections/[slug]/schema/page.tsx`
- `src/app/dashboard/studio/collections/[slug]/items/page.tsx`
- `src/app/dashboard/studio/collections/[slug]/webhooks/page.tsx`

### Step 3 — Run the build

Run `npm run build` and fix any TypeScript errors before finishing.

## Key conventions (do not deviate)

- **No `"use client"`** on the page itself — server component only. Extract interactive parts to separate `"use client"` components if needed.
- **Auth pattern**: always `getUser() → resolveTenant() → getUserRole()` in that order. Never skip tenant resolution.
- **canWrite**: `isSuperAdmin || !isSystem` — system collections are read-only for non-super-admins.
- **Tab bar active style**: `"px-4 py-2 text-sm text-blue-600 border-b-2 border-blue-400 font-medium"` — only the current tab gets this.
- **UI tokens**: heading `text-gray-900`, secondary `text-gray-500`, borders `border-gray-200`, table header `bg-gray-100`, rows alternate `bg-white` / `bg-gray-50`.
- **No `asChild` prop** on Radix/shadcn primitives — use `render={<Component />}` prop instead.
- **Supabase clients**: `createClient()` (server) for reads; `createAdminClient()` for writes that bypass RLS.
