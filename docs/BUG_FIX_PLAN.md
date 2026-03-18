# Bug Fix Plan — 18 Mar 2026

> Source: `PulseBoard Bug Report.pdf` (attached in chat)
> Status tracking: see TASKS.md

---

## Bug Catalogue

| # | Path | Issue | Complexity | Status |
|---|------|-------|-----------|--------|
| 1a | Header avatar dropdown | Remove star from Current Tenant section | Easy | ✅ Done |
| 1b | Header avatar dropdown | Toast should say "Default tenant updated to 'X'" | Easy | ✅ Done |
| 1c | Header avatar dropdown | Default tenant star not filled (no refresh after setDefault) | Easy | ✅ Done |
| 1d | Header avatar dropdown | Allow avatar upload (rounded) | Medium | 🕐 Awaiting user decision |
| 2  | Language switcher | Full UI i18n (nav, widgets, forms — EN/JP/CN) | Complex | 🕐 Awaiting user decision |
| 3  | Policies page | Unable to edit policy (no edit action + no detail page) | Medium | ✅ Done |
| 4a | Collection items grid | Show filename instead of UUID in file field cells | Easy | ✅ Done |
| 4b | Collection items grid | Files not viewable/downloadable from grid | Easy | ✅ Done |
| 4c | User timezone | Add timezone to profile, render datetime in local TZ | Medium | 🕐 Awaiting user decision |
| 5  | Login page | Console TypeError: Failed to fetch (signInWithPassword) | Investigate | 🕐 Need env check |
| 6a | Tenant forms | Add Person In Charge (name + email) fields | Medium | ✅ Done |
| 6b | All forms | Compulsory fields must end with "*" | Easy | ✅ Done |
| 7  | Tenant deletion | Cascade delete users (single-tenant users only) | Medium | ✅ Done |

---

## Implementation Notes

### Bug 1a–1c (Header - Done)
- `src/components/header.tsx`
- Remove `<Star>` from Current Tenant section
- Pass tenant name to `handleSetDefault`, update toast message
- Add `router.refresh()` after successful setDefaultTenant

### Bug 1d (Avatar Upload — Pending)
Questions for user:
- Store in existing `collection-files` bucket or new `avatars` bucket?
- Should avatar also appear in Security > Users > Edit User?
- Should we use a Supabase Storage migration for the avatars bucket?

### Bug 2 (i18n — Pending)
Scope is very large. Options:
1. **Light approach**: Use a translation dictionary in `src/lib/translations.ts` with EN/JP/CN keys for all static strings, read locale from cookie in Server Components, pass to client
2. **Full approach**: Integrate `next-intl` library with message files
User needs to decide scope and priority pages.

### Bug 3 (Policy Edit — Done)
- Add "Edit" option to `src/components/policy-actions.tsx` that links to `/dashboard/policies/[id]`
- Create `src/app/dashboard/policies/[id]/page.tsx` with `PolicyPermissionsEditor`

### Bug 4a+4b (File display — Done)
- `renderCellValue` in items page: add `case "file"` to extract filename from path
- Add download link (signed URL button) in a new client component for file cells in the grid

### Bug 4c (Timezone — Pending)
Questions for user:
- Add `timezone` column to `profiles` table via DB migration?
- Default to browser's detected timezone if not set?
- Where should users configure their timezone? (Profile settings page? User system collection?)
- Datetime fields in collection items grid: render server-side (Server Component) or client-side?

### Bug 5 (Console Error — Investigate)
- Error: `TypeError: Failed to fetch` at `signInWithPassword`
- Likely cause: Supabase cloud URL not reachable (network/CORS/env issue)
- Not a code bug — needs environment verification
- Check: Is `NEXT_PUBLIC_SUPABASE_URL` correct? Is Supabase project online?

### Bug 6a (Person In Charge — Done)
- New migration: add `contact_name` and `contact_email` columns to `tenants` table
- Update `create-tenant-dialog.tsx`, `edit-tenant-dialog.tsx`
- Update `updateTenant` service + server action

### Bug 6b (Mandatory asterisks — Done)
- Scan all dialogs and add `<span className="text-red-400 ml-1">*</span>` to required field labels

### Bug 7 (Tenant deletion cascade — Done)
- Update `TenantsService.deleteTenant` to:
  1. Fetch all `tenant_users` rows for this tenant
  2. For each user: count their other tenant_users rows
  3. If count = 0 after removal → delete user from auth.users (admin client)
  4. Delete all `tenant_users` rows for this tenant
  5. Delete the tenant
- Update the confirmation dialog text to mention this cascade behavior

---

## Resumption Guide

If token cap hits, resume by:
1. Check TASKS.md for current `In Progress` item
2. Read BUG_FIX_PLAN.md status column (✅/🕐/❌)
3. Pick next `🕐 Pending` item with decisions resolved
