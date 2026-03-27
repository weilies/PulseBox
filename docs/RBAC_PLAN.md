# RBAC_PLAN.md — Role-Based Access Control + Service Layer + Nav Folders

> **This is the implementation blueprint for the RBAC overhaul.**
> **Last updated: 2026-03-16**

---

## Vision

Replace the current hardcoded role system (super_admin, tenant_admin, manager, employee) with a fully dynamic, policy-driven access control system:

**User → Role → Policy → Permissions (per resource)**

- Drop `manager` and `employee` roles
- Two system roles per tenant: `super_admin` (Next Novas only) and `tenant_admin`
- Both Next Novas and non-Next Novas tenants can create **custom roles**
- All sidebar items (pages + collections) are **policy-driven**
- Folders are auto-visible when at least one child item is accessible
- Unified service layer so frontend + API share identical logic
- RLS enforces permissions at the database level

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| Role assignment | One role per user per tenant |
| System roles | `super_admin` (Next Novas only), `tenant_admin` — immutable by non-Next Novas |
| Custom roles | Both Next Novas and non-Next Novas tenants can create |
| Policy model | Named policy = bundle of permissions across multiple resources |
| Permission granularity | Collections: read, create, update, delete, export, import, manage_schema. Pages: access |
| Page access | All sidebar links are policy-driven; folders auto-show if any child accessible |
| Nav folders | Unlimited nesting, tenant-scoped, drag-to-organize |
| Logic layer | Shared services (`src/lib/services/`), server actions + API routes are thin wrappers |
| RLS | DB-level permission checks via helper functions |
| Existing users | Migrated: super_admin→super_admin role, tenant_admin→tenant_admin role, manager/employee→tenant_admin role |

---

## Database Schema

### New Tables

#### 1. `roles`

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN DEFAULT false,   -- true for super_admin, tenant_admin (cannot be deleted/renamed by non-Next Novas)
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, slug)
);
```

#### 2. `policies`

```sql
CREATE TABLE policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_system   BOOLEAN DEFAULT false,   -- true for default policies (cannot be deleted by non-Next Novas)
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);
```

#### 3. `policy_permissions`

```sql
CREATE TABLE policy_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('page', 'collection')),
  resource_id     TEXT NOT NULL,   -- page slug (e.g. 'dashboard', 'users') or collection UUID
  permissions     JSONB NOT NULL DEFAULT '{}',
  -- Collections: { "read": true, "create": true, "update": true, "delete": true, "export": true, "import": true, "manage_schema": false }
  -- Pages: { "access": true }
  UNIQUE(policy_id, resource_type, resource_id)
);
```

#### 4. `role_policies`

```sql
CREATE TABLE role_policies (
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  policy_id   UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, policy_id)
);
```

#### 5. `nav_folders`

```sql
CREATE TABLE nav_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,                     -- lucide icon name
  parent_id   UUID REFERENCES nav_folders(id) ON DELETE CASCADE,  -- unlimited nesting
  sort_order  INTEGER DEFAULT 0,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_nav_folders_tenant ON nav_folders(tenant_id);
CREATE INDEX idx_nav_folders_parent ON nav_folders(parent_id);
```

#### 6. `nav_items`

```sql
CREATE TABLE nav_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL CHECK (resource_type IN ('page', 'collection')),
  resource_id     TEXT NOT NULL,       -- page slug or collection id
  label           TEXT,                -- override display name (null = use resource name)
  icon            TEXT,                -- override icon
  folder_id       UUID REFERENCES nav_folders(id) ON DELETE SET NULL,  -- null = root level
  sort_order      INTEGER DEFAULT 0,
  UNIQUE(tenant_id, resource_type, resource_id)
);

CREATE INDEX idx_nav_items_tenant ON nav_items(tenant_id);
CREATE INDEX idx_nav_items_folder ON nav_items(folder_id);
```

### Modified Tables

#### `tenant_users` — add `role_id`, drop `role` text column

```sql
-- Step 1: Add role_id column
ALTER TABLE tenant_users ADD COLUMN role_id UUID REFERENCES roles(id);

-- Step 2: After seeding roles + migrating data, make it NOT NULL
ALTER TABLE tenant_users ALTER COLUMN role_id SET NOT NULL;

-- Step 3: Drop old role column
ALTER TABLE tenant_users DROP COLUMN role;
```

---

## Page Registry

All policy-controlled pages (used as `resource_id` in `policy_permissions` where `resource_type = 'page'`):

| Page Slug | Display Name | Current Path | Notes |
|-----------|-------------|--------------|-------|
| `dashboard` | Dashboard | `/dashboard` | Always seeded for all roles |
| `users` | Users | `/dashboard/users` | User management |
| `tenants` | Tenants | `/dashboard/tenants` | Next Novas super_admin only |
| `studio.system-collections` | System Collections | `/dashboard/studio/system-collections` | |
| `studio.content-catalog` | Content Catalog | `/dashboard/studio/content-catalog` | |
| `studio.tenant-collections` | Tenant Collections | `/dashboard/studio/tenant-collections` | |
| `roles` | Roles | `/dashboard/roles` | NEW — role/policy management |

> **Folder rule**: "Studio" folder auto-shows if user has access to any `studio.*` page.

---

## Permission Granularity

### Collection Permissions (JSONB keys)

| Key | Description |
|-----|-------------|
| `read` | View items in collection |
| `create` | Create new items |
| `update` | Edit existing items |
| `delete` | Delete items |
| `export` | Export items (CSV/Excel) |
| `import` | Import items (CSV/Excel) |
| `manage_schema` | Add/edit/delete fields, edit collection settings |

### Page Permissions (JSONB keys)

| Key | Description |
|-----|-------------|
| `access` | Can view/use this page |

---

## Default Seed Data

### Per-Tenant Default Roles

**For Next Novas (super tenant):**

| Role | Slug | is_system | Description |
|------|------|-----------|-------------|
| Super Admin | `super_admin` | true | Full platform access. Next Novas only. |
| Tenant Admin | `tenant_admin` | true | Full access within tenant. |

**For every non-Next Novas tenant:**

| Role | Slug | is_system | Description |
|------|------|-----------|-------------|
| Tenant Admin | `tenant_admin` | true | Full access within tenant. |

> Note: Non-Next Novas tenants do NOT get a `super_admin` role. Only Next Novas has it.

### Per-Tenant Default Policies

**Policy: "Full Platform Access"** (Next Novas super_admin only)
- All pages: `{ "access": true }`
- All collections: all 7 permissions = true

**Policy: "Tenant Management"** (tenant_admin)
- Pages: `dashboard`, `users`, `studio.system-collections`, `studio.tenant-collections`, `roles` → `{ "access": true }`
- All tenant collections belonging to this tenant: all 7 permissions = true
- All system collections: `{ "read": true, "export": true }` (rest false)

**Policy: "Content Catalog Management"** (Next Novas tenant_admin only — added to Next Novas's tenant_admin)
- Page: `studio.content-catalog` → `{ "access": true }`

### Default Role → Policy Assignments

| Tenant | Role | Policies |
|--------|------|----------|
| Next Novas | super_admin | Full Platform Access |
| Next Novas | tenant_admin | Tenant Management + Content Catalog Management |
| Non-Next Novas | tenant_admin | Tenant Management |

### User Migration

```sql
-- Map existing tenant_users.role text to new role_id
UPDATE tenant_users tu
SET role_id = r.id
FROM roles r
WHERE r.tenant_id = tu.tenant_id
  AND r.slug = CASE
    WHEN tu.role = 'super_admin' THEN 'super_admin'
    ELSE 'tenant_admin'  -- manager, employee, tenant_admin all → tenant_admin
  END;
```

---

## RLS Helper Functions

### `has_permission(resource_type, resource_id, permission)`

```sql
CREATE OR REPLACE FUNCTION has_permission(
  p_resource_type TEXT,
  p_resource_id   TEXT,
  p_permission    TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Super admin bypass
  IF is_super_admin() THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM tenant_users tu
    JOIN role_policies rp ON rp.role_id = tu.role_id
    JOIN policy_permissions pp ON pp.policy_id = rp.policy_id
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = current_tenant_id()
      AND tu.is_active = true
      AND pp.resource_type = p_resource_type
      AND pp.resource_id = p_resource_id
      AND (pp.permissions->>p_permission)::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### `has_page_access(page_slug)`

```sql
CREATE OR REPLACE FUNCTION has_page_access(p_page_slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN has_permission('page', p_page_slug, 'access');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### `get_accessible_collection_ids(permission)`

Optimized set-returning function for RLS policies:

```sql
CREATE OR REPLACE FUNCTION get_accessible_collection_ids(p_permission TEXT)
RETURNS SETOF UUID AS $$
BEGIN
  -- Super admin sees everything
  IF is_super_admin() THEN
    RETURN QUERY SELECT id FROM collections;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT DISTINCT pp.resource_id::uuid
    FROM tenant_users tu
    JOIN role_policies rp ON rp.role_id = tu.role_id
    JOIN policy_permissions pp ON pp.policy_id = rp.policy_id
    WHERE tu.user_id = auth.uid()
      AND tu.tenant_id = current_tenant_id()
      AND tu.is_active = true
      AND pp.resource_type = 'collection'
      AND (pp.permissions->>p_permission)::boolean = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### Updated RLS Policies

**collections:**
```sql
DROP POLICY IF EXISTS "collections_select" ON collections;
DROP POLICY IF EXISTS "super_admin_all_collections" ON collections;

CREATE POLICY "collections_select" ON collections
  FOR SELECT USING (
    id IN (SELECT get_accessible_collection_ids('read'))
  );

CREATE POLICY "collections_insert" ON collections
  FOR INSERT WITH CHECK (
    -- Only via service layer (admin client) — no direct RLS insert
    is_super_admin()
  );

CREATE POLICY "collections_update" ON collections
  FOR UPDATE USING (
    id IN (SELECT get_accessible_collection_ids('manage_schema'))
  );

CREATE POLICY "collections_delete" ON collections
  FOR DELETE USING (
    id IN (SELECT get_accessible_collection_ids('manage_schema'))
  );
```

**collection_fields:**
```sql
DROP POLICY IF EXISTS "collection_fields_select" ON collection_fields;

CREATE POLICY "collection_fields_select" ON collection_fields
  FOR SELECT USING (
    collection_id IN (SELECT get_accessible_collection_ids('read'))
  );

CREATE POLICY "collection_fields_insert" ON collection_fields
  FOR INSERT WITH CHECK (
    collection_id IN (SELECT get_accessible_collection_ids('manage_schema'))
  );

CREATE POLICY "collection_fields_update" ON collection_fields
  FOR UPDATE USING (
    collection_id IN (SELECT get_accessible_collection_ids('manage_schema'))
  );

CREATE POLICY "collection_fields_delete" ON collection_fields
  FOR DELETE USING (
    collection_id IN (SELECT get_accessible_collection_ids('manage_schema'))
  );
```

**collection_items:**
```sql
DROP POLICY IF EXISTS "collection_items_select" ON collection_items;
DROP POLICY IF EXISTS "collection_items_insert" ON collection_items;
DROP POLICY IF EXISTS "collection_items_update" ON collection_items;
DROP POLICY IF EXISTS "collection_items_delete" ON collection_items;
-- Also drop any super_admin bypass and system item policies from 00011

CREATE POLICY "collection_items_select" ON collection_items
  FOR SELECT USING (
    collection_id IN (SELECT get_accessible_collection_ids('read'))
  );

CREATE POLICY "collection_items_insert" ON collection_items
  FOR INSERT WITH CHECK (
    collection_id IN (SELECT get_accessible_collection_ids('create'))
  );

CREATE POLICY "collection_items_update" ON collection_items
  FOR UPDATE USING (
    collection_id IN (SELECT get_accessible_collection_ids('update'))
  );

CREATE POLICY "collection_items_delete" ON collection_items
  FOR DELETE USING (
    collection_id IN (SELECT get_accessible_collection_ids('delete'))
  );
```

**roles:**
```sql
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select" ON roles
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_super_admin());

CREATE POLICY "roles_insert" ON roles
  FOR INSERT WITH CHECK (
    has_page_access('roles') AND (tenant_id = current_tenant_id() OR is_super_admin())
  );

CREATE POLICY "roles_update" ON roles
  FOR UPDATE USING (
    has_page_access('roles')
    AND (tenant_id = current_tenant_id() OR is_super_admin())
    AND (NOT is_system OR is_super_admin())  -- only Next Novas can edit system roles
  );

CREATE POLICY "roles_delete" ON roles
  FOR DELETE USING (
    has_page_access('roles')
    AND (tenant_id = current_tenant_id() OR is_super_admin())
    AND NOT is_system  -- system roles cannot be deleted
  );
```

**policies:**
```sql
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policies_select" ON policies
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_super_admin());

CREATE POLICY "policies_manage" ON policies
  FOR ALL USING (
    has_page_access('roles')
    AND (tenant_id = current_tenant_id() OR is_super_admin())
  );
```

**policy_permissions, role_policies:**
```sql
ALTER TABLE policy_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_policies ENABLE ROW LEVEL SECURITY;

-- Readable if parent policy/role is readable (via join)
-- Writable if user has roles page access

CREATE POLICY "pp_select" ON policy_permissions
  FOR SELECT USING (
    policy_id IN (SELECT id FROM policies WHERE tenant_id = current_tenant_id())
    OR is_super_admin()
  );

CREATE POLICY "pp_manage" ON policy_permissions
  FOR ALL USING (
    has_page_access('roles')
    AND (
      policy_id IN (SELECT id FROM policies WHERE tenant_id = current_tenant_id())
      OR is_super_admin()
    )
  );

CREATE POLICY "rp_select" ON role_policies
  FOR SELECT USING (
    role_id IN (SELECT id FROM roles WHERE tenant_id = current_tenant_id())
    OR is_super_admin()
  );

CREATE POLICY "rp_manage" ON role_policies
  FOR ALL USING (
    has_page_access('roles')
    AND (
      role_id IN (SELECT id FROM roles WHERE tenant_id = current_tenant_id())
      OR is_super_admin()
    )
  );
```

**nav_folders + nav_items:**
```sql
ALTER TABLE nav_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE nav_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nav_folders_select" ON nav_folders
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_super_admin());

CREATE POLICY "nav_folders_manage" ON nav_folders
  FOR ALL USING (
    has_page_access('roles')
    AND (tenant_id = current_tenant_id() OR is_super_admin())
  );

CREATE POLICY "nav_items_select" ON nav_items
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_super_admin());

CREATE POLICY "nav_items_manage" ON nav_items
  FOR ALL USING (
    has_page_access('roles')
    AND (tenant_id = current_tenant_id() OR is_super_admin())
  );
```

---

## Service Layer Architecture

### Directory Structure

```
src/lib/services/
├── permissions.service.ts    # Permission checks (used by all other services)
├── collections.service.ts    # Collection CRUD
├── items.service.ts          # Item CRUD (with pre/post-save hook points)
├── fields.service.ts         # Field CRUD
├── content-catalog.service.ts # Content catalog CRUD
├── roles.service.ts          # Role CRUD
├── policies.service.ts       # Policy + permission CRUD
├── users.service.ts          # User/tenant-user management
├── tenants.service.ts        # Tenant CRUD
└── nav.service.ts            # Nav folder/item management
```

### Service Pattern

Each service follows this pattern:

```typescript
// src/lib/services/items.service.ts
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PermissionsService } from "./permissions.service";

export class ItemsService {
  /**
   * Create a new collection item.
   * Called by both server actions and API routes.
   */
  static async create(params: {
    collectionId: string;
    collectionSlug: string;
    data: Record<string, unknown>;
    userId: string;
    tenantId: string;
  }) {
    // 1. Permission check
    await PermissionsService.requireCollectionPermission(
      params.userId, params.tenantId, params.collectionId, "create"
    );

    // 2. Validation (field types, required, unique)
    // ... shared validation logic ...

    // 3. Pre-save hook point (future: run tenant scripts)
    // await HooksService.runPreSave(params.collectionId, params.data);

    // 4. DB operation
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from("collection_items")
      .insert({ ... })
      .select()
      .single();

    // 5. Post-save hook point (future)
    // await HooksService.runPostSave(params.collectionId, data);

    return { data, error };
  }
}
```

### Server Actions (Thin Wrappers)

```typescript
// src/app/actions/studio.ts (simplified)
"use server";

import { getUser } from "@/lib/auth";
import { getCurrentTenantId } from "@/lib/tenant";
import { ItemsService } from "@/lib/services/items.service";

export async function createItem(formData: FormData) {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = await getCurrentTenantId();
  if (!tenantId) return { error: "No tenant" };

  return ItemsService.create({
    collectionId: formData.get("collection_id") as string,
    collectionSlug: formData.get("collection_slug") as string,
    data: JSON.parse(formData.get("data") as string),
    userId: user.id,
    tenantId,
  });
}
```

### API Routes (Thin Wrappers) — Phase 9

```typescript
// src/app/api/collections/[slug]/items/route.ts
import { ItemsService } from "@/lib/services/items.service";
import { getApiUser } from "@/lib/api-auth";  // resolve user from Bearer token

export async function POST(req: Request, { params }) {
  const { user, tenantId } = await getApiUser(req);

  const body = await req.json();
  const result = await ItemsService.create({
    collectionId: body.collection_id,
    collectionSlug: params.slug,
    data: body.data,
    userId: user.id,
    tenantId,
  });

  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.data, { status: 201 });
}
```

### PermissionsService

```typescript
// src/lib/services/permissions.service.ts

export class PermissionsService {
  /**
   * Check if user has a specific permission on a collection.
   * Throws if not authorized.
   */
  static async requireCollectionPermission(
    userId: string,
    tenantId: string,
    collectionId: string,
    permission: "read" | "create" | "update" | "delete" | "export" | "import" | "manage_schema"
  ): Promise<void> {
    const hasAccess = await this.checkCollectionPermission(userId, tenantId, collectionId, permission);
    if (!hasAccess) throw new Error(`Permission denied: ${permission} on collection`);
  }

  /**
   * Check if user has a specific permission on a collection.
   * Returns boolean.
   */
  static async checkCollectionPermission(
    userId: string,
    tenantId: string,
    collectionId: string,
    permission: string
  ): Promise<boolean> {
    const admin = createAdminClient();

    // Super admin bypass
    const { data: isSuperAdmin } = await admin.rpc("is_super_admin_for_user", { p_user_id: userId });
    if (isSuperAdmin) return true;

    // Check via role → policies → permissions chain
    const { data } = await admin
      .from("tenant_users")
      .select(`
        role:roles!inner(
          role_policies!inner(
            policy:policies!inner(
              policy_permissions!inner(
                resource_type, resource_id, permissions
              )
            )
          )
        )
      `)
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    // Traverse the chain to find matching permission
    // ... (flatten and check)
    return false; // simplified
  }

  /**
   * Check page access. Used by middleware and sidebar.
   */
  static async hasPageAccess(
    userId: string,
    tenantId: string,
    pageSlug: string
  ): Promise<boolean> {
    return this.checkPermission(userId, tenantId, "page", pageSlug, "access");
  }

  /**
   * Get all accessible pages for a user (for sidebar rendering).
   */
  static async getAccessiblePages(userId: string, tenantId: string): Promise<string[]> {
    const admin = createAdminClient();

    const { data: isSuperAdmin } = await admin.rpc("is_super_admin_for_user", { p_user_id: userId });
    if (isSuperAdmin) {
      return ["dashboard", "users", "tenants", "studio.system-collections", "studio.content-catalog", "studio.tenant-collections", "roles"];
    }

    const { data } = await admin.rpc("get_accessible_pages", { p_user_id: userId, p_tenant_id: tenantId });
    return data ?? [];
  }

  /**
   * Get all accessible collection IDs with their permissions (for sidebar + UI).
   */
  static async getCollectionPermissions(
    userId: string,
    tenantId: string
  ): Promise<Map<string, Record<string, boolean>>> {
    // Returns map of collectionId → { read: true, create: false, ... }
    // Used by sidebar (show if read=true) and item pages (show/hide buttons)
  }
}
```

---

## Sidebar Architecture (Updated)

The sidebar becomes fully dynamic:

```
┌─────────────────────────────┐
│  PulseBox                   │
├─────────────────────────────┤
│  📊 Dashboard               │  ← policy: dashboard.access
│  👥 Users                   │  ← policy: users.access
│  🏢 Tenants                 │  ← policy: tenants.access
│                             │
│  📐 Studio  ▾               │  ← auto-show if any studio.* accessible
│    ├ System Collections     │  ← policy: studio.system-collections.access
│    ├ Content Catalog        │  ← policy: studio.content-catalog.access
│    ├ Tenant Collections     │  ← policy: studio.tenant-collections.access
│    └ Nav Management         │  ← policy: roles.access (admin-only)
│                             │
│  🔐 Roles & Policies       │  ← policy: roles.access
│                             │
│  ── Collections ──          │  ← dynamic section
│  📁 HR  ▾                   │  ← nav_folder (auto-show if any child accessible)
│    ├ 👤 Employees           │  ← collection with read permission
│    └ 🏖 Leaves              │  ← collection with read permission
│  📁 Projects  ▾             │  ← nav_folder
│    └ 📋 Project             │  ← collection with read permission
│  📊 Ungrouped Collection    │  ← collection at root (no folder)
└─────────────────────────────┘
```

### Sidebar Data Flow

1. Server component calls `PermissionsService.getAccessiblePages()` → visible pages
2. Server component calls `PermissionsService.getCollectionPermissions()` → visible collections
3. Server component fetches `nav_folders` + `nav_items` for current tenant
4. Build tree: folders → items, filter by accessible collections
5. Auto-show folders if they contain at least one accessible item (recursive check)
6. Render with expand/collapse state (client component)

---

## Updated Middleware

```typescript
// middleware.ts (simplified logic)

// 1. Skip public routes
// 2. Validate session
// 3. Resolve tenant (cookie)
// 4. For each protected route, check page permission:
//    - /dashboard → always allow (everyone has dashboard)
//    - /dashboard/users → hasPageAccess(userId, tenantId, "users")
//    - /dashboard/tenants → hasPageAccess(userId, tenantId, "tenants")
//    - /dashboard/studio/* → hasPageAccess for matching page slug
//    - /dashboard/roles → hasPageAccess(userId, tenantId, "roles")
//    - /dashboard/c/[slug] → hasCollectionPermission(userId, tenantId, collectionId, "read")
//
// Note: Middleware runs on edge, so we use supabase client (not admin) for the RPC call.
// Permission check via RPC: supabase.rpc('has_page_access', { p_page_slug: 'users' })
```

---

## New Pages

| Path | Purpose | Access |
|------|---------|--------|
| `/dashboard/roles` | Manage roles, policies, assignments | `roles` page access |
| `/dashboard/roles/[roleId]` | Edit role — assign policies | `roles` page access |
| `/dashboard/nav` | Manage sidebar folders + item ordering | `roles` page access |
| `/dashboard/c/[slug]` | Collection items view (direct sidebar nav) | Collection `read` permission |
| `/dashboard/c/[slug]/schema` | Collection schema editor | Collection `manage_schema` permission |

> **Note**: `/dashboard/c/[slug]` is a new route for collections accessed directly from sidebar. The existing `/dashboard/studio/collections/[slug]/items` route still works but `/dashboard/c/[slug]` is the canonical path for sidebar-navigated collections.

---

## Implementation Phases

### Phase 1: Service Layer Refactor (No behavior change)

Extract logic from server actions into services. Server actions become thin wrappers. Verify everything still works.

**Files to create:**
- `src/lib/services/permissions.service.ts` — placeholder (uses old role checks initially)
- `src/lib/services/collections.service.ts` — from `actions/studio.ts`
- `src/lib/services/items.service.ts` — from `actions/studio.ts`
- `src/lib/services/fields.service.ts` — from `actions/studio.ts`
- `src/lib/services/content-catalog.service.ts` — from `actions/content-catalog.ts`
- `src/lib/services/users.service.ts` — from `actions/dashboard.ts`
- `src/lib/services/tenants.service.ts` — from `actions/dashboard.ts`

**Files to modify:**
- `src/app/actions/studio.ts` — thin wrapper calling services
- `src/app/actions/content-catalog.ts` — thin wrapper calling services
- `src/app/actions/dashboard.ts` — thin wrapper calling services

**Verification:** `tsc --noEmit` clean + manual test all existing functionality.

---

### Phase 2: DB Migration — RBAC Schema + Seed

Single migration file: `supabase/migrations/00013_rbac.sql`

**Steps in migration:**
1. Create `roles` table
2. Create `policies` table
3. Create `policy_permissions` table
4. Create `role_policies` table (composite PK)
5. Create `nav_folders` table
6. Create `nav_items` table
7. Add `role_id` column to `tenant_users` (nullable initially)
8. Create `has_permission()` function
9. Create `has_page_access()` function
10. Create `get_accessible_collection_ids()` function
11. Create `get_accessible_pages()` function (for sidebar)
12. Seed default roles for ALL existing tenants
13. Seed default policies for ALL existing tenants
14. Seed policy_permissions for default policies
15. Seed role_policies assignments
16. Seed nav_items for existing pages and collections
17. Migrate `tenant_users.role` → `role_id` (UPDATE based on text→role lookup)
18. Make `role_id` NOT NULL
19. Drop `tenant_users.role` column
20. Drop old RLS policies on collections, collection_fields, collection_items
21. Create new RLS policies using permission functions
22. Create RLS policies on new tables (roles, policies, etc.)
23. Update `is_super_admin()` if needed
24. Add `current_tenant_id()` function if not exists (check migration 00009)

**Push:** `npx supabase db push --linked`
**Regen types:** `npx supabase gen types typescript --linked > src/types/database.ts`

---

### Phase 3: PermissionsService + Auth/Middleware Update

Replace hardcoded role checks with permission-based checks.

**Files to create/modify:**
- `src/lib/services/permissions.service.ts` — full implementation using DB queries
- `src/lib/auth.ts` — update `getUserRole()` → `getUserPermissions()`, add helpers
- `src/lib/constants.ts` — add PAGE_SLUGS enum, COLLECTION_PERMISSIONS enum
- `middleware.ts` — replace role-based guards with permission RPC calls

**Files to modify (pages):**
- All dashboard pages that currently check `userRole` — switch to permission checks

**Verification:** All existing pages still accessible with same users. No access regressions.

---

### Phase 4: Roles & Policies Admin UI

**Files to create:**
- `src/app/dashboard/roles/page.tsx` — list roles + policies
- `src/app/dashboard/roles/[roleId]/page.tsx` — edit role, assign/remove policies
- `src/app/actions/roles.ts` — server actions wrapping services
- `src/lib/services/roles.service.ts` — role CRUD
- `src/lib/services/policies.service.ts` — policy CRUD + permission assignment
- `src/components/create-role-dialog.tsx`
- `src/components/create-policy-dialog.tsx`
- `src/components/policy-permissions-editor.tsx` — matrix UI (rows=resources, cols=permissions)
- `src/components/role-policy-assignment.tsx`
- `src/components/user-role-assignment.tsx`

**Sidebar update:** Add "Roles & Policies" nav item

**Users page update:** Replace role dropdown with role assignment (from `roles` table)

---

### Phase 5: Dynamic Sidebar + Nav Management

**Files to create:**
- `src/app/dashboard/nav/page.tsx` — drag-and-drop folder/item organizer
- `src/app/actions/nav.ts` — server actions
- `src/lib/services/nav.service.ts` — nav CRUD + reorder

**Files to modify:**
- `src/components/sidebar.tsx` — complete rewrite:
  - Fetch nav structure from DB
  - Filter by permissions
  - Render folders with expand/collapse
  - Show collections as direct nav items

**New dependency:** Consider `@dnd-kit/core` for drag-and-drop (or use HTML5 drag API).

---

### Phase 6: Collection Direct Pages

**Files to create:**
- `src/app/dashboard/c/[slug]/page.tsx` — collection items view (reuse existing items page logic)
- `src/app/dashboard/c/[slug]/schema/page.tsx` — collection schema (reuse existing)

> These pages are the "direct nav" versions accessed from sidebar collection links. They reuse the same components as `/dashboard/studio/collections/[slug]/items/page.tsx`.

**Auto-create nav_item:** When a collection is created, auto-create a `nav_items` entry at root level.

---

### Phase 7: Cleanup + Polish

- Remove old role-based constants (`ROLES.MANAGER`, `ROLES.EMPLOYEE`)
- Update `CLAUDE.md`, `TASKS.md`, `docs/STUDIO_PLAN.md`
- Ensure `tsc --noEmit` clean
- Manual test matrix:
  - Super admin (Next Novas): full access
  - Tenant admin (non-Next Novas): tenant-scoped access
  - Custom role (limited): only permitted pages/collections
  - Folder visibility: auto-hide empty folders
  - Collection sidebar items: only show if read permission

---

## Migration Checklist (for Phase 2)

Before writing the migration, query existing data to build accurate seed:

```sql
-- Get all existing tenants
SELECT id, name, slug, is_super FROM tenants;

-- Get all existing tenant_users with roles
SELECT tu.id, tu.user_id, tu.tenant_id, tu.role, t.slug as tenant_slug
FROM tenant_users tu JOIN tenants t ON t.id = tu.tenant_id;

-- Get all existing collections
SELECT id, slug, name, type, tenant_id FROM collections;
```

Use this data to generate proper INSERT statements for roles, policies, and user migration.

---

## Notes

- **Performance**: `has_permission()` is called in RLS on every row. Monitor query plans. If slow, consider a materialized view of user→permission mappings refreshed on role/policy changes.
- **Caching**: `PermissionsService` can cache user permissions in memory per-request (the server component request lifecycle is short enough).
- **Pre/post-save hooks**: The service layer has placeholder comments for hook points. Phase 9 API routes will use the same service layer. Future phases can add tenant-configurable scripts.
- **Admin client**: Services use the admin client for operations that need to bypass RLS (e.g., permission checks themselves, cross-tenant operations). Regular data operations should go through the user's Supabase client when possible.
