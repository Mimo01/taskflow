---
phase: 76-visual-polish-and-shared-primitives
plan: "01"
subsystem: lib/utilities
tags: [tdd, display-primitives, wcag, tailwind, vitest]
dependency_graph:
  requires: []
  provides:
    - taskflow/src/lib/issueDisplayUtils.ts (isDoneStatus, doneSummaryClass, priorityStripeClass)
  affects:
    - Plan 76-03 (TaskCard, BacklogRow, TodayInProgressSection, TodayUpNextSection consumers)
    - Plan 76-04 (DashboardInProgressCard consumer)
tech_stack:
  added: []
  patterns:
    - Record<string, string> static class map (mirrors statusStyles.ts / epicColors.ts)
    - Full static Tailwind class strings (no template literals — JIT-safe)
    - Pure string utility exports (no imports)
key_files:
  created:
    - taskflow/src/lib/issueDisplayUtils.ts
    - taskflow/src/lib/issueDisplayUtils.test.ts
  modified: []
decisions:
  - "WCAG-corrected Medium priority stripe: yellow-700 (4.92:1) in light, yellow-500 (7.48:1) in dark — UI-SPEC yellow-500 light fails at 1.92:1"
  - "doneSummaryClass applies to issue KEY element despite name — kept per D-06 roadmap export contract"
  - "DEFAULT_STRIPE = border-l-gray-600 dark:border-l-gray-300 for all null/unmapped priorities (D-03)"
  - "priorityStripeClass returns color class only; callers add border-l-4 width (UI-SPEC contract)"
requirements_completed: [VISUAL-01, VISUAL-04, VISUAL-05]
metrics:
  duration: "~2 minutes"
  completed: "2026-06-03"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 76 Plan 01: issueDisplayUtils Shared Display Primitives Summary

Shared `isDoneStatus`, `doneSummaryClass`, and `priorityStripeClass` utilities created as the single source of truth for done-state strikethrough and the WCAG-verified priority color stripe palette.

## What Was Built

`taskflow/src/lib/issueDisplayUtils.ts` — three pure string utility exports:

- `isDoneStatus(statusCategory)` — returns `true` iff `statusCategory?.key === 'done'` (D-07, centralizes the inline check currently duplicated in TaskCard and elsewhere)
- `doneSummaryClass(statusCategory)` — returns `'line-through'` for done issues, `''` otherwise; applied to the issue key element not summary text (D-06, name kept per roadmap contract)
- `priorityStripeClass(priorityName)` — maps Jira priority name → WCAG-verified Tailwind `border-l-*` color class via a static `PRIORITY_STRIPE` record; returns a neutral gray default for null/unknown priorities (D-03)

`taskflow/src/lib/issueDisplayUtils.test.ts` — 17 unit tests covering all exports including the full WCAG-corrected palette, all null/undefined cases, and the unknown-priority default branch.

## TDD Gate Compliance

- RED commit: `844e0281` — test file created, fails with "cannot find module ./issueDisplayUtils"
- GREEN commit: `53af8b1b` — implementation created, all 17 tests pass, biome+tsc clean
- REFACTOR: not required (implementation is minimal and clean)

## Key Technical Decisions

**WCAG palette correction (most important):** The UI-SPEC suggested `yellow-500` for Medium priority in light mode. The RESEARCH.md WCAG formula confirms this fails at 1.92:1 (threshold 3:1). The verified palette uses `yellow-700` (4.92:1) in light mode with `yellow-500` (7.48:1) in dark mode. This correction is asserted directly in the test suite.

**Full static Tailwind class strings:** `PRIORITY_STRIPE` record uses complete class tokens (`'border-l-red-600 dark:border-l-red-400'`) not template literals. Tailwind JIT scanner requires static strings to include classes in the purged bundle (RESEARCH.md Pitfall 5). Same pattern as `epicColors.ts` and `statusStyles.ts`.

**Color-only return / width-at-call-site:** `priorityStripeClass` returns only the color class. Callers add `border-l-4` (width) per UI-SPEC contract. This allows subtask cards to keep their existing `border-l-2 border-l-muted` nesting marker without the stripe interfering.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `issueDisplayUtils.ts` is a complete, tested utility. No placeholder values or unresolved TODOs.

## Threat Flags

None — pure string transform utilities with no auth, I/O, or trust boundary interactions.

## Self-Check

- [x] `taskflow/src/lib/issueDisplayUtils.ts` — exists, exports isDoneStatus/doneSummaryClass/priorityStripeClass
- [x] `taskflow/src/lib/issueDisplayUtils.test.ts` — exists, 17 tests passing
- [x] RED commit `844e0281` — verified in git log
- [x] GREEN commit `53af8b1b` — verified in git log
- [x] `npm run check` clean (biome + tsc, 434 files)

## Self-Check: PASSED
