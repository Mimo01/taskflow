---
phase: quick-260606-rgc
plan: "01"
subsystem: epics-ui
tags: [epics, backlog-parity, avatar, table-layout]
dependency_graph:
  requires: []
  provides: [epics-table-headerless, epics-unassigned-avatar]
  affects: [EpicsPage]
tech_stack:
  added: []
  patterns: [colgroup-width-preservation, always-render-avatar]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/EpicsPage.tsx
decisions:
  - "Used colgroup for column width preservation rather than per-td classes, matching the plan's preferred approach"
  - "REQ-3 (status pill) was verify-only; confirmed byte-identical to canonical statusPillClass bare span — no code change needed"
metrics:
  duration: "~5 min"
  completed: "2026-06-06T17:55:46Z"
  tasks_completed: 3
  files_modified: 1
---

# Phase quick-260606-rgc Plan 01: Epics Page Backlog Visual Parity Summary

**One-liner:** Removed thead from epics table, added colgroup for column-width preservation, and wired always-render CachedAvatar with Unassigned fallback to match backlog row appearance.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove thead and preserve column widths with colgroup | 5da13469 | EpicsPage.tsx |
| 2 | Assignee parity (always-render CachedAvatar) and confirm status pill | 5da13469 | EpicsPage.tsx |
| 3 | Verify build/lint stays green | — (no file change) | — |

## What Was Done

**Task 1 — Remove thead / add colgroup (REQ-1)**

Deleted the entire `<thead className="border-b bg-muted/10">…</thead>` block (lines 186–202). The five `<th>` elements were the only explicit width carriers under CSS table-auto. A `<colgroup>` with five `<col>` elements was inserted immediately after `<table>`:

```tsx
<colgroup>
  <col className="w-1" />
  <col />
  <col className="w-28" />
  <col className="w-32" />
  <col className="w-12" />
</colgroup>
```

Column order: color-bar / name (flex) / key / status / assignee — matching the original `<th>` widths exactly.

**Task 2 — Assignee parity (REQ-2)**

Replaced the conditional `{epic.assignee ? <CachedAvatar .../> : null}` pattern with an always-rendered avatar:

```tsx
<CachedAvatar
  url={epic.assignee?.avatarUrls?.['48x48'] || null}
  name={epic.assignee?.displayName || 'Unassigned'}
  size={24}
/>
```

The `|| 'Unassigned'` name fallback triggers CachedAvatar's dashed-border User-icon treatment for unassigned epics, matching BacklogRow's semantics exactly.

**Task 3 — Status pill verification (REQ-3)**

Confirmed the status cell (line 66) is already:
```tsx
<span className={statusPillClass(epic.status.statusCategory?.key)}>{epic.status.name}</span>
```
No extra geometry classes; byte-identical to the canonical StoryHeaderRow usage. No code change made.

**Build gate:** `npm run check` (biome check + tsc) exits 0. No regressions.

## Deviations from Plan

None — plan executed exactly as written. REQ-3 was verify-only and confirmed clean with no drift.

## Known Stubs

None.

## Threat Flags

None — UI-only change, no new network endpoints or auth paths.

## Self-Check: PASSED

- [x] `taskflow/src/routes/dashboard/EpicsPage.tsx` modified and committed
- [x] Commit 5da13469 exists: `git log --oneline | grep 5da13469`
- [x] No `<thead>` in EpicsPage.tsx
- [x] `<colgroup>` with 5 cols present
- [x] Assignee cell always renders CachedAvatar with `|| 'Unassigned'` fallback
- [x] Status pill is canonical bare `statusPillClass` span
- [x] `npm run check` green
