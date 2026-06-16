---
phase: quick-260616-igl
plan: 01
subsystem: standup-notes
tags: [standup, date-selector, ui]
requires: []
provides:
  - getTodayDate() local-date helper in standup-date.ts
  - Today-selectable day selector in the Yesterday column
affects:
  - taskflow/src/lib/standup-date.ts
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
tech-stack:
  added: []
  patterns:
    - Local calendar-component date strings (never toISOString())
key-files:
  created: []
  modified:
    - taskflow/src/lib/standup-date.ts
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
decisions:
  - Today prepended at the consumer (dayOptions useMemo), not in buildRecentDayOptions
  - Reused getTodayDate() in both the heading special-case and the row tag for a single source of truth
requirements: [IGL-01]
metrics:
  duration: ~5m
  completed: 2026-06-16
---

# Phase quick-260616-igl Plan 01: Standup Today Selector Summary

Allow selecting **today** in the standup-notes Yesterday-column day selector: today is now the
top dropdown row tagged "<Weekday, D Month YYYY> · Today", and the column heading reads "Today"
when today is the selected date — implemented with a new `getTodayDate()` local-date helper and
zero query-wiring changes.

## What Was Built

### Task 1 — `getTodayDate()` helper (`standup-date.ts`)
Exported `getTodayDate(): string` returning today's date as a YYYY-MM-DD string via the existing
`toLocalDateString(new Date())`. Placed next to `buildRecentDayOptions` with a doc comment
restating the standing rule: local calendar components, never `toISOString()`. `buildRecentDayOptions`
was left unchanged (still "recent past days starting at yesterday").
- Commit: `9dc0e4e1`

### Task 2 — Today heading + prepended today row (`YesterdayColumn.tsx`)
- Added `getTodayDate` to the existing import from `@/lib/standup-date`.
- `getColumnHeading(dateStr)`: added a `Today` special-case (`if (dateStr === getTodayDate()) return 'Today'`)
  before the existing yesterday comparison; weekday fallback unchanged.
- `dayOptions` useMemo: after building `dates` and the resolved-default guard, prepend today
  (`if (!dates.includes(today)) dates.unshift(today)`) so it sits at index 0; the `.map` tags the
  today row `"<dateLabel> · Today"`, mirroring the existing `· Yesterday` / `· Last working day` style.
- Did NOT touch `DropdownMenuRadioGroup` `onValueChange`, StandupNotesPage, or any query keys —
  today flows through as a normal date override.
- Commit: `2ff57d85`

## Verification

- `tsc --noEmit` — clean (TSC OK).
- `biome check ./src` — exit 0; the only 17 warnings are pre-existing in `chart.tsx` and
  `MyTasksPage.tsx` (out of scope; not touched by this plan). Both changed files are warning-free.
- Grep gates passed: `export function getTodayDate`, `return 'Today'`, `· Today`, `getTodayDate`
  reference in YesterdayColumn.
- No `toISOString()` introduced in either file.

> Note: the worktree had no `node_modules`; type/lint checks were run against the main checkout's
> `node_modules` (symlinked locally — not committed, gitignored).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Single-line import to satisfy biome formatter**
- **Found during:** Task 2
- **Issue:** The initial multi-line `import { ... } from '@/lib/standup-date'` was reformatted by
  biome onto a single line; `biome check` flagged it as a format error, failing the verify gate.
- **Fix:** Collapsed the import to one line.
- **Files modified:** taskflow/src/routes/standup-notes/YesterdayColumn.tsx
- **Commit:** `2ff57d85`

## Known Stubs

None.

## Threat Flags

None — pure client-side date computation; no new trust boundary or dependency (matches plan threat model).

## Self-Check: PASSED

- taskflow/src/lib/standup-date.ts — FOUND (modified, getTodayDate exported)
- taskflow/src/routes/standup-notes/YesterdayColumn.tsx — FOUND (modified)
- Commit 9dc0e4e1 — FOUND
- Commit 2ff57d85 — FOUND

## Post-Review Follow-up (WR-01)

Code review (260616-igl-REVIEW.md) flagged WR-01: `dayOptions` and the column
heading derive from "today" but were not reactive, so a tab left open across
midnight kept a stale "· Today" row/heading and the radio value could stop
matching a row. Fixed in commit **e9ccf9b2**: added `useTodayDate()` (single
timeout to next local midnight, no polling) and threaded the reactive value
through `getColumnHeading(dateStr, todayStr)` and the `dayOptions` memo deps.
`tsc --noEmit` and `biome check` both clean. WR-02 (today === resolvedYesterday
edge) left as accepted — unreachable in normal operation.
