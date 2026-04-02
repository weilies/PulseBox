# Navigation Folder Move Arrows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add up/down chevron buttons to reorder navigation folders inline with existing rename/delete actions, with boundary-aware visibility and non-blocking transitions.

**Architecture:** Add three elements to `nav-manager.tsx` within the existing `renderFolder` function: (1) helper functions to determine sibling position, (2) a move handler that swaps sort_order values via existing server action, (3) conditional render of up/down buttons in the hover group.

**Tech Stack:** React (useTransition), lucide-react icons, existing moveNavFolderAction server action

---

### Task 1: Add helper functions to nav-manager.tsx

**Files:**
- Modify: `src/components/nav-manager.tsx` (top of component, before renderFolder definition)

- [ ] **Step 1: Read current file to find insertion point**

Location: After `const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());` (around line 107) and before the first function definition.

- [ ] **Step 2: Add getFolderSiblings helper function**

Insert after line 107 (after state declarations, before renderFolder):

```typescript
const getFolderSiblings = (parentId: string | null) => {
  const siblings = folders.filter(f => f.parent_id === parentId);
  return siblings.sort((a, b) => a.sort_order - b.sort_order);
};
```

- [ ] **Step 3: Add getFolderPosition helper function**

Insert immediately after getFolderSiblings:

```typescript
const getFolderPosition = (folderId: string, parentId: string | null) => {
  const siblings = getFolderSiblings(parentId);
  return siblings.findIndex(f => f.id === folderId);
};
```

- [ ] **Step 4: Verify insertion is syntactically correct**

Run: `npm run build` 
Expected: No TypeScript errors in nav-manager.tsx

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-manager.tsx
git commit -m "feat: add folder sibling position helpers for reordering"
```

---

### Task 2: Add handleMoveFolder event handler

**Files:**
- Modify: `src/components/nav-manager.tsx` (inside renderFolder function, near useTransition)

- [ ] **Step 1: Locate useTransition hook**

Find the line: `const { isPending, startTransition } = useTransition();` (should be around line 105). Add the handler immediately after this line.

- [ ] **Step 2: Add handleMoveFolder handler**

Insert after the useTransition hook:

```typescript
const handleMoveFolder = async (
  folderId: string,
  parentId: string | null,
  direction: 'up' | 'down'
) => {
  startTransition(async () => {
    const siblings = getFolderSiblings(parentId);
    const currentIndex = getFolderPosition(folderId, parentId);

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

- [ ] **Step 3: Verify handler compiles**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/components/nav-manager.tsx
git commit -m "feat: add handleMoveFolder event handler for arrow clicks"
```

---

### Task 3: Add ChevronUp and ChevronDown imports

**Files:**
- Modify: `src/components/nav-manager.tsx` (lucide-react import at top)

- [ ] **Step 1: Locate lucide imports**

Find the line (should be around line 3-5):
```typescript
import { Pencil, Trash2, GripVertical, Plus } from "lucide-react";
```

- [ ] **Step 2: Add ChevronUp and ChevronDown to imports**

Replace with:
```typescript
import { Pencil, Trash2, GripVertical, Plus, ChevronUp, ChevronDown } from "lucide-react";
```

- [ ] **Step 3: Verify no duplicate imports**

Check that there's only one lucide-react import line. If there are multiple, consolidate into one.

- [ ] **Step 4: Verify compilation**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-manager.tsx
git commit -m "feat: import ChevronUp and ChevronDown icons from lucide-react"
```

---

### Task 4: Add move arrow buttons to hover group

**Files:**
- Modify: `src/components/nav-manager.tsx` (inside renderFolder, in the hover button group)

- [ ] **Step 1: Locate the hover button group**

Find the section in `renderFolder` (around lines 309–328) that renders the rename/delete buttons. It looks like:
```typescript
<div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 ...">
  {/* Rename button */}
  {/* Delete button */}
</div>
```

- [ ] **Step 2: Calculate position flags before the hover group render**

Add these lines immediately before the hover group div (before line 309):

```typescript
const currentIndex = getFolderPosition(folder.id, folder.parent_id);
const siblings = getFolderSiblings(folder.parent_id);
const isFirstSibling = currentIndex === 0;
const isLastSibling = currentIndex === siblings.length - 1;
```

- [ ] **Step 3: Add move up button**

Inside the hover group div, after the delete button, add:

```typescript
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
```

- [ ] **Step 4: Add move down button**

Immediately after the move up button, add:

```typescript
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

- [ ] **Step 5: Verify buttons render correctly**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/components/nav-manager.tsx
git commit -m "feat: add move up/down buttons to folder hover group with boundary logic"
```

---

### Task 5: Test move functionality locally

**Files:**
- Test: Navigate to /dashboard/studio/nav in browser

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: App runs at http://localhost:3000

- [ ] **Step 2: Navigate to Navigation page**

Open browser to `http://localhost:3000/dashboard/studio/nav` (or appropriate navigation URL)

- [ ] **Step 3: Test top-level folder reordering**

- Hover over the top folder in the list
- Verify up arrow is **not visible** (isFirstSibling = true)
- Verify down arrow **is visible** (isLastSibling = false)
- Click down arrow
- Verify folder moves down one position and DB updates
- Reload page and verify order persists

- [ ] **Step 4: Test middle folder reordering**

- Click on a middle folder's up or down arrow
- Verify it swaps position with adjacent sibling
- Both arrows should be visible

- [ ] **Step 5: Test bottom folder reordering**

- Hover over bottom folder
- Verify down arrow is **not visible** (isLastSibling = true)
- Verify up arrow **is visible** (isFirstSibling = false)
- Click up arrow
- Verify folder moves up one position

- [ ] **Step 6: Test nested folder reordering**

- Expand a parent folder with children
- Hover over a child folder
- Verify arrows respect child's position within siblings (not all children)
- Move a child up/down, verify it only reorders within its parent

- [ ] **Step 7: Test non-blocking transition**

- Click an arrow
- Immediately try to click another button
- Verify buttons are disabled during transition (opacity-50)
- Verify UI remains responsive

- [ ] **Step 8: Test drag still works**

- Click and drag a folder by its GripVertical handle
- Verify drag-to-reorder still works independently
- Verify both mechanisms can be used together

- [ ] **Step 9: Verify read-only users see no buttons**

- Switch to read-only user role (if applicable in your test setup)
- Verify up/down buttons are not present
- Verify drag handle may or may not be visible (depends on existing canEdit logic)

---

### Task 6: Final verification and commit

**Files:**
- Build and test: `src/components/nav-manager.tsx`

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No linting errors in nav-manager.tsx

- [ ] **Step 3: Check git status**

Run: `git status`
Expected: Only `src/components/nav-manager.tsx` is modified

- [ ] **Step 4: Review all changes**

Run: `git diff src/components/nav-manager.tsx`
Expected: 
- Import line updated with ChevronUp/ChevronDown
- Two helper functions added (getFolderSiblings, getFolderPosition)
- handleMoveFolder handler added
- Position flags calculated before hover group
- Two button renders added to hover group

- [ ] **Step 5: Final commit**

```bash
git add src/components/nav-manager.tsx
git commit -m "feat: complete folder move up/down arrow implementation

- Add getFolderSiblings and getFolderPosition helpers
- Add handleMoveFolder event handler with useTransition
- Add conditional up/down chevron buttons to hover group
- Buttons hidden at boundaries (first/last sibling)
- Uses existing moveNavFolderAction for DB updates
- Non-blocking transitions via useTransition"
```
