# Quick Task 260526-h3u: Remove Sprint Progress Page — Research

**Researched:** 2026-05-26
**Domain:** React/TypeScript dead-code removal — route, sidebar, file deletion
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full delete: SprintProgressTab.tsx, SprintProgressSkeleton.tsx, SprintProgressTab.test.tsx, and all routing/sidebar/navigation references
- Delete SprintHealthPanel.tsx and SprintHealthPanel.test.tsx (orphan, never rendered in production)
- Clean all dead references across the entire codebase

### Claude's Discretion
- Order of deletions (files first, then reference cleanup)
- How to handle DashboardInProgressCard cache key comments that mention SprintHealthPanel (remove the comment lines referencing it)
</user_constraints>

---

## Summary

Five files are deleted outright; eight files have surgical comment or code edits. No exported types from the deleted files are imported anywhere else — `SprintHealthPanelProps` and `SprintProgressSkeleton` are only used inside the files being deleted. The `SprintProgressTab` is only imported lazily in `routes.tsx`. After deletion, the app will build cleanly with no dangling references.

One unexpected file surfaced: `src/routes/standup-notes/TodayColumn.test.tsx` contains a comment-only reference (`Pattern source: SprintHealthPanel.test.tsx + ...`). It does not import or call anything from the deleted files, so it is low-risk — the comment can be left or trimmed at discretion.

---

## Files to DELETE (no edits required)

| File | Reason |
|------|--------|
| `src/routes/dashboard/SprintProgressTab.tsx` | The page being removed |
| `src/routes/dashboard/SprintProgressSkeleton.tsx` | Used only by SprintProgressTab |
| `src/routes/dashboard/SprintHealthPanel.tsx` | Orphan — never rendered in production |
| `src/routes/dashboard/SprintProgressTab.test.tsx` | Test for deleted component |
| `src/routes/dashboard/SprintHealthPanel.test.tsx` | Test for deleted component |

**Exported types in deleted files:** `SprintHealthPanelProps` (interface), `SprintProgressSkeleton` (function), default exports only. None are imported outside these five files. [VERIFIED: grep of full src/]

---

## Files to EDIT — Exact Changes Required

### 1. `src/routes/routes.tsx`

Two changes:

**Remove lazy import (line 16):**
```ts
const SprintProgressTab = lazy(() => import('./dashboard/SprintProgressTab'));
```
Delete that line entirely.

**Remove route entry (line 44):**
```ts
{ path: '/sprint-progress', element: withLazy(SprintProgressTab) },
```
Delete that line entirely.

### 2. `src/components/app/sidebar-items.ts`

Remove the `sprint-progress` entry from `SIDEBAR_NAV_ITEMS` (lines 78–83):
```ts
{
  id: 'sprint-progress',
  label: 'Sprint Progress',
  path: '/sprint-progress',
  iconName: 'BarChart2',
  section: 'tracking',
},
```
Delete all 7 lines (the object and its enclosing braces, including the trailing comma).

**Note on settings store migration:** The settings store persists `sidebarItems` (array of `{id, visible}`) in IndexedDB via Zustand persist. Removing the `sprint-progress` entry from `SIDEBAR_NAV_ITEMS` means it won't appear in `getDefaultSidebarItems()` going forward, but users who already have it stored will have an unknown id entry in their persisted state. This is benign — the sidebar render filters items against `SIDEBAR_NAV_ITEMS` by id, so a stored `sprint-progress` entry with no corresponding nav def will simply be ignored at render time. No migration required. [ASSUMED — based on reading sidebar-items.ts; Sidebar.tsx not read in this session]

### 3. `src/main.tsx`

Remove the breadcrumb label case (line 291):
```ts
if (pathname.startsWith('/sprint-progress')) return 'Sprint Progress';
```
Delete that single line.

### 4. `src/routes/dashboard/WikiRenderer.tsx`

Remove the static label entry (line 877 in `deriveSourceCrumb` `staticLabels` map):
```ts
'/sprint-progress': 'Sprint Progress',
```
Delete that line.

### 5. `src/routes/dashboard/DiscussionThreads.tsx`

Remove the static label entry (line 59 in `deriveSourceCrumb` `staticLabels` map):
```ts
'/sprint-progress': 'Sprint Progress',
```
Delete that line.

### 6. `src/routes/dashboard/DashboardSprintCard.tsx`

Edit the JSDoc comment at the top (line 11). Change:
```
 * Shares TanStack Query cache keys with SprintBoardTab/SprintProgressTab/SprintHealthPanel.
```
To:
```
 * Shares TanStack Query cache keys with SprintBoardTab.
```

### 7. `src/routes/dashboard/DashboardInProgressCard.tsx`

Two comment edits:

**Line 13** — Edit:
```
 * DashboardSprintCard, and SprintHealthPanel — no extra API call when warm.
```
To:
```
 * DashboardSprintCard — no extra API call when warm.
```

**Line 42** — Edit:
```
  // CACHE KEY MUST MATCH DashboardSprintCard / SprintHealthPanel / SprintBoardTab exactly
```
To:
```
  // CACHE KEY MUST MATCH DashboardSprintCard / SprintBoardTab exactly
```

### 8. `src/routes/worklogs/WorklogsPage.tsx`

Line 315 — Edit code comment:
```ts
  // ─ Auth token effect (SprintProgressTab pattern) ─────────────────────────
```
To (or simply delete the comment line — it adds no value):
```ts
  // ─ Auth token effect ─────────────────────────────────────────────────────
```

---

## Files with Comment-only Reference — Low Priority / Optional

| File | Line | Content | Action |
|------|------|---------|--------|
| `src/routes/standup-notes/TodayColumn.test.tsx` | 13 | `* Pattern source: SprintHealthPanel.test.tsx + ...` | Optional: trim the reference from the comment; not a code reference, no build impact |

---

## No-Op Checks (nothing to do)

- **No barrel `index.ts` re-exports** of SprintProgress items found anywhere in `src/`. [VERIFIED: grep]
- **No TypeScript types or enums** exported from deleted files are imported elsewhere. [VERIFIED: grep]
- **No deep-link strings** (e.g. in settings store defaults, keyboard shortcut targets, or command palette entries) reference `/sprint-progress` beyond the files already listed. The keyboard shortcut setup in `main.tsx` has no `mod+shift+p` → `/sprint-progress` binding. [VERIFIED: grep of main.tsx hotkeys section]
- **`DiscussionThreads.tsx`** reference is comment-map only (the `deriveSourceCrumb` staticLabels record) — it is a data value, not an import. [VERIFIED: file read]
- **`WikiRenderer.tsx`** same pattern as DiscussionThreads — `staticLabels` record entry only. [VERIFIED: file read]

---

## Build Verification

After all edits, run:
```bash
npm run build
```
(Not just `tsc` — per project convention in STATE.md: CSS imports fail silently in TypeScript checks.)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sidebar render filters items against SIDEBAR_NAV_ITEMS by id, making stored `sprint-progress` entries silently ignored | Files to EDIT §2 | Low — worst case is a phantom invisible entry; no crash |
