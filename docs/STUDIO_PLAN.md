# STUDIO_PLAN.md — PulseBoard Studio Architecture

> **This is the implementation blueprint for Studio.** Any AI session working on Studio should read this first.
> **Last updated: 2026-03-15**

---

## Vision

Studio is PulseBoard's schema builder — a multi-tenant Directus-like data platform where:
- **Super admin (BIPO)** creates **system collections** (employees, leaves, claims) and licenses them to tenants via modules
- **Tenant admin** uses licensed system collections AND creates their own **tenant collections** scoped to their org
- All data is tenant-isolated via RLS. Collections are exposed via slug-based REST APIs.

---

## Key Decisions (Confirmed with User)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage model | EAV with JSONB (`collection_items.data`) | No per-tenant tables; `tenant_id` indexed on every row |
| M2M relations | Auto-create hidden junction collection | Like Directus — user doesn't manually create junction tables |
| Field-level permissions | Not implemented | Overkill for now; access is all-or-nothing per collection |
| Audit trail | Required, segregated by tenant | Easy to extract for auditors |
| Slug uniqueness | Globally unique, auto-suffix with running number (max 5 digits) | e.g., `blood-mary-12345` — prevents conflicts across tenants |
| Licensing | Per-module (e.g., "Leave", "Claim", "Attendance") | General/flexible since no clients yet |
| Content catalogs | BIPO-maintained (Gender, Country, Marital Status, etc.) | Reusable across any collection's select fields |
| Auto-generated UI | Grid view (default), Kanban, CSV/Excel export, pagination 20, filter/sort, upload | |
| API format | `/api/collections/:slug/items` | Slug-based, not UUID. Token resolves tenant via `X-Tenant-Id` header |

---

## Database Schema

### 1. `collections` — Schema definitions

```sql
CREATE TABLE collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,          -- globally unique, auto-suffixed
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,                           -- lucide icon name
  type        TEXT NOT NULL CHECK (type IN ('system', 'tenant')),
  tenant_id   UUID REFERENCES tenants(id),   -- NULL = system collection (BIPO)
  module_id   UUID REFERENCES modules(id),   -- only for system collections
  is_hidden   BOOLEAN DEFAULT false,         -- for junction collections
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Constraint: system collections must have tenant_id IS NULL
-- Constraint: tenant collections must have tenant_id IS NOT NULL and module_id IS NULL
```

### 2. `collection_fields` — Field definitions

```sql
CREATE TABLE collection_fields (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id           UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  slug                    TEXT NOT NULL,
  name                    TEXT NOT NULL,
  field_type              TEXT NOT NULL CHECK (field_type IN (
    'text', 'number', 'date', 'datetime', 'boolean', 'file',
    'select', 'multiselect', 'richtext', 'json', 'relation'
  )),
  options                 JSONB DEFAULT '{}',
  -- options examples:
  --   select:    { "choices": [...] } or { "catalog_slug": "gender" }  (references content_catalogs.slug)
  --   relation:  { "related_collection_id": "uuid", "relation_type": "m2o|o2o|m2m", "junction_collection_id": "uuid" }
  --   text:      { "max_length": 255 }
  --   number:    { "min": 0, "max": 100, "decimals": 2 }
  --   file:      { "allowed_types": ["image/*", "application/pdf"] }
  is_required             BOOLEAN DEFAULT false,
  is_unique               BOOLEAN DEFAULT false,
  sort_order              INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE (collection_id, slug)
);
```

### 3. `collection_items` — Actual data (EAV)

```sql
CREATE TABLE collection_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  data            JSONB NOT NULL DEFAULT '{}',
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_items_tenant_collection ON collection_items(tenant_id, collection_id);
CREATE INDEX idx_items_data ON collection_items USING GIN(data);
```

### 4. `collection_items_audit` — Audit trail

```sql
CREATE TABLE collection_items_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL,               -- references collection_items.id (no FK, items may be deleted)
  collection_id   UUID NOT NULL,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  action          TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_data        JSONB,
  new_data        JSONB,
  changed_by      UUID REFERENCES auth.users(id),
  changed_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON collection_items_audit(tenant_id);
CREATE INDEX idx_audit_item ON collection_items_audit(item_id);

-- Trigger: auto-log on INSERT/UPDATE/DELETE of collection_items
```

### 5. `content_catalogs` + `content_catalog_items` — BIPO-maintained lookup lists

```sql
CREATE TABLE content_catalogs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE content_catalog_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id  UUID NOT NULL REFERENCES content_catalogs(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  UNIQUE (catalog_id, value)
);
```

### 6. `modules` + `tenant_modules` — Licensing

```sql
CREATE TABLE modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant_modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_id   UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  licensed_at TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN DEFAULT true,
  UNIQUE (tenant_id, module_id)
);
```

### 7. `collection_views` — Saved views

```sql
CREATE TABLE collection_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('grid', 'kanban')),
  config          JSONB DEFAULT '{}',
  -- config: { columns: [...], sort: { field, direction }, filters: [...], kanban_field: "status" }
  is_default      BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## RLS Policies

```sql
-- collection_items: tenant isolation
CREATE POLICY "tenant_isolation" ON collection_items
  FOR ALL USING (tenant_id = current_tenant_id());

-- collections: see system collections (if licensed) + own tenant collections
CREATE POLICY "visible_collections" ON collections
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    OR (
      tenant_id IS NULL
      AND module_id IN (
        SELECT module_id FROM tenant_modules
        WHERE tenant_id = current_tenant_id() AND is_active = true
      )
    )
  );

-- super_admin sees all collections (for Studio management)
CREATE POLICY "super_admin_all_collections" ON collections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      JOIN tenants t ON t.id = tu.tenant_id
      WHERE tu.user_id = auth.uid() AND t.is_super = true AND tu.role = 'super_admin'
    )
  );

-- collection_items_audit: tenant isolation
CREATE POLICY "audit_tenant_isolation" ON collection_items_audit
  FOR SELECT USING (tenant_id = current_tenant_id());

-- content_catalogs + content_catalog_items: readable by all authenticated users
-- writable only by super_admin

-- modules: readable by all, writable by super_admin
-- tenant_modules: readable by tenant members, writable by super_admin
```

---

## Slug Generation

Globally unique. Algorithm:
1. Slugify the name (e.g., "Blood Mary" → `blood-mary`)
2. Check if slug exists in `collections` table
3. If exists, append random 5-digit number: `blood-mary-38291`
4. Retry if collision (extremely unlikely with 5 digits)

---

## API Routes (Next.js App Router)

```
src/app/api/collections/
├── route.ts                          # GET list, POST create collection
├── [slug]/
│   ├── route.ts                      # GET schema, PUT update, DELETE collection
│   └── items/
│       ├── route.ts                  # GET list (paginated), POST create item
│       ├── [id]/
│       │   └── route.ts             # GET, PUT, DELETE single item
│       ├── export/
│       │   └── route.ts             # GET CSV/Excel
│       └── import/
│           └── route.ts             # POST bulk upload

src/app/api/content-catalogs/
├── route.ts                          # GET all catalogs
├── [slug]/
│   └── route.ts                      # GET catalog items
```

Auth: Bearer token from Supabase Auth. Tenant resolved from `X-Tenant-Id` header (validated against user's tenant memberships).

---

## Studio UI Structure

```
src/app/dashboard/studio/
├── page.tsx                          # Redirect → /system-collections
├── system-collections/
│   └── page.tsx                      # System collections list (super_admin writes)
├── tenant-collections/
│   └── page.tsx                      # Tenant collections list (tenant_admin+)
├── content-catalog/                  # Super admin only
│   ├── page.tsx                      # List all content catalogs
│   └── [slug]/
│       └── page.tsx                  # Manage catalog items
├── collections/
│   └── [slug]/
│       ├── items/
│       │   └── page.tsx              # Collection item grid view
│       ├── schema/
│       │   └── page.tsx              # Field builder (edit collection schema)
│       └── views/
│           └── page.tsx              # Manage saved views
```

---

## Implementation Phases

### Phase 1: Foundation (DB Schema + Seed)
- [ ] Create migration: `collections`, `collection_fields`, `collection_items`, `collection_items_audit`
- [ ] Create migration: `global_lists`, `global_list_items`
- [ ] Create migration: `modules`, `tenant_modules`
- [ ] Create migration: `collection_views`
- [ ] Create migration: RLS policies for all new tables
- [ ] Create migration: Audit trigger on `collection_items`
- [ ] Create migration: `current_tenant_id()` helper function (if not exists)
- [ ] Seed: global lists (Gender, Country, Marital Status)
- [ ] Push to Supabase cloud
- [ ] Regenerate TypeScript types

### Phase 2: Super Admin Studio — Collection Builder
- [ ] Studio home page (`/dashboard/studio`)
- [ ] Create collection form (name, slug auto-gen, description, icon)
- [ ] Field builder UI (add/remove/reorder fields, set types + options)
- [ ] Edit/delete collection
- [ ] Sidebar navigation update (add "Studio" section)

### Phase 3: Collection Item CRUD — Grid View
- [ ] Grid view component (table with column headers from field definitions)
- [ ] Pagination (20 items default)
- [ ] Sort by column
- [ ] Filter by field values
- [ ] Create item dialog/form (auto-generated from field schema)
- [ ] Edit item (inline or dialog)
- [ ] Delete item

### Phase 4: Modules + Licensing
- [ ] Module CRUD UI (super admin)
- [ ] Assign system collections to modules
- [ ] Tenant licensing UI (grant/revoke modules per tenant)
- [ ] Collection visibility respects licensing

### Phase 5: Tenant Admin Studio
- [ ] Tenant admin can create tenant-scoped collections
- [ ] Tenant admin field builder (same UI, scoped to tenant)
- [ ] Tenant admin sees licensed system collections (read-only schema, CRUD items)

### Phase 6: Relations
- [ ] M2O relation field type — picker UI
- [ ] O2O relation field type
- [ ] M2M — auto-create junction collection
- [ ] Relation display in grid (show related item label)

### Phase 7: Content Catalogs (formerly Global Lists)
- [x] Content catalog CRUD (super admin)
- [x] Integration with `select` field type — choose from content catalog
- [x] Content catalog picker in field builder

### Phase 8: Import/Export
- [x] CSV export (respects current filters/sort)
- [x] Excel export
- [x] CSV/Excel import with field mapping UI
- [x] Validation errors display

### Phase 9: API Routes
- [ ] `/api/collections` — list + create
- [ ] `/api/collections/:slug` — schema
- [ ] `/api/collections/:slug/items` — CRUD
- [ ] `/api/collections/:slug/export`
- [ ] `/api/collections/:slug/import`
- [ ] Token auth + tenant resolution middleware
- [ ] Rate limiting

### Phase 10: Enhanced Views
- [ ] Kanban view (group by a status/select field)
- [ ] Saved views CRUD
- [ ] Default view per collection per tenant

---

## Notes

- All UI uses shadcn/ui components. Add new ones via `npx shadcn@latest add <component>`.
- Server components by default. `"use client"` only when needed.
- Supabase admin client (`admin.ts`) only for DDL/RLS-bypass operations.
- No Docker. All Supabase work targets cloud via `npx supabase db push --linked`.
