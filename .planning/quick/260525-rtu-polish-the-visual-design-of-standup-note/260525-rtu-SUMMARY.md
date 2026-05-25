---
phase: quick-260525-rtu
plan: 01
subsystem: standup-notes
tags: [ui, tailwind, standup-notes, visual-polish]
dependency_graph:
  requires: []
  provides: [standup-notes-visual-polish]
  affects: [standup-notes]
tech_stack:
  added: []
  patterns: [shadcn-card-border, count-badge, section-separator]
key_files:
  created: []
  modified:
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
    - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
    - taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx
    - taskflow/src/routes/standup-notes/TodayInProgressSection.tsx
    - taskflow/src/routes/standup-notes/TodayUpNextSection.tsx
    - taskflow/src/routes/standup-notes/TodayMrsSection.tsx
    - taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx
decisions:
  - "Yesterday groups use rounded-lg border border-border bg-card overflow-hidden to match app card vocabulary"
  - "Today column wrapper gets bg-muted/30 tint; Yesterday wrapper left unchanged (stays bright)"
  - "Count badges use rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground pattern"
  - "TodayParticipatingSection header string-interpolation variable removed; replaced by conditional badge span"
  - "IN PROGRESS has no border-t (first section); UP NEXT / MRS AWAITING YOU / PARTICIPATING get border-t border-border pt-4"
metrics:
  duration: ~8 minutes
  completed_date: "2026-05-25"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 8
---

# Phase quick-260525-rtu Plan 01: Standup Notes Visual Polish Summary

**One-liner:** Pure CSS/class pass bringing standup notes into shadcn card vocabulary — Today tint, Yesterday bordered cards, section count badges.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Today column tint + Yesterday card treatment | 3ec47360 | StandupNotesPage.tsx, YesterdayColumn.tsx, IssueActivityGroup.tsx, StandaloneMrGroup.tsx |
| 2 | Today section headers — count badges + separators | 8ba0e3ab | TodayInProgressSection.tsx, TodayUpNextSection.tsx, TodayMrsSection.tsx, TodayParticipatingSection.tsx |
| 3 | Human visual verification checkpoint | — | (awaiting human review — see below) |

## What Was Built

**Task 1 — Column/card treatment:**
- `StandupNotesPage.tsx`: Today column wrapper (`w-1/2 overflow-auto`) gains `bg-muted/30` tint. Yesterday wrapper (`border-r border-border px-6 py-4`) unchanged.
- `YesterdayColumn.tsx`: Outer group container changed from `divide-y divide-border` to `flex flex-col gap-2` — groups now spaced as independent items rather than a continuous divided list.
- `IssueActivityGroup.tsx`: Root div changed from `py-2` to `rounded-lg border border-border bg-card overflow-hidden` — each issue group is now a bordered card. Inner header button (`px-2 py-2 hover:bg-muted/50`) and inner sub-items `divide-y divide-border` left untouched.
- `StandaloneMrGroup.tsx`: Same root change as IssueActivityGroup. Inner `divide-y divide-border` on sub-items preserved.

**Task 2 — Section header badges + separators:**
- All four Today sections: `<h3>` wrapped in `<div className="flex items-center gap-2 mb-2">` with a conditional `<span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{count}</span>` when count > 0.
- Wrapper `mb-6` changed to `mb-4` on all four sections.
- `TodayUpNextSection`, `TodayMrsSection`, `TodayParticipatingSection`: wrapper gains `border-t border-border pt-4`.
- `TodayInProgressSection`: NO border-t (first section).
- `TodayParticipatingSection`: removed the `const header = items.length > 0 ? ... : 'PARTICIPATING'` string-interpolation variable; replaced with badge pattern.

## Human Verification Required (Task 3)

Task 3 is a `checkpoint:human-verify`. Human visual verification is required before marking this task fully complete.

**How to verify:**
1. Run the app (`cd taskflow && npm run tauri dev`) and navigate to the Standup Notes page.
2. Confirm the Today (right) column has a subtle gray tint distinguishing it from the bright Yesterday (left) column, with the border-r divider intact.
3. Confirm Yesterday issue/MR groups appear as separate rounded bordered cards with visible gaps between them. Expand a group — internal sub-item dividers should still be present inside the card.
4. Confirm each Today section with items shows a small count badge next to its uppercase label (e.g. "IN PROGRESS  3"), and sections after the first have a thin top-border separator.
5. Functionality check: click an issue row and an MR row — they should still navigate as before. Trigger the markdown copy — output should be unchanged.
6. Visually confirm overall coherence with the rest of the app (card style, muted tones, thin borders).

**Resume signal:** Type "approved" if it looks clean and matches the app, or describe any visual issues to adjust.

## Deviations from Plan

None — plan executed exactly as written. All class-string edits and header JSX restructuring applied as specified. Inner `divide-y divide-border` structures inside cards preserved as required.

## Known Stubs

None. This is a pure visual/CSS pass with no data stubs.

## Threat Flags

None. Pure class-string and JSX structure edits with no new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

- StandupNotesPage.tsx `bg-muted/30`: grep confirmed in Task 1 verification
- YesterdayColumn.tsx `flex flex-col gap-2`: grep confirmed in Task 1 verification
- IssueActivityGroup.tsx `rounded-lg border border-border bg-card overflow-hidden`: grep confirmed in Task 1 verification
- StandaloneMrGroup.tsx `rounded-lg border border-border bg-card overflow-hidden`: grep confirmed in Task 1 verification
- Task 2 full grep gate: `border-t` in UpNext/Mrs/Participating, NOT in InProgress, badge in InProgress, no `PARTICIPATING (` in Participating: all confirmed OK
- Commits 3ec47360 and 8ba0e3ab exist on branch `worktree-agent-ae18f68e315047f52`
