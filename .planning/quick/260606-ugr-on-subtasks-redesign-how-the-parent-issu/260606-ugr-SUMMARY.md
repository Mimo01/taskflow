---
phase: quick-260606-ugr
plan: 01
subsystem: issue-detail
tags: [ui, subtask, parent-link, peek, status-pill]
requires:
  - JiraIssueDetail (jira.ts) consumed by IssueDetailContent
  - IssueTypeIcon, statusPillClass, lucide ArrowUpRight (all pre-existing)
provides:
  - Prominent clickable parent card on subtask full page + peek panel
  - Widened consumed parent type (issuetype + status with statusCategory.key)
affects:
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx (shared full page + peek)
tech-stack:
  added: []
  patterns:
    - statusPillClass keyed on statusCategory.key, pill text = status.name
    - statusPill wrapped in flex container (statuspill-needs-flex-parent)
    - conditional render for optional nested parent fields (graceful fallback)
key-files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
decisions:
  - Widened ONLY the consumed JiraIssueDetail parent site at jira.ts:1239; left dead sites (jira.ts:169, jira/types.ts) untouched to avoid churn.
  - Included the optional status pill per CONTEXT discretion; colored by statusCategory.key.
metrics:
  duration: ~4m
  completed: 2026-06-06T20:16:22Z
requirements: [UGR-01]
---

# Phase quick-260606-ugr Plan 01: Subtask Parent-Link Redesign Summary

Replaced the faint muted parent breadcrumb on subtasks with a prominent, polished,
clickable parent card (type icon + "Parent" label + mono key + foreground truncating
summary + correctly-colored status pill + trailing ArrowUpRight), shared across the
full page and the peek panel via one edit to `IssueDetailContent.tsx`.

## What Was Built

### Task 1 — Widen consumed parent type (jira.ts:1239)
Widened `JiraIssueDetail.fields.parent.fields` (the interface `fetchIssueDetail` returns
and `IssueDetailContent` consumes) from `{ summary: string }` to additionally expose
optional `issuetype?: { name; iconUrl? }` and `status?: { name; statusCategory?: { key } }`.
Type-only change; no field-request strings altered (Jira DC already expands nested parent
fields, proven by jira.ts:832). The two narrow sites at jira.ts:169 and jira/types.ts were
deliberately left untouched (dead for this component).
- Commit: `ecc595af`

### Task 2 — Prominent clickable parent card
Imported `IssueTypeIcon` and replaced the `{isSubtask && parent && (...)}` breadcrumb
`<button>` with a single full-width card button:
- rounded, `border`, `bg-muted/50`, `px-3 py-2`, `hover:bg-muted` (via `cn`)
- horizontal flex row, `items-center gap-2`, `mb-2`
- conditional `IssueTypeIcon` (omitted when issuetype absent — layout holds via flex)
- uppercase xs muted "Parent" label, mono key, `min-w-0 flex-1 truncate pr-0.5` foreground summary
- optional status pill: color via `statusPillClass(parent.fields.status?.statusCategory?.key)`,
  text `{parent.fields.status?.name}`, wrapped in a `flex shrink-0` div
- trailing `ArrowUpRight` with `ml-auto shrink-0`
- `aria-label={`Open parent issue ${parent.key}`}`, unchanged `onOpenIssue?.(parent.key)`
- Commit: `42926b02`

### Task 3 — Verification gate
`npm run check` (biome check + tsc) exits 0 — GREEN. No `any` casts on parent access.
The green tsc proves the Task 1 widening flows to the component. Verification-only; no commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing node_modules for the check gate**
- **Found during:** Task 3
- **Issue:** The worktree had no `node_modules`, so `biome: command not found` — the check gate could not run. Not a package install (no new deps), so no human-verify checkpoint needed.
- **Fix:** Symlinked the main checkout's `taskflow/node_modules` into the worktree (`ln -s`). The symlink lives under `taskflow/node_modules` which is gitignored, so it is never committed (confirmed by clean `git status`).
- **Files modified:** none (symlink only; gitignored)
- **Commit:** n/a (no code change)

## Threat Model Coverage
- T-ugr-02 (mitigate): issuetype + status typed optional and rendered conditionally — graceful fallback (no icon / no pill), no crash on absent nested fields. Implemented.
- T-ugr-01 (accept) / T-ugr-SC (mitigate, no installs): no action needed.

## Self-Check: PASSED
- FOUND: taskflow/src/services/jira.ts
- FOUND: taskflow/src/routes/dashboard/IssueDetailContent.tsx
- FOUND commit: ecc595af
- FOUND commit: 42926b02
- npm run check: exit 0 (GREEN)
- No `any` casts on parent.fields access
