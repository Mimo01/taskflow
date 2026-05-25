---
phase: quick-260525-jrz
plan: "01"
subsystem: standup-notes
tags: [ui, empty-state, compact, standup]
dependency_graph:
  requires: []
  provides: [compact-per-source-empty-notices]
  affects: [YesterdayColumn]
tech_stack:
  added: []
  patterns: [local-function-component, flex-wrap-pill-row]
key_files:
  modified:
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
decisions:
  - "Used a local CompactEmptyNotice function component (not exported) to keep the compact notice self-contained within YesterdayColumn"
  - "Single flex-wrap container with gap-x-5 gap-y-1.5 so notices flow side-by-side on wide columns and wrap gracefully at narrow widths"
  - "The container guard checks .length === 0 for each source — same conditions as the replaced EmptyState blocks"
metrics:
  duration: "5m"
  completed: "2026-05-25"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase quick-260525-jrz Plan 01: Standup empty-state compact layout Summary

Replaced four stacked per-source EmptyState cards (~160px each) in YesterdayColumn with a single flex-wrap row of CompactEmptyNotice pills (~24px total) using a local function component with icon + label.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Replace per-source EmptyState blocks with CompactEmptyNotice | 5acef435 | YesterdayColumn.tsx |

## What Was Built

Added a `CompactEmptyNotice` local function component before the main export:

```tsx
function CompactEmptyNotice({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
```

The four individual `<div className="mb-3"><EmptyState .../></div>` blocks (Tempo / Jira / Commits / MR) were replaced with a single collected container:

```tsx
{(tempoQuery.data?.length === 0 || jiraActivityQuery.data?.length === 0 || ...) && (
  <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2 mb-3">
    {tempoQuery.data?.length === 0 && <CompactEmptyNotice icon={Clock} label={`No worklogs on ${day}`} />}
    ...
  </div>
)}
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript: `tsc --noEmit` exits 0, no errors in YesterdayColumn
- Full-column "Nothing to recap" EmptyState untouched (guarded by `!hasAnyData`)
- Error states, loading skeletons, Tempo-disabled text untouched
- Per-source empty conditions use identical logic to the replaced blocks

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- [x] `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` modified and committed
- [x] Commit 5acef435 exists in git log
- [x] TypeScript passes with no new errors
- [x] CompactEmptyNotice component present in file
- [x] Full-column EmptyState unchanged
