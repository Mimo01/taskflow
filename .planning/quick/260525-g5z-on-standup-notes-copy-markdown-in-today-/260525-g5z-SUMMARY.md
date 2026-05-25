---
phase: quick-260525-g5z
plan: "01"
subsystem: standup-notes
tags: [markdown, formatting, MR, TDD]
dependency_graph:
  requires: []
  provides: [sentence-form MR lines in generateTodayMarkdown]
  affects: [TodayColumn.tsx, StandupNotesPage.tsx (via generateTodayMarkdown)]
tech_stack:
  added: []
  patterns: [TDD red-green]
key_files:
  created:
    - taskflow/src/routes/standup-notes/TodayColumn.markdown.test.ts
  modified:
    - taskflow/src/routes/standup-notes/TodayColumn.tsx
decisions:
  - Wrap title in parentheses so colons and special characters in MR titles do not break the sentence
  - Keep section header "### Participating MRs" unchanged; only the per-item line format changes
metrics:
  duration: ~5 minutes
  completed: "2026-05-25T09:42:13Z"
---

# Quick Task 260525-g5z: Standup Notes Copy Markdown — MR Sentence Formatting

**One-liner:** Rewrote participating/reviewing MR lines in `generateTodayMarkdown` to render as natural sentences — "Participated in MR !{iid} ({title})" and "Reviewed MR !{iid} ({title})" — removing the terse "Participating: !" form.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| RED | Failing tests for MR sentence format | b780c2b9 | TodayColumn.markdown.test.ts (new) |
| GREEN | Implement sentence-form MR lines | 1764c0d4 | TodayColumn.tsx |

## What Was Built

Updated `generateTodayMarkdown` in `TodayColumn.tsx` at two locations:

1. **Nested MR loop** (under an In Progress / Up Next story): changed from
   `- ${mr.kind === 'review' ? 'Reviewing' : 'Participating'}: !${mr.iid} ${mr.title}`
   to:
   - `- Reviewed MR !{iid} ({title})` for `kind === 'review'`
   - `- Participated in MR !{iid} ({title})` for `kind === 'participating'`

2. **Standalone "Participating MRs" section**: changed from
   `- !${mr.mrIid}: ${mr.title}`
   to:
   `- Participated in MR !{mrIid} ({title})`

Created `TodayColumn.markdown.test.ts` with 4 focused unit tests locking the new format, following TDD red-green cycle.

## Verification

- `npx vitest run src/routes/standup-notes/TodayColumn.markdown.test.ts` — 4/4 PASS
- `npx vitest run src/routes/standup-notes` — 58/58 PASS (no regressions)
- `grep -n "Participating: !" TodayColumn.tsx` — returns nothing (old format gone)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## TDD Gate Compliance

- RED commit: b780c2b9 (`test(quick-260525-g5z-01): add failing tests...`)
- GREEN commit: 1764c0d4 (`feat(quick-260525-g5z-01): rewrite participating/reviewing MR lines...`)

## Self-Check: PASSED

- TodayColumn.markdown.test.ts: EXISTS
- TodayColumn.tsx (updated): EXISTS
- Commit b780c2b9: EXISTS
- Commit 1764c0d4: EXISTS
