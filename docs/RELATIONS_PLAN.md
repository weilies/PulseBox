# RELATIONS_PLAN.md — Master-Detail Collections Architecture

> **Blueprint for parent-child collection relationships, 3-level nested UI, and scalable schema modeling.**
> **Last updated: 2026-03-25**

---

## Vision

PulseBox collections today are flat — each collection stands alone with simple M2O/O2O/M2M relation fields. This plan evolves the system so users can **model real-world entity hierarchies** entirely through the schema builder UI:

```
Employees                          ← Level 1 (parent)
├── EmpIdentities                  ← Level 2 (child)
├── EmpJobs                        ← Level 2 (child)
│   ├── JobAllowances              ← Level 3 (grandchild)
│   └── JobDeductions              ← Level 3 (grandchild)
└── EmpAddresses                   ← Level 2 (child)
```

**Key principle:** Traditional software hardcodes these relationships in scripts. PulseBox makes them **metadata-driven** — modeled in the schema builder, rendered automatically, and exposed via API. The same pattern works for HRMS, Finance, Manufacturing, or any ERP vertical.

---

## Current State (What We Have)

| Feature | Status |
|---------|--------|
| `relation` field type (M2O, O2O, M2M) | ✅ Shipped |
| Auto-created junction collections for M2M | ✅ Shipped |
| Relation display in grid (UUID → label) | ✅ Shipped |
| Smart label derivation (name/title/label/etc.) | ✅ Shipped |
| Items stored as JSONB in `collection_items.data` | ✅ Shipped |
| Parent-child relationship metadata | ❌ Missing |
| Master-detail UI (nested grids) | ❌ Missing |
| Display key / business key fields | ❌ Missing |
| Composite unique constraints | ❌ Missing |
| Cascade rules (delete parent → children?) | ❌ Missing |
| Effective dating | ❌ Missing |

---

## Modeling Guide — How to Think About Relationships

### Relationship Styles

When a user creates a `relation` field, they choose a **relationship style** that tells PulseBox _how_ to render and behave:

| Style | Meaning | Example | UI Behavior |
|-------|---------|---------|-------------|
| **`child_of`** | This collection is a detail/sub-record of the parent | EmpIdentities → Employees | Renders as a **tab on the parent item view** with inline grid |
| **`reference`** | Lookup/dropdown to another collection | EmpJobs.Department → Departments | Renders as a **dropdown/select** (current behavior) |
| **`link`** | Loose association between peers | Employees.Mentor → Employees | Renders as a **link** (current behavior) |

> **`child_of` is the new concept.** Reference and link already work today.

### Sample: HRMS Employee Module

Here's how a tenant admin would model an Employee module entirely through the PulseBox schema builder:

#### Step 1 — Create the collections

| Collection | Type | Notes |
|-----------|------|-------|
| `employees` | system or tenant | Parent. Display key: `emp_id` |
| `emp-identities` | system or tenant | Child of employees |
| `emp-jobs` | system or tenant | Child of employees, effective-dated |
| `emp-addresses` | system or tenant | Child of employees |
| `job-allowances` | system or tenant | Child of emp-jobs (Level 3) |
| `departments` | system or tenant | Reference list |
| `companies` | system or tenant | Reference list |

#### Step 2 — Define fields on each collection

**`employees`** — the parent

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| `emp_id` | text | `is_unique: true`, `is_display_key: true` | Business key, auto-shown in child grids |
| `emp_name` | text | `is_required: true` | |
| `dob` | date | | |
| `gender` | select | `catalog_slug: "gender"` | Content catalog reference |

**`emp-identities`** — child of employees

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| `employee` | relation | `relation_type: "m2o"`, `relationship_style: "child_of"`, `related_collection_id: <employees_id>` | **This is the parent link** |
| `identity_type` | select | `choices: ["IC", "Passport", "Visa", "Work Permit"]` | |
| `identity_no` | text | `is_required: true` | |
| `expiry_date` | date | | |
| `issue_date` | date | | |
| `country` | select | `catalog_slug: "country"` | |

> **Composite uniqueness:** Collection-level option: `unique_constraints: [["employee", "identity_type"]]`
> Meaning: one employee can't have two "IC" records.

**`emp-jobs`** — child of employees, effective-dated

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| `employee` | relation | `relation_type: "m2o"`, `relationship_style: "child_of"`, `related_collection_id: <employees_id>` | Parent link |
| `effective_date` | date | `is_required: true`, `is_effective_date: true` | **Effective dating anchor** |
| `department` | relation | `relation_type: "m2o"`, `relationship_style: "reference"`, `related_collection_id: <departments_id>` | Lookup dropdown |
| `company` | relation | `relation_type: "m2o"`, `relationship_style: "reference"`, `related_collection_id: <companies_id>` | Lookup dropdown |
| `job_title` | text | | |
| `salary` | number | `decimals: 2` | |

> **Composite uniqueness:** `unique_constraints: [["employee", "effective_date"]]`
> Meaning: one employee can't have two jobs on the same effective date.

**`job-allowances`** — child of emp-jobs (Level 3)

| Field | Type | Options | Notes |
|-------|------|---------|-------|
| `job` | relation | `relation_type: "m2o"`, `relationship_style: "child_of"`, `related_collection_id: <emp-jobs_id>` | Links to specific job record |
| `allowance_type` | select | `choices: ["Housing", "Transport", "Meal", "Phone"]` | |
| `amount` | number | `decimals: 2`, `is_required: true` | |
| `currency` | select | `catalog_slug: "currency"` | |

#### Step 3 — What the UI renders automatically

When a user opens an Employee item, PulseBox:

1. Detects all collections with a `child_of` relation pointing to `employees`
2. Renders each as a **tab** with an inline grid of child records
3. When a user clicks into an `emp-jobs` row, it detects `job-allowances` as a Level 3 child
4. Renders the allowances as a **nested inline grid** inside the expanded job row

**No code needed.** The schema builder metadata drives everything.

---

### Sample: Finance — Invoice Module

Same pattern, different domain:

```
invoices                           ← Level 1
├── invoice-lines                  ← Level 2 (child_of invoices)
│   └── line-tax-details           ← Level 3 (child_of invoice-lines)
├── invoice-payments               ← Level 2 (child_of invoices)
└── invoice-attachments            ← Level 2 (child_of invoices)
```

### Sample: Manufacturing — Work Orders

```
work-orders                        ← Level 1
├── wo-operations                  ← Level 2 (child_of work-orders)
│   └── wo-material-issues         ← Level 3 (child_of wo-operations)
├── wo-quality-checks              ← Level 2 (child_of work-orders)
└── wo-notes                       ← Level 2 (child_of work-orders)
```

---

## Schema Changes

### 1. Extend `collection_fields.options` for relation fields

```jsonc
// BEFORE (current)
{
  "related_collection_id": "uuid",
  "relation_type": "m2o",                  // m2o | o2o | m2m
  "junction_collection_id": "uuid"         // m2m only
}

// AFTER (extended)
{
  "related_collection_id": "uuid",
  "relation_type": "m2o",
  "relationship_style": "child_of",        // NEW — "child_of" | "reference" | "link"
  "junction_collection_id": "uuid",        // m2m only (unchanged)
  "display_field_slug": "emp_id"           // NEW — which field of the RELATED collection to show
}
```

> **`relationship_style`** defaults to `"reference"` for backward compatibility. Existing relation fields continue working unchanged.

### 2. Add `metadata` JSONB column to `collections`

```sql
-- Migration: add metadata column
ALTER TABLE collections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN collections.metadata IS 'Collection-level configuration: display_key_fields, unique_constraints, effective_date_field, cascade_rules';
```

**`metadata` schema:**

```jsonc
{
  // Which field(s) form the business key — shown in breadcrumbs, child grids, API responses
  "display_key_fields": ["emp_id"],

  // Composite uniqueness constraints (enforced server-side on insert/update)
  "unique_constraints": [
    ["employee", "identity_type"],             // EmpIdentities: one type per employee
    ["employee", "effective_date"]              // EmpJobs: one record per date per employee
  ],

  // Which date field determines "current" vs "historical" records
  "effective_date_field": "effective_date",     // null = not effective-dated

  // What happens to child records when a parent item is deleted
  "cascade_rules": {
    "on_parent_delete": "cascade"              // "cascade" | "restrict" | "nullify"
  },

  // Sort order for child tabs (when this collection appears as a child)
  "child_tab_sort_order": 1
}
```

### 3. No new tables needed

Everything is metadata on existing tables. This is intentional — keeps the system schema-agnostic and avoids migration complexity.

---

## API Extensions

### Existing endpoint: `GET /api/collections/:slug/items`

**New query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `parent_id` | uuid | Filter items where the `child_of` relation field = this UUID |
| `parent_field` | string | Which relation field to filter on (needed if collection has multiple parent links) |
| `effective_as_of` | date (ISO) | For effective-dated collections, return only the record where `effective_date ≤ value` (latest one) |
| `include_children` | boolean | If `true`, response includes `_children` map with nested child items (1 level) |

**Example: Get an employee's jobs**

```
GET /api/collections/emp-jobs/items?parent_id=<employee_item_id>
```

Response:
```json
{
  "items": [
    {
      "id": "uuid-job-1",
      "data": {
        "employee": "<employee_item_id>",
        "effective_date": "2025-01-01",
        "department": "<dept_item_id>",
        "company": "<company_item_id>",
        "job_title": "Senior Engineer",
        "salary": 8000.00
      },
      "_display": {
        "employee": "EMP-001",
        "department": "Engineering",
        "company": "Next Novas Sdn Bhd"
      }
    },
    {
      "id": "uuid-job-2",
      "data": {
        "employee": "<employee_item_id>",
        "effective_date": "2024-01-01",
        "department": "<dept_item_id>",
        "company": "<company_item_id>",
        "job_title": "Engineer",
        "salary": 6000.00
      },
      "_display": { ... }
    }
  ],
  "total": 2
}
```

**Example: Get current job only**

```
GET /api/collections/emp-jobs/items?parent_id=<employee_item_id>&effective_as_of=2026-03-25
```

Returns only the job with `effective_date ≤ 2026-03-25`, ordered by effective_date DESC, LIMIT 1.

**Example: Get employee with all children in one call**

```
GET /api/collections/employees/items/<item_id>?include_children=true
```

Response:
```json
{
  "id": "<item_id>",
  "data": { "emp_id": "EMP-001", "emp_name": "John Doe", "dob": "1990-05-15" },
  "_children": {
    "emp-identities": {
      "items": [ ... ],
      "total": 2
    },
    "emp-jobs": {
      "items": [ ... ],
      "total": 3
    },
    "emp-addresses": {
      "items": [ ... ],
      "total": 1
    }
  }
}
```

---

## UI Design — 3-Level Nested View

### Layout: Item Detail Page

When a user clicks on a row in the parent grid, they enter the **Item Detail Page** which renders all 3 levels on one screen:

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Employees                                             │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ EMP-001 · John Doe                              [Edit] [⋯] │ │
│ │ DOB: 1990-05-15  │  Gender: Male                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌──────────────┬──────────────┬──────────────┐                  │
│ │ Identities(2)│  Jobs(3)●    │ Addresses(1) │   ← child tabs  │
│ └──────────────┴──────────────┴──────────────┘                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────[+ Add]─┐ │
│ │ # │ Eff. Date   │ Department   │ Company     │ Title   │ ⋯ │ │
│ ├───┼─────────────┼──────────────┼─────────────┼─────────┼───┤ │
│ │ 1 │ 2025-01-01  │ Engineering  │ Next Novas  │ Sr Eng  │ ▼ │ │  ← Level 2
│ │   ┌─────────────────────────────────────────────────────┐   │ │
│ │   │ Allowances                               [+ Add]   │   │ │
│ │   │ # │ Type      │ Amount  │ Currency │               │   │ │
│ │   │ 1 │ Housing   │ 1500.00 │ MYR      │  [Edit] [✕]  │   │ │  ← Level 3
│ │   │ 2 │ Transport │  500.00 │ MYR      │  [Edit] [✕]  │   │ │
│ │   └─────────────────────────────────────────────────────┘   │ │
│ │ 2 │ 2024-01-01  │ Engineering  │ Next Novas  │ Eng     │ ▶ │ │  ← collapsed
│ │ 3 │ 2023-06-01  │ Sales        │ Next Novas  │ Sales   │ ▶ │ │  ← collapsed
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 3 jobs total                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### UI Component Hierarchy

```
ItemDetailPage (server component)
├── ParentItemHeader          — summary card with key fields + edit button
├── ChildCollectionTabs       — tab bar for each child_of collection
│   └── ChildCollectionGrid   — paginated grid (Level 2)
│       ├── ChildRow          — expandable row with expand/collapse toggle
│       │   └── GrandchildGrid — inline nested grid (Level 3, lazy-loaded)
│       └── AddChildDialog    — pre-populates parent relation field
└── Pagination
```

### Design Rules

1. **Level 1 (Parent):** Summary card at top — shows display key fields in a compact header. Not a full grid row. Edit opens dialog.

2. **Level 2 (Child grid):** Full data grid inside a tab panel. Each child collection is a separate tab. Tab label shows collection name + count badge. Grid supports sort, paginate, add, edit, delete.

3. **Level 3 (Grandchild):** Inline grid that appears **inside** an expanded Level 2 row. Only one Level 2 row is expanded at a time (accordion behavior). Grandchild grid is compact — fewer columns, smaller text.

4. **Expand/Collapse:** Level 2 rows show a `▶`/`▼` chevron. Click to expand. If a Level 2 collection has no Level 3 children, no chevron is shown.

5. **Lazy loading:** Level 3 data is NOT fetched until the user expands a Level 2 row. This keeps the initial page load fast.

6. **Add child record:** The "Add" button in a child grid **pre-fills the parent relation field** and **hides it** (the user doesn't need to pick the parent — it's implied by context).

7. **Effective dating badge:** If a Level 2 collection has `effective_date_field`, the most recent record gets a "Current" badge. Historical records are visually dimmed.

### Styling (matches PulseBox theme tokens)

```tsx
{/* Parent header card */}
<div className="rounded-lg border border-gray-200 bg-white p-5">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans)" }}>
        EMP-001 · John Doe
      </h2>
      <div className="flex gap-4 mt-1 text-sm text-gray-500">
        <span>DOB: 1990-05-15</span>
        <span>Gender: Male</span>
      </div>
    </div>
    <Button variant="outline" size="sm">Edit</Button>
  </div>
</div>

{/* Child tab bar */}
<div className="flex gap-0 border-b border-gray-200">
  {childCollections.map(child => (
    <button className={`px-4 py-2 text-sm ${
      active === child.slug
        ? "text-blue-600 border-b-2 border-blue-400 font-medium"
        : "text-gray-500 hover:text-blue-600"
    }`}>
      {child.name}
      <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs">{child.count}</span>
    </button>
  ))}
</div>

{/* Level 3 nested grid (inside expanded row) */}
<tr>
  <td colSpan={columns + 1} className="p-0">
    <div className="ml-8 mr-4 my-2 rounded border border-blue-100 bg-blue-50/30">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs font-medium text-gray-700">Allowances</span>
        <Button variant="ghost" size="sm">+ Add</Button>
      </div>
      <Table className="text-xs">
        {/* compact grandchild grid */}
      </Table>
    </div>
  </td>
</tr>
```

---

## Performance Considerations

### Problem: JSONB queries at scale

All items live in one `collection_items` table with a JSONB `data` column. As the dataset grows (100K+ items per collection), filtering on nested JSONB fields gets slow.

### Mitigation Strategy

#### 1. Indexes — GIN already exists, add targeted expression indexes

```sql
-- Already exists (from Phase 1)
CREATE INDEX idx_items_data ON collection_items USING GIN(data);

-- NEW: Composite index for parent-child lookups (the most common query)
-- This is a partial GIN index — only indexes items that have relation field values
CREATE INDEX idx_items_parent_lookup
  ON collection_items (collection_id, tenant_id)
  INCLUDE (id, data);

-- For effective-dated queries: extract the date from JSONB
-- Created dynamically per collection when effective_date_field is set
-- Example for emp-jobs:
CREATE INDEX idx_effective_date_emp_jobs
  ON collection_items ((data->>'effective_date'))
  WHERE collection_id = '<emp-jobs-uuid>';
```

#### 2. Pagination everywhere — never load all children

| Level | Default page size | Max page size |
|-------|------------------|---------------|
| Level 1 (parent grid) | 20 | 100 |
| Level 2 (child grid) | 10 | 50 |
| Level 3 (grandchild) | 5 | 20 |

#### 3. Lazy loading — Level 3 is on-demand

- Initial page load fetches: parent item + Level 2 items for the active tab
- Level 3 items are fetched **only when** the user expands a Level 2 row
- Each expand is a single API call: `GET /api/collections/:child-slug/items?parent_id=:id&limit=5`

#### 4. Server-side `parent_id` filtering with JSONB operator

```sql
-- When parent_field = "employee" and parent_id = "uuid-123"
SELECT id, data, created_at, updated_at
FROM collection_items
WHERE collection_id = $1
  AND tenant_id = $2
  AND data->>$3 = $4            -- $3 = field slug, $4 = parent item UUID
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

The GIN index on `data` supports `->>` operator lookups. For hot paths, we can add a **computed column + B-tree index**:

```sql
-- Optional optimization for very large child collections (100K+ rows)
-- Add a materialized parent_id column extracted from JSONB
ALTER TABLE collection_items ADD COLUMN parent_item_id UUID;
CREATE INDEX idx_items_parent_id ON collection_items (parent_item_id) WHERE parent_item_id IS NOT NULL;

-- Populated by trigger on INSERT/UPDATE when the collection has a child_of relation
```

> **Decision: Start without the materialized column.** JSONB `->>` with GIN is fast enough for 10K-50K rows per collection. Add the materialized column only if query times exceed 100ms at scale.

#### 5. Count queries — avoid COUNT(*) on large tables

For tab badges (showing child count), use **estimated counts** for large collections:

```sql
-- Fast: exact count for small sets (< 1000 rows), via filtered query with LIMIT
-- The API already returns count from Supabase's { count: "exact" } option
-- For large child sets, consider switching to { count: "estimated" }
```

#### 6. Batch display resolution

When rendering a child grid, relation fields (like Department, Company) need label resolution. Current code already batches this per field — fetch all unique UUIDs → single query per related collection. This pattern scales well. No change needed.

### Scaling Benchmarks (targets)

| Scenario | Target Response Time |
|----------|---------------------|
| Load parent item + active child tab (10 rows) | < 200ms |
| Expand Level 2 row → fetch Level 3 (5 rows) | < 150ms |
| Load parent item with `include_children=true` (3 child collections, 10 rows each) | < 500ms |
| Filter child grid by parent_id (50K row collection) | < 100ms with GIN index |

---

## Validation — Composite Unique Constraints

### Server-side enforcement (in `validateItemData`)

```typescript
// Pseudo-code for composite unique validation
async function validateCompositeUniques(
  collectionId: string,
  tenantId: string,
  data: Record<string, unknown>,
  itemId?: string  // null for create, uuid for update (exclude self)
): Promise<string[]> {
  const errors: string[] = [];
  const collection = await getCollection(collectionId);
  const constraints = collection.metadata?.unique_constraints ?? [];

  for (const fieldSlugs of constraints) {
    // Build a JSONB match object
    const match: Record<string, unknown> = {};
    for (const slug of fieldSlugs) {
      match[slug] = data[slug];
      if (match[slug] === undefined || match[slug] === null) break; // skip if any field is null
    }

    // Query for existing items matching all fields in the constraint
    let query = supabase
      .from("collection_items")
      .select("id", { count: "exact", head: true })
      .eq("collection_id", collectionId)
      .eq("tenant_id", tenantId);

    for (const [slug, value] of Object.entries(match)) {
      query = query.eq(`data->>${slug}`, String(value));
    }

    if (itemId) {
      query = query.neq("id", itemId); // exclude self on update
    }

    const { count } = await query;
    if (count && count > 0) {
      errors.push(`Duplicate: combination of [${fieldSlugs.join(", ")}] already exists`);
    }
  }

  return errors;
}
```

---

## Cascade Rules

When a parent item is deleted, what happens to children?

| Rule | Behavior | Use Case |
|------|----------|----------|
| `cascade` | Delete all child items automatically | EmpIdentities — no orphans allowed |
| `restrict` | Block parent deletion if children exist | Departments — don't delete if employees reference it |
| `nullify` | Set the child's parent field to null | Soft detach — rarely used |

**Default:** `restrict` (safest). Configurable per collection in `metadata.cascade_rules`.

**Implementation:** Server-side in the DELETE item handler — before deleting, check for child collections, apply the rule. Not a DB-level FK (since relations are JSONB), so enforced in application code.

---

## Schema Builder UI Changes

### Field creation dialog — new `relationship_style` selector

When the user selects field type = `relation` and relation type = `m2o`:

```
┌─────────────────────────────────────────┐
│ Relation Type:  ● Many-to-One           │
│                 ○ One-to-One            │
│                 ○ Many-to-Many          │
│                                         │
│ Related Collection: [ Employees      ▼] │
│                                         │
│ Relationship Style:                     │
│   ● Child of (master-detail)            │
│     → This collection's items are       │
│       sub-records of the selected       │
│       collection. They appear as a      │
│       tab on the parent item view.      │
│                                         │
│   ○ Reference (lookup/dropdown)         │
│     → Select from the related           │
│       collection's items. Used for      │
│       shared lists like Department,     │
│       Company, Country.                 │
│                                         │
│   ○ Link (association)                  │
│     → A loose link to another record.   │
│       No special UI behavior.           │
│                                         │
│ Display Field: [ emp_id            ▼]   │
│   The field shown in dropdowns and      │
│   parent references.                    │
│                                         │
└─────────────────────────────────────────┘
```

### Collection settings — new metadata section

On the Schema tab of a collection, add a **"Collection Settings"** section:

```
┌─────────────────────────────────────────┐
│ Collection Settings                     │
│                                         │
│ Display Key Fields:                     │
│   [emp_id] [×]  [+ Add field]          │
│   Fields shown as the record identity   │
│   in breadcrumbs and parent references. │
│                                         │
│ Unique Constraints:                     │
│   1. [employee, identity_type] [×]      │
│   [+ Add constraint]                    │
│                                         │
│ Effective Date Field:                   │
│   [ effective_date           ▼]  [×]    │
│   Records are sorted by this field.     │
│   Most recent = "current" record.       │
│                                         │
│ On Parent Delete:                       │
│   ● Restrict (block if children exist)  │
│   ○ Cascade (delete children too)       │
│   ○ Nullify (clear parent reference)    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Schema Foundation (no UI changes)

**Goal:** Add the metadata columns and API support so the system understands parent-child relationships.

- [ ] Migration: add `metadata` JSONB column to `collections` table
- [ ] Extend `collection_fields.options` validation to accept `relationship_style` and `display_field_slug`
- [ ] Default `relationship_style` to `"reference"` for all existing relation fields (backward compatible)
- [ ] Add `parent_id` and `parent_field` query params to items API
- [ ] Add `effective_as_of` query param to items API
- [ ] Server action: `getChildCollections(parentCollectionId)` — returns collections that have a `child_of` field pointing here
- [ ] Composite unique constraint validation in `validateItemData()`
- [ ] Cascade rule enforcement in item DELETE handler
- [ ] Update TypeScript types

### Phase 2: Item Detail Page + Child Tabs (Level 1 → Level 2)

**Goal:** Clicking a parent item opens a detail page with child collection tabs.

- [ ] New page: `/dashboard/studio/collections/[slug]/items/[id]/page.tsx`
- [ ] `ParentItemHeader` component — compact card showing display key fields
- [ ] `ChildCollectionTabs` component — tab bar from `getChildCollections()` result
- [ ] `ChildCollectionGrid` component — paginated grid filtered by `parent_id`
- [ ] "Add child" dialog — pre-populates and hides the parent relation field
- [ ] Edit/delete child items inline
- [ ] Effective date badge ("Current" / dimmed historical records)
- [ ] Link parent grid rows → detail page (click row to navigate)

### Phase 3: Grandchild Grid (Level 3) + Schema Builder Updates

**Goal:** Expand a Level 2 row to see Level 3 children inline. Schema builder supports new options.

- [ ] `GrandchildGrid` component — compact inline grid inside expanded Level 2 row
- [ ] Accordion behavior — only one Level 2 row expanded at a time
- [ ] Lazy loading — fetch Level 3 data on expand
- [ ] Schema builder: `relationship_style` selector in create-field-dialog
- [ ] Schema builder: collection settings section (display key, unique constraints, effective date, cascade)
- [ ] Update field creation/editing server actions to persist new options

### Phase 4: API Extensions + Performance

**Goal:** Full API support for external consumers, performance optimization.

- [ ] `include_children` param on single-item GET
- [ ] `_display` map in API responses (resolved labels for relation fields)
- [ ] Expression indexes for hot parent-child lookups
- [ ] Performance testing with 10K+ items per collection
- [ ] Optional: materialized `parent_item_id` column + trigger (if JSONB queries are too slow)
- [ ] Rate limiting per endpoint tier (parent vs child vs grandchild)

### Future (Roadmap, not scoped)

- [ ] Row-level security within collections (field-level visibility, record-level access)
- [ ] Drag-and-drop reorder for child records
- [ ] Visual relationship diagram in Studio
- [ ] Bulk operations on child records (mass update, mass delete)
- [ ] Cross-collection calculated fields (e.g., sum of child amounts on parent)

---

## Migration Script (Phase 1)

```sql
-- 00036_collection_relations.sql

-- 1. Add metadata column to collections
ALTER TABLE collections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN collections.metadata IS
  'Collection-level config: display_key_fields, unique_constraints, effective_date_field, cascade_rules';

-- 2. No schema change needed for collection_fields — options is already JSONB
--    New keys (relationship_style, display_field_slug) are stored in existing options column

-- 3. Backfill: set relationship_style = "reference" for all existing relation fields
UPDATE collection_fields
SET options = options || '{"relationship_style": "reference"}'
WHERE field_type = 'relation'
  AND (options->>'relationship_style') IS NULL;

-- 4. Index for parent-child item lookups via JSONB
--    The existing GIN index on data handles this, but we add a targeted index
--    for the most common pattern: filtering by a single JSONB key value
CREATE INDEX IF NOT EXISTS idx_items_collection_tenant
  ON collection_items (collection_id, tenant_id, created_at DESC);
```

---

## Notes

- **Backward compatible:** All existing collections and relation fields continue working. The new `relationship_style` and `metadata` fields are optional with sensible defaults.
- **System + tenant collections:** Master-detail works identically for both. A super admin can model system-level hierarchies (e.g., employees → jobs), and tenant admins can create their own.
- **3-level maximum:** The UI supports 3 levels max. Deeper hierarchies can exist in the data model but are navigated via drill-down (clicking a Level 3 item opens its own detail page if it has children).
- **API-first:** Every UI feature has a corresponding API endpoint. External consumers can build their own UIs on top of the same relationship metadata.
