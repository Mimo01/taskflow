---
phase: quick-260606-oyy
plan: 01
subsystem: sprint-board
tags: [ui, sprint-board, priority, issue-type, tailwind]
requires:
  - issueDisplayUtils (priorityStripeClass pattern)
  - IssueTypeIcon color palette
provides:
  - PriorityIcon component (renders priority.iconUrl)
  - issueTypeStripeClass() helper (issue-type → border-l color)
affects:
  - TaskCard left border + footer meta row
  - StoryHeaderRow swimlane header
  - SprintBoardTab call sites
tech-stack:
  added: []
  patterns:
    - "Named PascalCase icon component mirroring IssueTypeIcon convention"
    - "Full literal Tailwind class strings (no template interpolation) for JIT"
key-files:
  created:
    - taskflow/src/components/ui/priority-icon.tsx
  modified:
    - taskflow/src/lib/issueDisplayUtils.ts
    - taskflow/src/lib/issueDisplayUtils.test.ts
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
decisions:
  - "Card left border now encodes issue type (Bug=red, Story=green, Subtask/Task/Epic per palette); priority moved to an iconUrl image"
  - "issueTypeStripeClass checks the subtask flag before the name switch (flag is authoritative over renamed types)"
  - "priorityStripeClass retained per CONTEXT decision even though no card consumer remains"
  - "isSubtask prop kept for backward-compat typing but no longer alters the border"
metrics:
  duration_min: 6
  completed: 2026-06-06
  tasks: 3
  files: 6
---

# Quick Task 260606-oyy: Sprint board priority icon + issue-type border Summary

Replaced the sprint board's priority-colored card left border with the actual Jira `priority.iconUrl` image (footer meta row + swimlane header), and repurposed the card left border to encode issue type via a new `issueTypeStripeClass()` helper and a reusable `PriorityIcon` component.

## What Was Built

- **`PriorityIcon`** (`taskflow/src/components/ui/priority-icon.tsx`): named export rendering `priority.iconUrl` as a plain `<img>` (no auth needed), guarded by a single `!priority?.iconUrl` truthiness check that covers null priority, missing iconUrl, and empty-string iconUrl — so unknown priorities render nothing (no broken image). Default sizing `w-3.5 h-3.5 shrink-0` matching meta icons.
- **`issueTypeStripeClass()`** (`taskflow/src/lib/issueDisplayUtils.ts`): returns full literal Tailwind `border-l` color classes with dark variants. Subtask flag checked FIRST (blue), then a name switch (Bug=red-500, Story=green-600, Subtask/Sub-task=blue-500, Epic=purple-500, default/Task=blue-500). `priorityStripeClass` left untouched.
- **TaskCard** (R1/R2/R4/R5): left border now `border-l-4` + `issueTypeStripeClass(issue.fields.issuetype)`; removed both the priority-colored border and the special muted subtask border (uniform cards); `PriorityIcon` prepended to the footer right-cluster before the story-points badge; dropped the now-unused `isSubtask` destructure (prop kept on the interface).
- **StoryHeaderRow + SprintBoardTab** (R3): `StoryHeaderRow` accepts an optional `priority` prop and renders `PriorityIcon` after the key button; all 3 SprintBoardTab call sites pass the story's priority (2 inline + 1 sticky overlay).

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Failing tests for issueTypeStripeClass | f5356a92 | issueDisplayUtils.test.ts |
| 1 (GREEN) | PriorityIcon + issueTypeStripeClass | 79526f15 | priority-icon.tsx, issueDisplayUtils.ts |
| 2 | TaskCard border → issue type + PriorityIcon footer | 780454e0 | TaskCard.tsx, priority-icon.tsx |
| 3 | Priority icon in swimlane header | 0712f143 | StoryHeaderRow.tsx, SprintBoardTab.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `issue.fields.priority` is typed `unknown`**
- **Found during:** Task 2 (and Task 3).
- **Issue:** `JiraIssue.fields` uses an index signature `[key: string]: unknown`, so `issue.fields.priority` / `stickyHeader.story.fields.priority` are `unknown` — not assignable to `PriorityIcon`'s typed prop. `npm run check` (tsc) failed with TS2322.
- **Fix:** Cast at each call site to `{ name?: string; iconUrl?: string } | null | undefined`, mirroring the cast the original TaskCard code already used for `priorityStripeClass`.
- **Files modified:** TaskCard.tsx (1 site), SprintBoardTab.tsx (3 sites).
- **Commits:** 780454e0, 0712f143.

**2. [Rule 1 - Style] PriorityIcon `<img>`/signature formatting**
- **Found during:** Task 2's `npm run check`.
- **Issue:** Biome formatter required the component signature on one line and the `<img>` wrapped in parens. Surfaced when Task 2 first ran the full check.
- **Fix:** Applied `biome check --write` to priority-icon.tsx; committed the format fix alongside Task 2.
- **Commit:** 780454e0.

### Verify-step note

The plan's Task 3 verify regex `priority=\{(stickyHeader\.)?story\.fields\.priority\}` assumes a bare prop with `}` immediately after `priority`. Because the cast (deviation 1) is required for tsc, the prop is `priority={story.fields.priority as ...}`, which the strict regex does not match. Verified equivalently: all 3 call sites pass the story priority (`grep -cE "story\.fields\.priority as" = 3`) and `npm run check` is GREEN.

## Verification

- `npm run test -- issueDisplayUtils`: 40/40 pass (11 new `issueTypeStripeClass` tests + existing suite).
- `npm run check` (biome + tsc): GREEN.
- Manual (not run here — requires the running app): cards show no priority border, show the priority icon in the footer, and a type-colored left border; subtask cards uniform; unknown priority shows no icon; swimlane header (inline + sticky) shows the story priority icon.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: taskflow/src/components/ui/priority-icon.tsx
- FOUND: taskflow/src/lib/issueDisplayUtils.ts (issueTypeStripeClass)
- FOUND: taskflow/src/lib/issueDisplayUtils.test.ts
- FOUND commit f5356a92, 79526f15, 780454e0, 0712f143
