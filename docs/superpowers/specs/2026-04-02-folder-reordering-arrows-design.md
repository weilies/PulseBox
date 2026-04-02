# Design Spec: Navigation Folder Move Up/Down Arrows

**Date:** 2026-04-02  
**Feature:** Add move up/down arrow buttons to reorder folders in the Navigation management page  
**Status:** Approved for implementation

---

## Overview

Add up/down chevron buttons inline with existing folder actions (rename/delete) in the Navigation page. Users can reorder folders by clicking arrows. Buttons are conditionally shown/hidden based on sibling position: topmost folder hides up arrow, bottommost hides down arrow. Reordering is non-blocking using `useTransition`.

---

## Requirements

1. **Show arrows on all folders** — both top-level and nested (recursive)
2. **Non-blocking transitions** — use `useTransition` pattern (already in place)
3. **Boundary logic** — no up arrow if folder is topmost sibling; no down arrow if bottommost
4. **Scope isolation** — child folders cannot move out of their parent (scoped to siblings only)
5. **Preserve existing drag** — keep HTML5 drag-to-reorder functionality intact
6. **Consistent UI** — match existing hover-group pattern for rename/delete buttons

---

## Architecture

### Data & Calculations

**Sibling position:**
- For each folder during render, calculate its position in the sibling array (all folders with same `parent_id`)
- Siblings ordered by `sort_order` ASC
- `isFirstSibling = currentIndex === 0`
- `isLastSibling = currentIndex === siblings.length - 1`

**Move operation:**
- Move up: swap current folder's `sort_order` with sibling at `index - 1`
- Move down: swap current folder's `sort_order` with sibling at `index + 1`
- Scope: folders only reorder within their parent (parent_id unchanged)

### Component: `src/components/nav-manager.tsx`

**Changes to `renderFolder` function (lines ~268–369):**

1. **Add helper functions** (near top of component):
   ```tsx
   const getFolderSiblings = (parentId: string | null) => {
     return (foldersByParent[parentId] || []).sort((a, b) => a.sort_order - b.sort_order);
   };
   
   const getFolderPosition = (folderId: string, parentId: string | null) => {
     const siblings = getFolderSiblings(parentId);
     return siblings.findIndex(f => f.id === folderId);
   };
   ```

2. **In hover group (lines ~309–328)**, after delete button, add:
   ```tsx
   {/* Move up button */}
   {!isFirstSibling && (
     <button
       onClick={() => handleMoveFolder(folder.id, folder.parent_id, 'up')}
       disabled={isPending}
       className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
       title="Move folder up"
     >
       <ChevronUp className="h-4 w-4" />
     </button>
   )}
   
   {/* Move down button */}
   {!isLastSibling && (
     <button
       onClick={() => handleMoveFolder(folder.id, folder.parent_id, 'down')}
       disabled={isPending}
       className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
       title="Move folder down"
     >
       <ChevronDown className="h-4 w-4" />
     </button>
   )}
   ```

3. **Calculate flags before rendering hover group:**
   ```tsx
   const currentIndex = getFolderPosition(folder.id, folder.parent_id);
   const siblings = getFolderSiblings(folder.parent_id);
   const isFirstSibling = currentIndex === 0;
   const isLastSibling = currentIndex === siblings.length - 1;
   ```

4. **Add `handleMoveFolder` handler** (near useTransition, line ~105):
   ```tsx
   const handleMoveFolder = async (folderId: string, parentId: string | null, direction: 'up' | 'down') => {
     startTransition(async () => {
       const siblings = getFolderSiblings(parentId);
       const currentIndex = siblings.findIndex(f => f.id === folderId);
       
       let targetIndex: number;
       if (direction === 'up' && currentIndex > 0) {
         targetIndex = currentIndex - 1;
       } else if (direction === 'down' && currentIndex < siblings.length - 1) {
         targetIndex = currentIndex + 1;
       } else {
         return; // out of bounds, do nothing
       }
       
       const targetSortOrder = siblings[targetIndex].sort_order;
       await moveNavFolderAction(folderId, parentId, targetSortOrder);
     });
   };
   ```

5. **Import icons** at top:
   - Add `ChevronUp, ChevronDown` to existing lucide-react import

### Server Action: `src/app/actions/nav.ts`

**No changes required.** The existing `moveNavFolderAction(folderId, newParentId, newSortOrder)` already handles:
- Database update via `moveNavFolder` service
- Path revalidation
- Parent scope enforcement (via nav.service.ts logic)

---

## Visual Design

### Button Styling
- **Icon:** `<ChevronUp>` / `<ChevronDown>` (lucide-react, 4px size)
- **Container:** `h-8 w-8` button, centered
- **Colors:** 
  - Normal: `text-gray-400`
  - Hover: `text-gray-600`
  - Disabled: `opacity-50`
- **Transition:** `transition-colors` for smooth hover
- **Placement:** Inline in hover group, after delete button
- **Tooltips:** "Move folder up" / "Move folder down"

### Visibility
- Up arrow visible only if `!isFirstSibling`
- Down arrow visible only if `!isLastSibling`
- Both hidden via conditional render (`{condition && (...)}`), not via CSS
- Buttons disabled during `isPending` (non-blocking transition in progress)

### Interaction
- Click triggers immediate `handleMoveFolder` call
- `useTransition` wraps server action, disables buttons until complete
- No visual reorder animation (data refetch handles persistence)
- Router refresh triggers after server action completes (via middleware)

---

## Data Flow

```
User clicks up/down button
  ↓
handleMoveFolder(folderId, parentId, direction)
  ↓
Calculate target sibling and its sort_order
  ↓
Call moveNavFolderAction(folderId, parentId, targetSortOrder) [server action]
  ↓
Server: Update DB, swap sort_order values, revalidate path
  ↓
Client: Transition completes, router refreshes, folders re-fetch and re-render
  ↓
UI updates with new order
```

---

## Scope Boundaries

- **Folders only:** Arrows only on folders, not nav items
- **Sibling scope:** Folders reorder within same parent only
- **Parent immutable:** `parent_id` never changes during up/down move
- **Recursive:** Logic applies to all nesting levels identically
- **Read-only users:** If user lacks write permission, buttons stay hidden (handled by existing `canEdit` check in renderFolder)

---

## Testing Checklist

1. **Top-level folders:** Up arrow hidden on first folder, down arrow hidden on last
2. **Nested folders:** Arrows respect position within their parent
3. **Moving:** Click up/down → order changes in DB → UI reflects new order
4. **Reload:** New order persists after page refresh
5. **Boundaries:** Can't move folder past siblings (both directions)
6. **Non-blocking:** UI responsive during move, buttons disabled until complete
7. **Drag preserved:** HTML5 drag-to-reorder still works alongside arrow moves
8. **Permissions:** Read-only users see no buttons

---

## Implementation Notes

- Reuse existing `moveNavFolderAction` — no new server actions needed
- Sort order swap logic is simple and idempotent
- Helper functions (`getFolderSiblings`, `getFolderPosition`) memoizable if performance needed later
- Consistent with existing nav-manager patterns (useTransition, hover group, button styling)

---

## Files Modified

- `src/components/nav-manager.tsx` — add buttons, handlers, and helpers

## Files Unchanged

- `src/app/actions/nav.ts` — existing `moveNavFolderAction` sufficient
- `src/lib/services/nav.service.ts` — existing `moveNavFolder` sufficient

---

**Approved by:** User  
**Next Step:** Implementation (via writing-plans skill)
