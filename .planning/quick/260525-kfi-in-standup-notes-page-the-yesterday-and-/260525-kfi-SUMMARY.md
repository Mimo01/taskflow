---
phase: quick-260525-kfi
plan: "01"
subsystem: standup-notes
tags: [restyle, tailwind, yesterday-column, visual-unification]
dependency_graph:
  requires: []
  provides: [unified-standup-yesterday-row-style]
  affects: [YesterdayColumn]
tech_stack:
  added: []
  patterns: [border-l indent pattern, bg-muted chip, divide-y sub-rows]
key_files:
  created: []
  modified:
    - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
    - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
    - taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx
decisions:
  - "Kept button element type on IssueActivityGroup header (no change needed per plan)"
  - "Used divide-y divide-border on the sub-item container to match Today's nested container"
metrics:
  duration: ~10min
  completed: "2026-05-25"
---

# Phase quick-260525-kfi Plan 01: Unify Yesterday Column Row Styles Summary

**One-liner:** Restyled three Yesterday column components (IssueActivityGroup, StandaloneMrGroup, OtherCommitsGroup) from bold ul/li list layout to Today's padded-row pattern with monospace keys, bg-muted chips, and border-l indented sub-rows — className-only changes, zero behavior/data/prop changes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restyle three Yesterday sub-components | 4c687c86 | IssueActivityGroup.tsx, StandaloneMrGroup.tsx, OtherCommitsGroup.tsx |

## Changes Made

### IssueActivityGroup.tsx
- Header `<button>`: removed `-mx-1`, changed `px-1 py-0.5 text-sm font-semibold` to `px-2 py-2`
- Key `<span>`: `font-medium` replaced with `font-mono`, added `text-sm` to summary span
- Time chip: `ml-auto` replaced with `rounded bg-muted px-2 py-1`
- Sub-items: replaced `<ul className="mt-1 flex flex-col gap-1 pl-8">` + `<li>` with `<div className="pl-6 border-l border-border ml-2 divide-y divide-border">` containing `<div className="flex items-center gap-2 py-2 px-2">` rows; icons bumped from `size-3` to `size-4`, removed `mt-0.5`

### StandaloneMrGroup.tsx
- Header: changed `flex items-center gap-2 text-sm font-semibold` to `flex items-center gap-2 py-2 px-2`
- Split combined `<span>` (iid inline in title) into separate `<span className="text-xs text-muted-foreground font-mono shrink-0">!{iid}</span>` + `<span className="flex-1 min-w-0 truncate text-sm">{title}</span>`
- Sub-items: same ul/li → border-l div pattern as IssueActivityGroup

### OtherCommitsGroup.tsx
- Header: changed `flex items-center gap-2 text-sm font-semibold text-muted-foreground italic` to `flex items-center gap-2 py-2 px-2`; added `text-muted-foreground` to GitBranch icon
- Sub-label: removed `not-italic`, simplified to `text-xs text-muted-foreground`
- Commit rows: same ul/li → border-l div pattern; icons bumped size-3 → size-4

## Verification

- Biome lint: PASSED (3/3 files clean)
- vitest standup-notes suite: PASSED (60/60 tests)
- Pattern check: all three files contain `pl-6 border-l border-border ml-2`
- Pattern check: no `pl-8`, `font-semibold`, or `italic` remaining in any of the three files
- Main repo tsc: PASSED (0 errors in these files)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — className-only changes, no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- [x] `4c687c86` commit exists: `git log --oneline | grep 4c687c86`
- [x] IssueActivityGroup.tsx modified and committed
- [x] StandaloneMrGroup.tsx modified and committed
- [x] OtherCommitsGroup.tsx modified and committed
- [x] 60 vitest tests pass
- [x] Biome clean on all three files
