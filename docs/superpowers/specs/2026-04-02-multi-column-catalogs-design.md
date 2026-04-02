# Design Spec: Multi-Column Content Catalogs with Context-Aware Filtering

**Date:** 2026-04-02  
**Feature:** Add flexible columns to content catalogs and context-aware filtering for dropdown fields  
**Status:** Approved for implementation

---

## Overview

Currently, `content_catalog_items` are limited to hardcoded `label` and `value` columns. This prevents modeling rich domain data (e.g., a "country" catalog with currency, ISO code, phone prefix, nationality) and forces admins to create separate catalogs for the same entity in different contexts.

This feature adds:
1. **Multi-column support** — each catalog defines its own schema (label, value, + custom columns)
2. **Context-aware filtering** — show only catalog items matching parent record conditions (e.g., "show employment actions only if employment_type matches")
3. **Per-field display configuration** — same catalog can display different columns in different fields

---

## Requirements

1. **Flexible columns per catalog** — define column schema in catalog metadata
2. **Context-aware dropdown filtering** — filter items by parent record field values
3. **Per-field display columns** — each field using a catalog can choose which columns to display
4. **Backwards compatible** — existing catalogs/fields work without changes
5. **Visual builder UI** — admin configures filters/columns with dropdowns, not code
6. **Graceful fallbacks** — missing parent fields or no matches → sensible defaults

---

## Data Schema

### content_catalogs Table

**Add column:**
```sql
ALTER TABLE content_catalogs ADD COLUMN columns JSONB DEFAULT NULL;
```

**Schema definition (JSONB):**
```json
{
  "columns": [
    {
      "key": "label",
      "type": "text",
      "required": true,
      "description": "Display name"
    },
    {
      "key": "value",
      "type": "text",
      "required": true,
      "unique": true,
      "description": "Unique identifier"
    },
    {
      "key": "category",
      "type": "text",
      "required": false,
      "description": "Category/grouping"
    },
    {
      "key": "requires_approval",
      "type": "boolean",
      "required": false
    }
  ]
}
```

**Column definition fields:**
- `key` (string, required): Column identifier (used in data JSONB)
- `type` (string, required): One of `text`, `number`, `boolean`, `date`, `datetime`
- `required` (boolean, optional): Must have a value
- `unique` (boolean, optional): Values are unique within catalog
- `description` (string, optional): Help text for admin

**Default behavior:**
- If `columns` is NULL → auto-default to `[{key: "label", type: "text"}, {key: "value", type: "text"}]`
- Existing catalogs without explicit schema use defaults (backwards compatible)

---

### content_catalog_items Table

**Add column:**
```sql
ALTER TABLE content_catalog_items ADD COLUMN data JSONB DEFAULT '{}';
```

**Storage:**
- `label`, `value`, `sort_order`, `is_active` — kept as hardcoded columns (backwards compatible)
- `data` — stores extra columns defined in catalog schema
- Example:
  ```json
  {
    "id": "uuid",
    "catalog_id": "uuid",
    "label": "Hire",
    "value": "hire",
    "sort_order": 1,
    "is_active": true,
    "data": {
      "category": "New Hire",
      "requires_approval": false
    }
  }
  ```

---

### collection_fields.options Extension

**For select/multiselect fields, add:**

```json
{
  "catalog_slug": "employment-action",
  "filter_conditions": [
    {
      "catalogColumn": "employment_type",
      "parentField": "employment_type",
      "operator": "equals"
    }
  ],
  "display_columns": ["label", "category"]
}
```

**Fields:**
- `catalog_slug` (string, required): Which catalog to use
- `filter_conditions` (array, optional): Conditions to filter items
  - `catalogColumn` (string): Column in catalog item data to match
  - `parentField` (string): Field in parent record to match against
  - `operator` (string): Comparison operator (MVP: "equals" only)
- `display_columns` (array, optional): Which columns to show in dropdown
  - Default: `["label", "value"]`
  - `label` always included (display column)

---

## Frontend: Visual Builder

### Field Editor Flow

**Step 1: Select Catalog**
- Dropdown: "Catalog: [employment-action ▼]"
- Triggers: fetch that catalog's column schema

**Step 2: Configure Filters** (optional)
```
Filter items from this catalog (optional):
☐ No filters
  [Where] [category ▼] [equals] [parent field: employment_type ▼]
  [+ Add another filter]
```

- UI components:
  - "Where [column]" dropdown → populated from selected catalog's columns
  - "equals" operator dropdown (MVP: only "equals")
  - "[parent field]" dropdown → populated from parent collection's fields
- Button: "+ Add another condition" (AND logic between conditions)
- Checkbox: "No filters" (show all items, overrides conditions)

**Step 3: Configure Display Columns**
```
Show in dropdown:
☑ label (always included)
☑ value
☑ category
☐ requires_approval
```

- Multi-select from catalog's columns
- `label` always checked (cannot uncheck)
- Shows column name + description (if available)

---

## Runtime Behavior

### Rendering Dropdowns

**When rendering a form with a select field:**

1. **Fetch items** → `GET /api/catalogs/{catalog_slug}/items`
   - Returns: all items with label, value, data

2. **Apply filter conditions** (client-side evaluation)
   ```typescript
   const parentRecord = { employment_type: "full-time", ... };
   const field = {
     catalog_slug: "employment-action",
     filter_conditions: [
       { catalogColumn: "employment_type", parentField: "employment_type" }
     ]
   };
   
   const filtered = items.filter(item => {
     for (const cond of field.filter_conditions) {
       const catalogValue = item.data[cond.catalogColumn] ?? item[cond.catalogColumn];
       const parentValue = parentRecord[cond.parentField];
       if (catalogValue !== parentValue) return false;
     }
     return true;
   });
   ```

3. **Render dropdown** (display only selected columns)
   ```
   For each filtered item:
   - Label: "{label} ({category})"  [value: "{value}"]
   - Store: just the value when selected
   ```

### Filter Logic Details

**Column lookup order:**
1. Check `item.data[columnKey]` (extra fields)
2. Fall back to `item[columnKey]` (hardcoded columns: label, value)

**No matching items:**
- Show empty dropdown with message: "No matching options"
- User can still type/search if dropdown allows

**Missing parent field:**
- Log warning (dev console)
- Show all items (graceful fallback)

**Empty filter_conditions array:**
- Show all items

---

## Storage & Display Separation

**Critical design principle:**

- **Store:** Parent record saves only the `value` reference
  ```json
  { "action": "hire" }  // just the value
  ```

- **Display:** Multiple columns shown in dropdown UI, but only value stored
  ```
  Dropdown shows: "Hire (Category: New Hire)"
  Stores: { action: "hire" }
  ```

- **Immutability:** Catalog item data is never modified when used in parent records

---

## Backwards Compatibility

**Existing catalogs (no changes needed):**
- `columns` is NULL → use default `[{key: "label"}, {key: "value"}]`
- `data` column is `{}` → all data in hardcoded columns
- Existing field options without `filter_conditions`/`display_columns` work as-is

**Existing fields (no breaking changes):**
- Old options: `{ "catalog_slug": "gender" }`
- Works exactly as before (all items shown, default display)
- Admin can gradually add filters/display config

**Migration strategy:**
1. Add `columns` and `data` columns to tables (nullable, with defaults)
2. No data migration required (defaults handle it)
3. Admins upgrade catalogs at their own pace (add extra columns when needed)

---

## API Endpoints

### GET /api/catalogs/{slug}/items

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "value": "hire",
      "label": "Hire",
      "sort_order": 1,
      "is_active": true,
      "data": {
        "category": "New Hire",
        "requires_approval": false
      }
    }
  ]
}
```

### POST /api/catalogs/{slug}/items (Create)

**Request:**
```json
{
  "label": "Hire",
  "value": "hire",
  "data": {
    "category": "New Hire",
    "requires_approval": false
  }
}
```

### PUT /api/catalogs/{slug}/items/{id} (Update)

**Request:** Same as POST

---

## Testing Checklist

1. **Schema validation:**
   - Create catalog with custom columns (category, requires_approval)
   - Create items with matching data structure
   - Verify data persists and retrieves correctly

2. **Filter conditions:**
   - Field with filter_conditions shows only matching items
   - Multiple conditions (AND logic) work correctly
   - Missing parent field → shows all items (fallback)
   - Empty filter_conditions → shows all items

3. **Display columns:**
   - Dropdown renders only selected columns
   - `label` always appears (cannot hide)
   - Dropdown stores only `value` (not full item data)

4. **Backwards compatibility:**
   - Old catalog without `columns` defined uses defaults
   - Old field without `filter_conditions`/`display_columns` works as-is
   - Existing items still display/filter correctly

5. **Admin UI:**
   - Visual builder loads correct columns for selected catalog
   - Parent field dropdown populates from parent collection
   - Filter conditions evaluate correctly
   - Display columns multi-select updates field config

---

## Implementation Notes

- **Column validation:** Validate item data against catalog schema before save
- **Client-side filtering:** Simpler than server-side; all items fetched and filtered on client
- **Future optimization:** Could move filtering to server-side if performance needs it
- **JSONB indexing:** Existing GIN index on `content_catalog_items.data` covers queries

---

## Files to Modify

### Database
- `supabase/migrations/XXXX_multi_column_catalogs.sql` — add columns and defaults

### API
- `src/app/api/catalogs/[slug]/items/route.ts` — return data JSONB
- `src/app/api/collections/[slug]/route.ts` — field options validation

### Frontend
- `src/components/item-form-dialog.tsx` — filter items, display multiple columns
- `src/components/field-editor.tsx` or similar — visual builder for filter/display config
- Update select/multiselect rendering logic

### Types
- `src/types/database.ts` — regenerate with new columns
- Add TypeScript interfaces for catalog schema and filter conditions

---

**Next Step:** Write implementation plan with detailed task breakdown.
