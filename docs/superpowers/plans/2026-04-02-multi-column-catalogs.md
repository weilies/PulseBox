# Multi-Column Content Catalogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable catalog items to store and display multiple custom columns, with context-aware filtering based on parent record field values, while maintaining full backwards compatibility.

**Architecture:** Catalogs define a schema (columns) in JSONB metadata. Items store extra fields in a `data` JSONB column alongside hardcoded label/value. Fields configure filter conditions and display columns via `options.filter_conditions` and `options.display_columns`. Client-side filtering evaluates conditions at render time. Storage remains pure (only value stored in parent records), display is separate.

**Tech Stack:** Next.js 15 + TypeScript, Supabase Postgres, JSONB for flexible schemas, React hooks (useState, useCallback) for UI state.

---

## File Structure Overview

```
supabase/migrations/
  ├── XXXX_multi_column_catalogs.sql [new]     # Add columns and defaults

src/types/
  ├── database.ts [regenerated]                # Auto-generated Supabase types
  ├── catalog.ts [new]                         # CatalogColumn, FilterCondition, etc.

src/app/api/catalogs/
  ├── [slug]/items/route.ts [modify]           # GET/POST/PUT return data JSONB

src/app/actions/
  ├── catalogs.ts [new]                        # Server actions for catalog ops

src/components/
  ├── catalog-item-editor.tsx [new]            # Multi-column form for items
  ├── field-filter-builder.tsx [new]           # Visual filter condition editor
  ├── field-display-selector.tsx [new]         # Multi-select for display columns
  ├── item-form-dialog.tsx [modify]            # Apply filters, render columns

src/lib/
  ├── catalog-filtering.ts [new]               # Client-side filter logic
```

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260402_multi_column_catalogs.sql`

- [ ] **Step 1: Create migration file**

```bash
# Check latest migration number
ls supabase/migrations/ | tail -5
# Find the highest XXXX, add 1
```

- [ ] **Step 2: Write migration SQL**

```sql
-- supabase/migrations/20260402_multi_column_catalogs.sql

-- Add columns JSONB to content_catalogs
ALTER TABLE public.content_catalogs ADD COLUMN columns JSONB DEFAULT NULL;

-- Add data JSONB to content_catalog_items  
ALTER TABLE public.content_catalog_items ADD COLUMN data JSONB DEFAULT '{}';

-- Add comment explaining columns field
COMMENT ON COLUMN public.content_catalogs.columns IS 
  'Schema definition: array of column definitions with key, type, required, unique, description';

-- Add comment explaining data field
COMMENT ON COLUMN public.content_catalog_items.data IS
  'Extra fields beyond label/value, keyed by column key from catalog schema';

-- Create GIN index on data JSONB for performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_catalog_items_data ON public.content_catalog_items USING GIN(data);
```

- [ ] **Step 3: Apply migration to cloud**

```bash
npx supabase db push --linked
```

Expected output: "Applying migration..." → success message

---

## Task 2: TypeScript Types for Catalog Schema

**Files:**
- Create: `src/types/catalog.ts`

- [ ] **Step 1: Create catalog types file**

```typescript
// src/types/catalog.ts

/**
 * Column definition in a catalog's schema.
 * Defines what data each catalog item can store.
 */
export interface CatalogColumnDefinition {
  key: string;          // e.g., "category", "requires_approval"
  type: "text" | "number" | "boolean" | "date" | "datetime";
  required?: boolean;
  unique?: boolean;
  description?: string;
}

/**
 * Schema metadata for a catalog.
 * Stored in content_catalogs.columns JSONB.
 */
export interface CatalogSchema {
  columns: CatalogColumnDefinition[];
}

/**
 * Filter condition linking a catalog column to a parent record field.
 * Multiple conditions use AND logic.
 */
export interface CatalogFilterCondition {
  catalogColumn: string;     // e.g., "employment_type"
  parentField: string;       // e.g., "employment_type"
  operator: "equals";        // MVP: only equals
}

/**
 * Options for a select/multiselect field using a catalog.
 * Stored in collection_fields.options JSONB.
 */
export interface CatalogFieldOptions {
  catalog_slug: string;
  filter_conditions?: CatalogFilterCondition[];
  display_columns?: string[];  // Default: ["label", "value"]
}

/**
 * Catalog item with data columns (client-side representation).
 */
export interface CatalogItem {
  id: string;
  catalog_id: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  data?: Record<string, unknown>;  // Extra fields from schema
}

/**
 * Catalog with schema (client-side representation).
 */
export interface Catalog {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  columns: CatalogSchema | null;  // null = use default [label, value]
}
```

- [ ] **Step 2: Verify file created**

```bash
ls -la src/types/catalog.ts
```

Expected: file exists, ~80 lines

---

## Task 3: Regenerate Supabase Types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerate types from cloud schema**

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

Expected: database.ts updated with `columns` field on `Tables["content_catalogs"]` and `data` field on `Tables["content_catalog_items"]`

- [ ] **Step 2: Verify types include new fields**

```bash
grep -A 5 "columns\?" src/types/database.ts | head -10
grep -A 5 "data\?" src/types/database.ts | head -10
```

Expected: Both fields present with `| null` or similar

---

## Task 4: Client-Side Filtering Utility

**Files:**
- Create: `src/lib/catalog-filtering.ts`

- [ ] **Step 1: Create filtering module**

```typescript
// src/lib/catalog-filtering.ts

import { CatalogItem, CatalogFilterCondition } from "@/types/catalog";

/**
 * Filter catalog items based on parent record field values.
 * All conditions must match (AND logic).
 * 
 * @param items - All catalog items
 * @param parentRecord - Parent collection record (e.g., employment data)
 * @param conditions - Filter conditions to apply
 * @returns Filtered items matching all conditions
 */
export function filterCatalogItems(
  items: CatalogItem[],
  parentRecord: Record<string, unknown>,
  conditions: CatalogFilterCondition[]
): CatalogItem[] {
  if (!conditions || conditions.length === 0) {
    return items;
  }

  return items.filter((item) => {
    // All conditions must match
    for (const condition of conditions) {
      // Get value from item data or hardcoded columns
      const catalogValue = item.data?.[condition.catalogColumn] ?? item[condition.catalogColumn as keyof CatalogItem];
      const parentValue = parentRecord[condition.parentField];

      // For equals operator, values must match exactly
      if (catalogValue !== parentValue) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Format a catalog item for display with selected columns.
 * 
 * @param item - Catalog item to display
 * @param displayColumns - Which columns to show (e.g., ["label", "category"])
 * @returns Formatted string like "Hire (New Hire)"
 */
export function formatItemDisplay(
  item: CatalogItem,
  displayColumns: string[] = ["label", "value"]
): string {
  if (displayColumns.length === 0 || !displayColumns.includes("label")) {
    displayColumns = ["label"];
  }

  const parts: string[] = [];

  // Label is always shown first as the main text
  const label = item.label;
  parts.push(label);

  // Other selected columns shown in parentheses
  const otherCols = displayColumns.filter((col) => col !== "label");
  if (otherCols.length > 0) {
    const extras = otherCols
      .map((col) => {
        const val = item.data?.[col] ?? item[col as keyof CatalogItem];
        return val ? `${col}: ${val}` : null;
      })
      .filter(Boolean);

    if (extras.length > 0) {
      parts.push(`(${extras.join(", ")})`);
    }
  }

  return parts.join(" ");
}
```

- [ ] **Step 2: Verify file created**

```bash
wc -l src/lib/catalog-filtering.ts
```

Expected: ~70 lines

---

## Task 5: Update Catalog Items API Endpoint

**Files:**
- Modify: `src/app/api/catalogs/[slug]/items/route.ts`

- [ ] **Step 1: Read current file**

```bash
head -50 src/app/api/catalogs/[slug]/items/route.ts
```

- [ ] **Step 2: Update GET endpoint to return data JSONB**

Replace the GET response with:

```typescript
// In src/app/api/catalogs/[slug]/items/route.ts

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const tenantId = await resolveTenant(userId);

  const { data: items, error } = await supabase
    .from("content_catalog_items")
    .select(
      `
      id,
      catalog_id,
      value,
      label,
      sort_order,
      is_active,
      data
    `
    )
    .eq("catalogs.slug", slug)
    .eq("catalogs.tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ items: items || [] });
}
```

- [ ] **Step 3: Update POST endpoint to accept data JSONB**

```typescript
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await req.json();
  const supabase = await createClient();
  const tenantId = await resolveTenant(userId);

  // Validate required fields
  if (!body.label || !body.value) {
    return NextResponse.json(
      { error: "label and value are required" },
      { status: 400 }
    );
  }

  const { data: item, error } = await supabase
    .from("content_catalog_items")
    .insert({
      catalog_id: (await supabase
        .from("content_catalogs")
        .select("id")
        .eq("slug", slug)
        .eq("tenant_id", tenantId)
        .single()).data?.id,
      label: body.label,
      value: body.value,
      data: body.data || {},  // Accept extra columns
      sort_order: body.sort_order || 1,
      is_active: body.is_active !== false,
    })
    .select(`id, catalog_id, value, label, sort_order, is_active, data`)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ item });
}
```

- [ ] **Step 4: Update PUT endpoint**

```typescript
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const body = await req.json();
  const supabase = await createClient();

  const { data: item, error } = await supabase
    .from("content_catalog_items")
    .update({
      label: body.label,
      value: body.value,
      data: body.data || {},  // Accept updates to extra columns
      sort_order: body.sort_order,
      is_active: body.is_active,
    })
    .eq("id", id)
    .select(`id, catalog_id, value, label, sort_order, is_active, data`)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ item });
}
```

- [ ] **Step 5: Commit API changes**

```bash
git add src/app/api/catalogs/[slug]/items/route.ts
git commit -m "feat: add data JSONB support to catalog items API endpoints"
```

---

## Task 6: Create Filter Condition Visual Builder Component

**Files:**
- Create: `src/components/field-filter-builder.tsx`

- [ ] **Step 1: Create component**

```typescript
// src/components/field-filter-builder.tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { CatalogColumnDefinition, CatalogFilterCondition } from "@/types/catalog";

interface FieldFilterBuilderProps {
  conditions: CatalogFilterCondition[];
  onConditionsChange: (conditions: CatalogFilterCondition[]) => void;
  catalogColumns: CatalogColumnDefinition[];
  parentFields: string[];
}

export function FieldFilterBuilder({
  conditions,
  onConditionsChange,
  catalogColumns,
  parentFields,
}: FieldFilterBuilderProps) {
  const [isEnabled, setIsEnabled] = useState(conditions.length > 0);

  const handleAddCondition = useCallback(() => {
    const newCondition: CatalogFilterCondition = {
      catalogColumn: catalogColumns[0]?.key || "",
      parentField: parentFields[0] || "",
      operator: "equals",
    };
    onConditionsChange([...conditions, newCondition]);
  }, [conditions, catalogColumns, parentFields, onConditionsChange]);

  const handleRemoveCondition = useCallback(
    (index: number) => {
      const updated = conditions.filter((_, i) => i !== index);
      onConditionsChange(updated);
      if (updated.length === 0) setIsEnabled(false);
    },
    [conditions, onConditionsChange]
  );

  const handleConditionChange = useCallback(
    (index: number, field: keyof CatalogFilterCondition, value: string) => {
      const updated = [...conditions];
      updated[index] = { ...updated[index], [field]: value };
      onConditionsChange(updated);
    },
    [conditions, onConditionsChange]
  );

  const handleToggleEnabled = useCallback(
    (enabled: boolean) => {
      setIsEnabled(enabled);
      if (!enabled) {
        onConditionsChange([]);
      }
    },
    [onConditionsChange]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => handleToggleEnabled(e.target.checked)}
          className="h-4 w-4"
        />
        <label className="text-sm font-medium text-gray-300">Filter items from this catalog</label>
      </div>

      {isEnabled && (
        <div className="space-y-3 ml-6 border-l border-gray-600 pl-4">
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Where</span>
              
              <Select value={condition.catalogColumn} onValueChange={(val) => handleConditionChange(index, "catalogColumn", val)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {catalogColumns.map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-xs text-gray-400">equals</span>

              <Select value={condition.parentField} onValueChange={(val) => handleConditionChange(index, "parentField", val)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Parent field..." />
                </SelectTrigger>
                <SelectContent>
                  {parentFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveCondition(index)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            size="sm"
            variant="outline"
            onClick={handleAddCondition}
            className="text-xs"
          >
            + Add another condition
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit component**

```bash
git add src/components/field-filter-builder.tsx
git commit -m "feat: add filter condition visual builder component"
```

---

## Task 7: Create Display Columns Selector Component

**Files:**
- Create: `src/components/field-display-selector.tsx`

- [ ] **Step 1: Create component**

```typescript
// src/components/field-display-selector.tsx
"use client";

import { useState, useCallback } from "react";
import { CatalogColumnDefinition } from "@/types/catalog";

interface FieldDisplaySelectorProps {
  displayColumns: string[];
  onDisplayColumnsChange: (columns: string[]) => void;
  catalogColumns: CatalogColumnDefinition[];
}

export function FieldDisplaySelector({
  displayColumns,
  onDisplayColumnsChange,
  catalogColumns,
}: FieldDisplaySelectorProps) {
  const handleToggleColumn = useCallback(
    (columnKey: string) => {
      if (columnKey === "label") {
        // label is always required, cannot uncheck
        return;
      }

      if (displayColumns.includes(columnKey)) {
        onDisplayColumnsChange(displayColumns.filter((col) => col !== columnKey));
      } else {
        onDisplayColumnsChange([...displayColumns, columnKey]);
      }
    },
    [displayColumns, onDisplayColumnsChange]
  );

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">Show in dropdown:</label>
      
      <div className="space-y-2 ml-4">
        {["label", "value", ...catalogColumns.map((col) => col.key)].map((columnKey) => {
          const isLabel = columnKey === "label";
          const columnDef = catalogColumns.find((col) => col.key === columnKey);
          const isChecked = displayColumns.includes(columnKey) || isLabel;

          return (
            <div key={columnKey} className="flex items-start gap-2">
              <input
                type="checkbox"
                id={`col-${columnKey}`}
                checked={isChecked}
                onChange={() => handleToggleColumn(columnKey)}
                disabled={isLabel}
                className="h-4 w-4 mt-1 disabled:opacity-50"
              />
              <label htmlFor={`col-${columnKey}`} className="text-sm text-gray-300">
                {columnKey}
                {isLabel && <span className="text-xs text-gray-500 ml-1">(always included)</span>}
                {columnDef?.description && (
                  <span className="text-xs text-gray-500 block">{columnDef.description}</span>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit component**

```bash
git add src/components/field-display-selector.tsx
git commit -m "feat: add display columns selector component"
```

---

## Task 8: Create Catalog Item Editor Component

**Files:**
- Create: `src/components/catalog-item-editor.tsx`

- [ ] **Step 1: Create component**

```typescript
// src/components/catalog-item-editor.tsx
"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { CatalogColumnDefinition } from "@/types/catalog";

interface CatalogItemEditorProps {
  columnSchema: CatalogColumnDefinition[];
  initialData?: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function CatalogItemEditor({
  columnSchema,
  initialData = {},
  onChange,
}: CatalogItemEditorProps) {
  const [data, setData] = useState<Record<string, unknown>>(initialData);

  const handleFieldChange = useCallback(
    (key: string, value: unknown) => {
      const updated = { ...data, [key]: value };
      setData(updated);
      onChange(updated);
    },
    [data, onChange]
  );

  return (
    <div className="space-y-4">
      {columnSchema.map((column) => (
        <div key={column.key} className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            {column.key}
            {column.required && <span className="text-red-500 ml-1">*</span>}
            {column.description && (
              <span className="text-xs text-gray-500 block">{column.description}</span>
            )}
          </label>

          {column.type === "boolean" ? (
            <input
              type="checkbox"
              checked={(data[column.key] as boolean) || false}
              onChange={(e) => handleFieldChange(column.key, e.target.checked)}
              className="h-4 w-4"
            />
          ) : column.type === "number" ? (
            <Input
              type="number"
              value={(data[column.key] as number) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value ? Number(e.target.value) : null)}
              placeholder={`Enter ${column.type}`}
            />
          ) : column.type === "date" ? (
            <Input
              type="date"
              value={(data[column.key] as string) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value || null)}
            />
          ) : column.type === "datetime" ? (
            <Input
              type="datetime-local"
              value={(data[column.key] as string) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value || null)}
            />
          ) : (
            <Input
              type="text"
              value={(data[column.key] as string) || ""}
              onChange={(e) => handleFieldChange(column.key, e.target.value || null)}
              placeholder={`Enter ${column.type}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit component**

```bash
git add src/components/catalog-item-editor.tsx
git commit -m "feat: add multi-column catalog item editor"
```

---

## Task 9: Integrate Filtering into Item Form Dialog

**Files:**
- Modify: `src/components/item-form-dialog.tsx`

- [ ] **Step 1: Read current file to understand structure**

```bash
head -100 src/components/item-form-dialog.tsx
```

- [ ] **Step 2: Add filtering and column display logic**

Update the component to:

```typescript
// Add these imports
import { filterCatalogItems, formatItemDisplay } from "@/lib/catalog-filtering";
import { CatalogItem, CatalogFieldOptions, CatalogSchema } from "@/types/catalog";

// In the component rendering the dropdown:
export function ItemFormDialog({
  items,
  catalogSchema,
  fieldOptions,
  parentRecord,
  // ... other props
}: {
  items: CatalogItem[];
  catalogSchema: CatalogSchema | null;
  fieldOptions: CatalogFieldOptions;
  parentRecord: Record<string, unknown>;
  // ... other props
}) {
  // Apply filter conditions if present
  let displayItems = items;
  if (fieldOptions.filter_conditions && fieldOptions.filter_conditions.length > 0) {
    displayItems = filterCatalogItems(
      items,
      parentRecord,
      fieldOptions.filter_conditions
    );
  }

  // Determine which columns to display
  const displayColumns = fieldOptions.display_columns || ["label", "value"];

  // Render dropdown with formatted items
  return (
    <select>
      {displayItems.length === 0 ? (
        <option disabled>No matching options</option>
      ) : (
        displayItems.map((item) => (
          <option key={item.id} value={item.value}>
            {formatItemDisplay(item, displayColumns)}
          </option>
        ))
      )}
    </select>
  );
}
```

- [ ] **Step 3: Commit changes**

```bash
git add src/components/item-form-dialog.tsx
git commit -m "feat: integrate filtering and multi-column display in item form"
```

---

## Task 10: Backwards Compatibility Test

**Files:**
- No new files, verify existing behavior

- [ ] **Step 1: Test old catalog without columns defined**

Via Supabase dashboard:
1. Select any existing catalog (e.g., "gender") where `columns` is NULL
2. Expected: Renders normally with label, value only

```sql
-- Check schema of old catalog
SELECT id, slug, columns FROM content_catalogs WHERE slug = 'gender';
-- Expected: columns = NULL
```

- [ ] **Step 2: Test old field options without filter_conditions**

Via Supabase dashboard:
1. Select a field using old-style options (no filter_conditions)
2. Expected: Shows all items, no filtering applied

```sql
SELECT id, options FROM collection_fields WHERE options->>'catalog_slug' = 'gender';
-- Expected: options has no filter_conditions key
```

- [ ] **Step 3: Add default schema to old catalog (optional test)**

In admin UI, open catalog editor:
1. New catalog without custom columns defined
2. Expected: Auto-defaults to [label, value] schema
3. Verify items still display correctly

- [ ] **Step 4: Commit passing backwards compatibility test**

```bash
git add -A
git commit -m "test: verify backwards compatibility with NULL columns and missing filter_conditions"
```

---

## Task 11: Integration Test - Multi-Column Catalog with Filtering

**Files:**
- Manual testing flow (no code changes)

- [ ] **Step 1: Create test catalog with custom columns**

Via Supabase dashboard or admin API:

```sql
INSERT INTO public.content_catalogs (slug, name, description, tenant_id, columns)
VALUES (
  'employment-action',
  'Employment Actions',
  'Hiring, termination, and movement actions',
  'test-tenant-id',
  '{
    "columns": [
      {"key": "label", "type": "text", "required": true},
      {"key": "value", "type": "text", "required": true},
      {"key": "category", "type": "text", "description": "Action category"},
      {"key": "requires_approval", "type": "boolean", "description": "Needs manager approval"}
    ]
  }'::jsonb
);
```

- [ ] **Step 2: Create items with extra columns**

```bash
# POST /api/catalogs/employment-action/items
# Body:
{
  "label": "Hire",
  "value": "hire",
  "data": {
    "category": "New Hire",
    "requires_approval": false
  }
}
```

Expected response includes data field

- [ ] **Step 3: Create field with filter conditions**

Via collection schema editor or API:

```json
{
  "catalog_slug": "employment-action",
  "filter_conditions": [
    {
      "catalogColumn": "category",
      "parentField": "employment_type",
      "operator": "equals"
    }
  ],
  "display_columns": ["label", "category"]
}
```

- [ ] **Step 4: Test filtering in form**

Open parent record form with the field:
1. Set parent field "employment_type" = "New Hire"
2. Expected: Dropdown shows only items where category = "New Hire"
3. Expected: Dropdown shows "Hire (category: New Hire)" format

- [ ] **Step 5: Test no matches fallback**

1. Set parent field "employment_type" = "Unknown"
2. Expected: Dropdown shows "No matching options"
3. Console warning logged (dev tools)

- [ ] **Step 6: Test display columns configuration**

1. Change field display_columns to ["label", "value", "requires_approval"]
2. Expected: Dropdown shows all three columns
3. Expected: "Hire (value: hire, requires_approval: false)" format

- [ ] **Step 7: Commit passing integration test**

```bash
# No files to commit, but document test results
git log --oneline | head -5
# Should show recent commits from Tasks 1-10
```

---

## Task 12: Admin UI - Field Editor Integration

**Files:**
- Modify: `src/app/dashboard/studio/collections/[slug]/fields/[fieldId]/edit/page.tsx` (or similar field editor)

- [ ] **Step 1: Locate field editor page**

```bash
find src/app -name "*field*edit*" -o -name "*field-editor*"
```

- [ ] **Step 2: Import new components**

```typescript
import { FieldFilterBuilder } from "@/components/field-filter-builder";
import { FieldDisplaySelector } from "@/components/field-display-selector";
import { CatalogFieldOptions } from "@/types/catalog";
```

- [ ] **Step 3: Add UI section for catalog options**

After "Select Catalog" section, add:

```typescript
{fieldType === "select" && catalogSlug && (
  <>
    <div className="space-y-6 mt-6 pt-6 border-t border-gray-600">
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Catalog Configuration</h3>
        
        {/* Filter Conditions Builder */}
        <div className="mb-6">
          <FieldFilterBuilder
            conditions={fieldOptions.filter_conditions || []}
            onConditionsChange={(conditions) => {
              setFieldOptions({
                ...fieldOptions,
                filter_conditions: conditions,
              });
            }}
            catalogColumns={selectedCatalogSchema?.columns || []}
            parentFields={parentCollectionFields}
          />
        </div>

        {/* Display Columns Selector */}
        <FieldDisplaySelector
          displayColumns={fieldOptions.display_columns || ["label", "value"]}
          onDisplayColumnsChange={(columns) => {
            setFieldOptions({
              ...fieldOptions,
              display_columns: columns,
            });
          }}
          catalogColumns={selectedCatalogSchema?.columns || []}
        />
      </div>
    </div>
  </>
)}
```

- [ ] **Step 4: Fetch catalog schema when catalog selected**

```typescript
useEffect(() => {
  if (!catalogSlug) return;
  
  fetch(`/api/catalogs/${catalogSlug}`)
    .then((res) => res.json())
    .then((data) => {
      setSelectedCatalogSchema(data.catalog.columns || { columns: [{ key: "label" }, { key: "value" }] });
    });
}, [catalogSlug]);
```

- [ ] **Step 5: Commit field editor integration**

```bash
git add src/app/dashboard/studio/collections/[slug]/fields/[fieldId]/edit/page.tsx
git commit -m "feat: add filter and display column config to field editor UI"
```

---

## Task 13: Admin UI - Catalog Item Manager

**Files:**
- Modify: `src/app/dashboard/studio/content-catalog/[slug]/page.tsx` (or similar catalog item view)

- [ ] **Step 1: Locate catalog item management page**

```bash
find src/app -path "*/content-catalog/*" -name "page.tsx"
```

- [ ] **Step 2: Import catalog item editor**

```typescript
import { CatalogItemEditor } from "@/components/catalog-item-editor";
```

- [ ] **Step 3: Update item creation/edit dialog**

In the dialog for creating/editing items:

```typescript
{/* Existing label and value fields */}
<Input
  label="Label"
  value={itemLabel}
  onChange={(e) => setItemLabel(e.target.value)}
/>

<Input
  label="Value"
  value={itemValue}
  onChange={(e) => setItemValue(e.target.value)}
/>

{/* New: Multi-column editor */}
{catalogSchema?.columns && catalogSchema.columns.length > 2 && (
  <CatalogItemEditor
    columnSchema={catalogSchema.columns.filter(
      (col) => col.key !== "label" && col.key !== "value"
    )}
    initialData={itemData}
    onChange={(data) => setItemData(data)}
  />
)}
```

- [ ] **Step 4: Update save handler**

When saving item, include data:

```typescript
const saveItem = async () => {
  const payload = {
    label: itemLabel,
    value: itemValue,
    data: itemData,
  };

  const response = await fetch(`/api/catalogs/${catalogSlug}/items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  // ... handle response
};
```

- [ ] **Step 5: Commit catalog item manager updates**

```bash
git add src/app/dashboard/studio/content-catalog/[slug]/page.tsx
git commit -m "feat: add multi-column editor to catalog item management UI"
```

---

## Task 14: Final Validation & Demo

**Files:**
- No files modified, manual validation

- [ ] **Step 1: Build and test locally**

```bash
npm run build
```

Expected: No TypeScript errors

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

Expected: http://localhost:3000 loads without errors

- [ ] **Step 3: Test full flow**

1. **Create catalog with columns:**
   - Go to /dashboard/studio/content-catalog
   - Create catalog "country-data"
   - Add columns: currency_code, iso_2_char, phone_prefix

2. **Add items with data:**
   - Go to content-catalog/country-data
   - Add item: label="United States", value="us", data={currency_code: "USD", iso_2_char: "US", phone_prefix: "+1"}
   - Add item: label="Canada", value="ca", data={currency_code: "CAD", iso_2_char: "CA", phone_prefix: "+1"}

3. **Create field with filter:**
   - Go to /dashboard/studio/collections/{collection}/fields
   - Create select field "country"
   - Select catalog: country-data
   - Add filter condition: catalogColumn="iso_2_char" → parentField="country_region"
   - Display columns: label, currency_code

4. **Test filtering in parent record:**
   - Create/edit record
   - Set country_region = "US"
   - Open "country" dropdown
   - Expected: Shows only "United States (currency_code: USD)"

- [ ] **Step 4: Verify backwards compatibility**

1. Open old catalog without columns (e.g., "gender")
2. Expected: Works normally, shows label/value only
3. Open field using old-style options
4. Expected: No filtering, all items shown

- [ ] **Step 5: Final commit**

```bash
git log --oneline | head -15
# Review all commits, ensure complete feature
```

- [ ] **Step 6: Push to GitHub**

```bash
bash scripts/safe-sync-github.sh
```

Expected: Pushes all commits successfully

---

## Spec Coverage Checklist

✅ Multi-column support — Tasks 1, 5, 8: columns JSONB in schema, data JSONB in items, editor UI
✅ Context-aware filtering — Task 4, 9, 12: filter conditions stored, client-side logic, field editor config
✅ Per-field display configuration — Task 7, 9, 12: display_columns option, dropdown rendering with selected columns
✅ Backwards compatible — Task 1, 10: nullable columns/data fields, defaults handle old data
✅ Visual builder UI — Tasks 6, 7, 12: filter builder, display selector, field editor integration
✅ Graceful fallbacks — Task 4, 9: missing parent field → all items, no matches → "No matching options"
✅ API endpoints updated — Task 5: GET/POST/PUT return data JSONB
✅ Types defined — Task 3: CatalogSchema, FilterCondition, FieldOptions interfaces
✅ Testing — Task 10, 11, 14: backwards compatibility, integration, validation

---

Plan complete and saved to `docs/superpowers/plans/2026-04-02-multi-column-catalogs.md`.

## Next Steps

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for complex features requiring architectural decisions mid-implementation.

**2. Inline Execution** — Execute tasks sequentially in this session using executing-plans skill, with checkpoints for review.

**Which approach would you prefer?**