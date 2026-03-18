# PulseBoard Roadmap

> Items here are validated product ideas but **not currently scheduled**.
> Review periodically — promote to TASKS.md when ready to implement.

---

## Pending (No Date)

### Full UI Internationalisation (i18n)
**Priority:** Low
**Complexity:** Very High
**Summary:**
All static UI text (navigation labels, page titles, button text, form labels, error messages, widgets) must support EN, JP (日本語), CN (简体中文).
**Scope:**
- Install and configure `next-intl` (or equivalent) with message files per locale
- Translate all static strings across sidebar, header, dashboard, studio, security pages
- Support collection name translations (partially done in `metadata.name_translations`)
- Support field label translations (partially done in `options.labels`)
- Grid column headers, empty states, action menus, dialog titles
- Slug values remain English (API-safe)
- Note: Dynamic content (collection item data) already has per-locale translation support via `collection_item_translations` table

**Deferred because:** Very large surface area. Low ROI until platform goes multi-region or multi-language clients are onboarded.

---

### Studio Phase 10: Kanban + Saved Views
**Priority:** Low
**Complexity:** High
**Summary:** Allow users to save filter/sort/column configurations as named views and optionally display a Kanban board layout for collections with a select/status field.
**Deferred because:** Core CRUD is stable. Views are a UX enhancement for power users.

---

## Decisions Pending

_(Items that need product discussion before scheduling)_

None currently.
