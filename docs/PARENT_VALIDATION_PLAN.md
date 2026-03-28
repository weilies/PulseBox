# Plan: Parent Existence Validation for Child Items

## Problem

When creating/updating a child collection item (e.g. an Employment record under an Employee), the system does **not** validate that the parent item actually exists. This means:
- API consumers can POST a child record with a fake/deleted `employee_id` → orphan record
- UI "+ Add" button pre-fills the parent ID, but nothing stops a direct API call from skipping it

## Current Data Flow

```
UI (+ Add button)  ──→  Server Action (studio.ts)  ──→  ItemsService.createItem()  ──→  validateItemData()  ──→  INSERT
API (POST /api/...)  ──→  route.ts POST handler  ──────────────────────────────────→  validateItemData()  ──→  INSERT
```

Both paths go through **`validateItemData()`** in `src/lib/collection-validation.ts`. This is the single point to add the check.

## Plan

### Step 1: Add parent validation in `validateItemData()`

**File:** `src/lib/collection-validation.ts`

After the existing field-level checks (required, type, unique), add a new section:

```
For each field where field_type = "relation":
  1. Read field.options → get relationship_style, related_collection_id
  2. If relationship_style === "child_of":
     a. Get the value from data[field.slug] (this is the parent item ID)
     b. If value is empty/null AND field is required → already caught by required check
     c. If value is present → query collection_items where id = value AND collection_id = related_collection_id
     d. If no row found → push error: "{field.name} references a parent record that does not exist"
```

This covers both CREATE and UPDATE — if someone tries to re-point a child to a non-existent parent on update, it will also fail.

### Step 2: Also validate "reference" and "link" relation fields

For consistency, extend the same check to **all** relation fields (not just `child_of`):

```
If relationship_style is "child_of", "reference", or "link":
  If data[field.slug] has a value → verify the referenced item exists in related_collection_id
```

This prevents dangling references of any kind.

### Step 3: Update API documentation

**File:** `src/app/api/collections/[slug]/items/route.ts` (and `[id]/route.ts`)

Add JSDoc comments explaining:
- Parent validation behavior on POST/PUT
- Error response format (422 with field-level errors)
- Example request/response for creating a child item

### Files Changed

| File | Change |
|------|--------|
| `src/lib/collection-validation.ts` | Add relation/parent existence check in `validateItemData()` |
| `src/app/api/collections/[slug]/items/route.ts` | Add API doc comments with examples |
| `src/app/api/collections/[slug]/items/[id]/route.ts` | Add API doc comments with examples |

### API Examples (to be added as comments)

**Creating a child item (Employment under Employee):**
```
POST /api/collections/employments/items
Authorization: Bearer <token>
X-Tenant-Id: <tenant-id>

{
  "data": {
    "employee_id": "abc-123-existing-employee-uuid",
    "effective_date": "2026-01-15",
    "location": "Singapore"
  }
}
```

**Success (201):**
```json
{ "data": { "id": "new-uuid", "data": { "employee_id": "abc-123", ... }, "created_at": "..." } }
```

**Failure — parent doesn't exist (422):**
```json
{ "errors": [{ "field": "employee_id", "message": "Employee references a record that does not exist" }] }
```

**Failure — parent ID missing on required field (422):**
```json
{ "errors": [{ "field": "employee_id", "message": "Employee is required" }] }
```

### Not in Scope

- **Cascade delete** — already implemented in DELETE handler (restrict/cascade/nullify)
- **DB-level foreign keys** — parent refs live in JSONB, not in relational columns; validation stays in app layer
- **Batch validation** — for bulk imports, this would need optimization (batch existence checks). Not needed now.
