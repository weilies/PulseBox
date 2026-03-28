# PulseBox ERP-OS — Phase 1 Design Spec

> **Status:** Approved (brainstorming)
> **Date:** 2026-03-28
> **Scope:** App Bundle Model + Rule Engine v1

---

## Vision

PulseBox evolves from a headless CMS into an **ERP-OS** — a platform where Next Novas builds small, focused apps (Workforce, Leave, Payroll, Expense, GL, etc.) that tenants subscribe to and extend. Phase 1 establishes the two foundational pillars: how apps are packaged/installed, and how cross-field business logic is configured without code.

## Full Roadmap (Context)

```
Phase 1   — Platform Infrastructure: App Bundle model + Rule Engine v1
Phase 1.5 — Task Inbox / Notifications (bell icon, tenant-scoped)
Phase 2   — Workflow Engine (drag-drop approval nodes, multi-level)
Phase 3   — First ERP Apps (Workforce, Leave, Clocking)
Phase 4   — Finance Apps (Expense, Books/Journal, GL)
Phase 5   — Script Layer + Marketplace (sandboxed JS, app publishing)
```

---

## Pillar 1 — App Bundle Model

### What Is an App?

An **App** is an installable package that bundles related collections, fields, content catalogs, navigation items, default RBAC policies, and platform-wide rules into a single deployable unit. Think of it as a "module on steroids" — it replaces the current `modules`/`tenant_modules` pattern with proper versioned packaging.

### Design Principles

- **Small and focused** — not "HRMS", but "Workforce", "Leave", "Payroll" as separate apps
- **Additive installs** — installing an app seeds data structures; never destructive
- **Safe uninstalls** — disabling an app hides nav/access but never deletes data
- **Tenant extensibility** — tenants add rules on top of platform rules, never modify platform ones

### Data Model

#### `apps` table

| Column       | Type      | Description |
|-------------|-----------|-------------|
| id          | UUID PK   | |
| slug        | TEXT UNIQUE | e.g. `workforce`, `leave`, `payroll` |
| name        | TEXT      | Display name, e.g. "Workforce Management" |
| description | TEXT      | Short description for app store |
| version     | TEXT      | Semver, e.g. "1.0.0" |
| category    | TEXT      | `hr`, `finance`, `operations`, `platform` |
| author      | TEXT      | `nextnovas` or tenant slug (future marketplace) |
| icon        | TEXT      | Lucide icon name for nav |
| is_system   | BOOL      | true = built by Next Novas |
| bundle      | JSONB     | Full app definition (see below) |
| status      | TEXT      | `draft`, `published` |
| created_at  | TIMESTAMPTZ | |
| updated_at  | TIMESTAMPTZ | |

#### `app_installs` table

> Named `app_installs` (not `app_installs`) to avoid collision with the existing `app_installs` table used for API credentials (app_id/app_secret).

| Column       | Type      | Description |
|-------------|-----------|-------------|
| id          | UUID PK   | |
| tenant_id   | UUID FK   | References `tenants.id` |
| app_id      | UUID FK   | References `apps.id` |
| installed_at | TIMESTAMPTZ | |
| installed_by | UUID FK  | User who installed |
| config      | JSONB     | Tenant-level overrides (future) |
| status      | TEXT      | `active`, `disabled` |

#### Bundle JSONB Schema

```json
{
  "collections": [
    {
      "slug": "employees",
      "name": "Employees",
      "type": "system",
      "metadata": { "display_key_fields": ["employee_id", "full_name"] }
    }
  ],
  "fields": [
    {
      "collection_slug": "employees",
      "name": "employee_id",
      "field_type": "text",
      "required": true,
      "options": {}
    }
  ],
  "content_catalogs": [
    { "slug": "employment-type", "name": "Employment Type", "items": ["Full-Time", "Part-Time", "Contract"] }
  ],
  "nav_folders": [
    { "slug": "hr", "name": "Human Resources", "icon": "Users" }
  ],
  "nav_items": [
    { "folder_slug": "hr", "collection_slug": "employees", "label": "Employees", "icon": "UserCheck" }
  ],
  "default_policies": [
    {
      "name": "HR Read Access",
      "permissions": [
        { "resource_type": "collection", "resource_slug": "employees", "read": true, "create": false, "update": false, "delete": false }
      ]
    }
  ],
  "rules": [
    {
      "collection_slug": "employees",
      "rule_type": "validation",
      "name": "Age limit",
      "priority": 1,
      "conditions": { "logic": "AND", "rules": [] },
      "actions": { "type": "validation", "field": "age", "op": "lte", "value": 60, "message": "Employee age must not exceed 60" }
    },
    {
      "collection_slug": "employees",
      "rule_type": "derivation",
      "name": "Compute tax",
      "priority": 1,
      "conditions": { "logic": "AND", "rules": [{ "field": "department", "op": "eq", "value": "IT" }] },
      "actions": { "type": "derivation", "target_field": "compute_tax", "formula": "salary * 0.10" }
    }
  ]
}
```

### Install Flow

1. Next Novas creates app record with `status: 'published'`
2. Tenant admin navigates to **Studio > App Store**
3. Clicks "Install" on the app card
4. Backend processes `bundle` JSONB:
   - Creates collections (if not exist) with `app_id` tag
   - Creates fields on those collections
   - Seeds content catalogs
   - Creates nav folders/items scoped to tenant
   - Creates default policies (tenant can modify later)
   - Creates platform-wide rules (read-only to tenant)
5. `app_installs` row inserted with `status: 'active'`

### Uninstall / Disable

- **Disable:** Sets `app_installs.status = 'disabled'`, hides nav items, removes API access. Data stays.
- **Uninstall:** Same as disable. Data is never auto-deleted. Manual cleanup is a separate admin action.
- **Upgrade:** New version is additive — new fields appended, new rules added. Existing data untouched.

### Relationship to Existing Tables

| Current Table | Fate |
|--------------|------|
| `modules` | Replaced by `apps` |
| `tenant_modules` | Replaced by `app_installs` |
| `collections.module_id` | Replaced by `collections.app_id` (nullable FK) |

Migration: existing modules → apps records, existing tenant_modules → app_installs records.

---

## Pillar 2 — Rule Engine v1

### What Is a Rule?

A **Rule** is a configurable unit of business logic attached to a collection. Rules fire on `preSave` (before insert/update) and produce either **validation errors** (block save) or **derived values** (compute and set fields). Rules are tenant-aware: platform-wide rules apply to all tenants, tenant-specific rules apply only to one tenant.

### Design Principles

- **Derivations before validations** — derived values must exist before validation can assert against them
- **Sequenced execution** — rules have explicit priority; drag-to-reorder in Studio
- **Parent context** — child collection rules can access the linked parent record
- **Shared evaluation** — one evaluator function, used by both API routes and server actions
- **Formula expressions** — Excel-like syntax evaluated by a safe math parser (no arbitrary code execution)

### Data Model

#### `collection_rules` table

| Column          | Type      | Description |
|----------------|-----------|-------------|
| id             | UUID PK   | |
| collection_slug | TEXT FK  | Which collection this rule applies to |
| app_id         | UUID FK NULL | Which app defined this rule (NULL = manual) |
| tenant_id      | UUID FK NULL | NULL = platform-wide, set = tenant-specific |
| rule_type      | TEXT      | `validation` or `derivation` |
| name           | TEXT      | Human-readable rule name |
| description    | TEXT NULL | Optional explanation |
| priority       | INT       | Execution order within type+scope (lower = first) |
| is_active      | BOOL      | Can be toggled without deletion |
| conditions     | JSONB     | When this rule fires (see Condition Schema) |
| actions        | JSONB     | What it does (see Action Schema) |
| require_parent | BOOL DEFAULT false | Load parent record into evaluation context |
| created_by     | UUID FK NULL | User who created |
| created_at     | TIMESTAMPTZ | |
| updated_at     | TIMESTAMPTZ | |

#### Condition Schema (JSONB)

```json
{
  "logic": "AND",
  "rules": [
    { "field": "department", "op": "eq", "value": "IT" },
    { "field": "parent.level", "op": "gte", "value": 5 }
  ]
}
```

Supported operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `contains`, `is_empty`, `is_not_empty`

Field references:
- `field_name` — current record field
- `parent.field_name` — parent record field (requires `require_parent: true`)

Empty conditions (`null` or `{ "logic": "AND", "rules": [] }`) = always fires (unconditional rule).

#### Action Schema — Validation

```json
{
  "type": "validation",
  "field": "salary",
  "op": "lte",
  "value": 2000,
  "message": "IT department salary must not exceed $2,000"
}
```

#### Action Schema — Derivation

```json
{
  "type": "derivation",
  "target_field": "compute_tax",
  "formula": "salary * 0.10"
}
```

Formula syntax supports:
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Field references: `salary`, `base_pay`, `parent.department`
- Conditionals: `IF(department = "IT", salary * 0.12, salary * 0.08)`
- Functions: `ROUND(x, decimals)`, `MIN(a, b)`, `MAX(a, b)`, `ABS(x)`
- String: field references in conditions (equality checks)

Evaluated using a safe math expression parser (e.g. `mathjs` or custom parser). No `eval()`, no arbitrary JS.

### Execution Flow

```
preSave(collectionSlug, itemData, parentId?, tenantId)
  │
  ├─ 1. FIELD-LEVEL VALIDATION (existing, unchanged)
  │     Required, min/max, unique constraints
  │     → if errors, return 422 immediately (fast fail)
  │
  ├─ 2. LOAD CONTEXT
  │     ├─ Load parent record (if any rule has require_parent=true AND parentId provided)
  │     └─ Build context: { ...itemData, parent: parentRecord || {} }
  │
  ├─ 3. LOAD RULES
  │     ├─ Query collection_rules WHERE collection_slug AND is_active=true
  │     ├─ Filter: platform-wide (tenant_id IS NULL) + tenant rules (tenant_id = current)
  │     └─ Sort: derivations first, then validations; within each: platform before tenant, then by priority ASC
  │
  ├─ 4. EXECUTE DERIVATIONS (in order)
  │     For each derivation rule:
  │       ├─ Evaluate conditions against context
  │       ├─ If conditions match:
  │       │   ├─ Evaluate formula against context
  │       │   └─ Update context[target_field] = result
  │       └─ If conditions don't match: skip
  │     (Each derivation sees the output of all previous derivations)
  │
  ├─ 5. EXECUTE VALIDATIONS (in order)
  │     For each validation rule:
  │       ├─ Evaluate conditions against context (post-derivation)
  │       ├─ If conditions match:
  │       │   └─ Apply assertion → if fails, add to errors[]
  │       └─ If conditions don't match: skip
  │     (Collect ALL errors, don't stop at first)
  │
  ├─ 6a. ERRORS FOUND
  │      Return 422 { errors: [{ field, message, rule_id }] }
  │      Same shape for UI + API — shared error contract
  │
  └─ 6b. NO ERRORS
         Merge derived values into itemData
         Proceed to DB insert/update
         Then fire postSave webhooks (existing system)
```

### Execution Order Detail

```
Priority │ Scope     │ Type        │ Example
─────────┼───────────┼─────────────┼─────────────────────────────
1        │ built-in  │ field-level  │ required, min/max, unique
─────────┼───────────┼─────────────┼─────────────────────────────
2        │ platform  │ derivation   │ compute_tax = salary * 0.10
3        │ platform  │ derivation   │ net_salary = salary - compute_tax
4        │ tenant    │ derivation   │ bonus = salary * 0.05 (tenant A only)
─────────┼───────────┼─────────────┼─────────────────────────────
5        │ platform  │ validation   │ salary must be > 0
6        │ platform  │ validation   │ age must be <= 60
7        │ tenant    │ validation   │ IT salary <= 2000 (tenant B only)
```

### Parent Context — Detail

When a child collection has a relation field to a parent (e.g. `employment_history.employee_id → employees`):

1. Rule on `employment_history` sets `require_parent: true`
2. On preSave, engine detects the relation field pointing to parent collection
3. Loads the parent record by ID from the relation field value
4. Makes it available as `parent.*` in conditions and formulas

```
Example:
  Collection:     employment_history (child)
  Parent:         employees (via employee_id field)
  Rule type:      derivation
  require_parent: true
  Condition:      parent.department = "IT" AND parent.level = "senior"
  Formula:        parent.salary * 0.15
  Target:         employer_contribution
```

### Studio UI — Rules Tab

Located on the collection detail page, alongside Fields/Settings tabs.

**Layout:**
- Sub-tabs: **Validations** | **Derivations**
- Each sub-tab shows a list of rules, grouped:
  - **Platform Rules** (grey lock icon, read-only for tenant users)
  - **Tenant Rules** (full CRUD, drag-to-reorder)
- Add Rule button → opens rule builder dialog

**Rule Builder Dialog:**
- Name + description fields
- **Condition Builder** (GUI):
  - Dropdown: field selector (includes `parent.*` fields if collection has parent relation)
  - Dropdown: operator (`equals`, `greater than`, etc.)
  - Input: value
  - AND/OR logic toggle
  - "+ Add condition" button
- **Action** (depends on rule_type):
  - Validation: field selector + operator + value + error message
  - Derivation: target field selector + formula text input
- **Formula Helper** (for derivation):
  - Available fields listed as clickable chips
  - Function reference: `IF()`, `ROUND()`, `MIN()`, `MAX()`
  - Live preview: input sample values → see computed result

**Test Panel:**
- Input sample data (JSON or form fields)
- Click "Test Rules" → shows:
  - Which rules fired
  - Derived values produced
  - Validation errors (if any)

### API Considerations

Rules are evaluated automatically on:
- `POST /api/collections/:slug/items` (create)
- `PUT /api/collections/:slug/items/:id` (update)

Returned errors follow existing error contract:
```json
{
  "error": "Validation failed",
  "details": [
    { "field": "salary", "message": "IT department salary must not exceed $2,000", "rule_id": "uuid" },
    { "field": "compute_tax", "message": "Computed tax exceeds maximum threshold", "rule_id": "uuid" }
  ]
}
```

No separate API needed to "run rules" — they are part of the save pipeline.

**Rule management API** (for Studio UI):
- `GET /api/collections/:slug/rules` — list rules (platform + tenant)
- `POST /api/collections/:slug/rules` — create tenant rule
- `PUT /api/collections/:slug/rules/:id` — update tenant rule
- `DELETE /api/collections/:slug/rules/:id` — delete tenant rule (platform rules cannot be deleted by tenant)
- `POST /api/collections/:slug/rules/test` — test rules against sample data

### Implementation Notes

**Formula Parser:** Use `mathjs` library for safe expression evaluation. It supports:
- Math operations and functions
- Custom variables (field values injected as scope)
- No access to Node.js globals, filesystem, or network
- Already handles operator precedence, parentheses, etc.

Wrap `mathjs` with a custom layer for:
- `IF(condition, then, else)` syntax
- Field reference resolution (dot notation for `parent.*`)
- Type coercion (string comparisons in conditions)

**RLS:** `collection_rules` needs RLS policies:
- Platform rules (tenant_id IS NULL): readable by all authenticated users, writable only by super_admin
- Tenant rules: readable/writable by tenant users with `manage_schema` permission on that collection

---

## What Phase 1 Does NOT Include

- Script engine / sandboxed JS (Phase 5)
- Workflow engine / approvals (Phase 2)
- Task inbox / notifications (Phase 1.5)
- Marketplace / app publishing by tenants (Phase 5)
- postSave derivations (only preSave in v1)
- Chained rules across collections (rule on collection A triggers re-evaluation of collection B)
- Rule versioning / history (future)

---

## Success Criteria

1. Next Novas can define an app bundle (JSON), publish it, and a tenant can install it in one click
2. Platform-wide rules apply to all tenants using a system collection
3. Tenant IT can add their own validation/derivation rules via Studio UI without calling Next Novas
4. Rules execute in deterministic order (derivations before validations, platform before tenant)
5. Child collection rules can reference parent record fields
6. Formula expressions handle real payroll scenarios: `salary * rate`, `IF(dept = "X", a, b)`, `ROUND(x, 2)`
7. Same validation errors appear in UI and API responses
