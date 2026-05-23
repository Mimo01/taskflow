---
phase: quick-260518-dks
plan: "01"
subsystem: issue-detail
tags: [ui, jira, assignee-popover, ux]
dependency_graph:
  requires: []
  provides: [restyled-assign-to-me-link]
  affects: [taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx]
tech_stack:
  added: []
  patterns: [tailwind-muted-text-link]
key_files:
  modified:
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
decisions:
  - Kept divider (softer via border-border/40) rather than removing it — preserves visual grouping between the quick-assign link and the search input
  - Display-name suffix retains explicit text-muted-foreground so it does not inherit the hover:text-foreground brightness of the parent button
metrics:
  duration: "~5 min"
  completed: "2026-05-18"
  tasks_completed: 1
  files_modified: 1
---

# Quick Task 260518-dks: Restyle "Assign to me" as subtle text link in assignee popover

One-liner: Replaced the filled avatar button with a muted inline text link "Assign to me →" that shifts to foreground color on hover, with no background fill and a softened divider.

## What Was Done

**Task 1: Restyle "Assign to me" as subtle text link, soften divider, remove avatar**

Changed the "Assign to me" quick-assign control in the Jira assignee popover from a full-width list-row button (with avatar, hover background, rounded box) to a minimal inline text link.

Changes made to `FieldsSection.tsx` lines 441-457:

1. Removed `<CachedAvatar>` element from inside the button — no avatar rendered.
2. Replaced button className: dropped `w-full px-2 py-1 rounded hover:bg-accent flex items-center gap-1.5`, applied `text-left px-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors`.
3. Updated label text to "Assign to me →" with trailing arrow.
4. Display-name suffix `({jiraUserDisplayName})` keeps its own `text-muted-foreground` class so it remains muted even when the parent button is hovered.
5. Softened divider: `border-b my-1` → `border-b border-border/40 my-2`.
6. `CachedAvatar` import retained — still used for assignee trigger and reporter row.

All existing wiring preserved: `data-testid="assignee-assign-to-me"`, `onClick={handleAssignToMe}`, and the `{jiraUsername && f.assignee?.name !== jiraUsername}` visibility guard.

## Commit

| Task | Commit | Files |
|------|--------|-------|
| 1 | 0e4a610 | taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx |

## Verification

- TypeScript compiles with no new errors for FieldsSection.tsx
- `data-testid="assignee-assign-to-me"` still present
- Button label reads "Assign to me →"
- `hover:bg-accent` count inside the button = 0 (confirmed via awk check)
- Divider updated to `border-border/40 my-2`
- Visibility guard and onClick handler unchanged
- CachedAvatar import still present

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- File modified: FOUND `/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx`
- Commit: FOUND `0e4a610`
