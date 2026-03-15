---
phase: 09-custom-field-discovery-issue-detail-foundation
plan: "04"
subsystem: ui
tags: [react, shadcn-sheet, tanstack-query, tdd, issue-detail, wiki-markup, skeleton]

# Dependency graph
requires:
  - phase: 09-custom-field-discovery-issue-detail-foundation
    provides: fetchIssueDetail from jira.ts (plan 09-02)
  - phase: 09-custom-field-discovery-issue-detail-foundation
    provides: WikiRenderer component (plan 09-03)
  - phase: 09-custom-field-discovery-issue-detail-foundation
    provides: settings store with epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, storyPointsFieldKey (plan 09-02)
provides:
  - IssueDetailSheet: controlled Sheet slide-over container with fetch + skeleton
  - IssueDetailContent: left column (title, WikiRenderer description, subtask list)
  - IssueDetailSidebar: right column (all metadata fields + linked issues)
  - skeleton.tsx UI component (created as missing dependency)
affects:
  - 09-05 (comment thread added to IssueDetailContent)
  - 09-06 (inline field editing added)
  - 09-07 (comment posting added)
  - 09-08 (nested sheet navigation using onOpenIssue)

# Tech tracking
tech-stack:
  added:
    - "skeleton.tsx: custom Skeleton UI component (animate-pulse + bg-accent)"
  patterns:
    - "IssueDetailSheet controlled pattern: open={issueKey !== null}; onOpenChange={(open) => { if (!open) onClose() }}"
    - "useQuery queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] — independent per-issue cache"
    - "Sprint field guard: typeof rawSprint === 'string' ? rawSprint : Array.isArray(rawSprint) ? find(active) : null"
    - "Linked issue label: link.inwardIssue ? link.type.inward : link.type.outward"
    - "Subtask click-through: onOpenIssue prop passes subtask key to parent for nested sheet navigation"

key-files:
  created:
    - taskflow/src/routes/dashboard/IssueDetailSheet.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
    - taskflow/src/components/ui/skeleton.tsx
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx

key-decisions:
  - "Skeleton added as custom component (not shadcn CLI) because npx shadcn install was not available — standard shadcn skeleton pattern (animate-pulse + rounded-md)"
  - "data-testid added to skeleton div for testability — avoids relying on CSS class names or aria roles"
  - "IssueDetailBody split into separate internal component — prevents useQuery being called when issueKey is null (rules of hooks)"
  - "Test for onClose: uses Sheet's built-in close button (role=button, name=/close/i) — avoids needing to simulate onOpenChange directly"

patterns-established:
  - "Controlled Sheet container pattern: IssueDetailSheet accepts issueKey|null, delegates body rendering to IssueDetailBody (internal) only when non-null"
  - "MetaRow helper: label (w-24 fixed) + children layout for sidebar metadata rows"

requirements-completed: [ISSUE-01, ISSUE-03, ISSUE-05, ISSUE-06]

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 9 Plan 04: IssueDetailSheet Foundation Summary

**Three-component issue detail layout: IssueDetailSheet (Sheet slide-over with useQuery fetch + skeleton), IssueDetailContent (title + WikiRenderer description + subtask list), IssueDetailSidebar (all metadata fields + linked issues with inward/outward labels)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T22:45:38Z
- **Completed:** 2026-03-13T22:49:25Z
- **Tasks:** 2 (TDD: RED + GREEN each)
- **Files modified:** 5 (3 created components + 1 UI component + 1 test file)

## Accomplishments

- IssueDetailSheet opens/closes based on `issueKey` prop; fetches via `useQuery(['jira-issue-detail', issueKey, jiraBaseUrl])` with `staleTime: 30s`; shows skeleton while loading
- IssueDetailContent renders issue title + description through WikiRenderer + subtask list where each row shows key + summary + status badge; clicking calls `onOpenIssue`
- IssueDetailSidebar renders all 9 metadata fields (status, priority, assignee, reporter, story points, epic, sprint, labels, fix versions, dates) and linked issues with inward/outward type labels
- All ISSUE-01, ISSUE-05, ISSUE-06 tests implemented and green (7 of 7 pass)
- skeleton.tsx added as missing dependency (Rule 3 auto-fix)

## Task Commits

1. **TDD RED: IssueDetailSheet tests** - `0cdc5c4` (test)
2. **TDD GREEN: Three component files** - `c384ab0` (feat)

_Note: TDD tasks have two commits (test → feat). No refactor needed._

## Files Created/Modified

- `taskflow/src/routes/dashboard/IssueDetailSheet.tsx` — controlled Sheet container; IssueDetailBody internal component (splitout for hooks rules); IssueDetailSkeleton with data-testid
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` — left column: title, WikiRenderer description, subtask list with onOpenIssue click-through
- `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` — right column: MetaRow layout helper; sprint field guard for array/string/null; inward/outward linked issue rendering
- `taskflow/src/components/ui/skeleton.tsx` — standard shadcn skeleton pattern (auto-added as missing dependency)
- `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` — ISSUE-01/05/06 tests replacing wave-0 todo stubs

## Decisions Made

- Skeleton created manually (standard shadcn pattern) since `npx shadcn add skeleton` was unavailable in the execution environment — functionally identical
- `IssueDetailBody` split as internal component: required to avoid `useQuery` being called unconditionally when `issueKey` is null (React rules of hooks)
- `data-testid="issue-detail-skeleton"` added to skeleton div for reliable test assertions without relying on CSS class names
- Test for ISSUE-01 "closes" asserts via Sheet's built-in close button (role=button, name=/close/i) which triggers onOpenChange → onClose

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing Dependency] Created skeleton.tsx manually**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** `@/components/ui/skeleton` import in IssueDetailSheet.tsx would fail — skeleton.tsx not present in ui components directory
- **Fix:** Created `taskflow/src/components/ui/skeleton.tsx` using standard shadcn skeleton pattern (animate-pulse + bg-accent + rounded-md)
- **Files modified:** `taskflow/src/components/ui/skeleton.tsx`
- **Commit:** `0cdc5c4`

**2. [Rule 1 - Bug] Fixed test assertions to match actual component structure**
- **Found during:** Task 1 (first GREEN run)
- **Issue:** Test used `findByTestId('sheet-open')` (non-existent) and `require()` (ESM incompatible)
- **Fix:** Updated tests to use `data-testid="issue-detail-skeleton"` (skeleton is rendered while loading) and converted to async import
- **Files modified:** `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx`
- **Commit:** `c384ab0`

## Issues Encountered

Pre-existing test failures in `MyTasksTab.test.tsx`, `ReleasesTab.test.tsx`, and `SubtasksPanel.test.tsx` are out of scope — these are future plans (09-05 through 09-07) as documented in 09-03 SUMMARY.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- IssueDetailSheet is ready to receive inline field editing (plan 09-06)
- IssueDetailContent comment section placeholder (`<section id="comments-section" />`) ready for plan 09-07
- `onOpenIssue` prop threading is in place for nested sheet navigation (plan 09-08)
- No blockers

## Self-Check: PASSED

- FOUND: `taskflow/src/routes/dashboard/IssueDetailSheet.tsx`
- FOUND: `taskflow/src/routes/dashboard/IssueDetailContent.tsx`
- FOUND: `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx`
- FOUND: `taskflow/src/components/ui/skeleton.tsx`
- FOUND commit: `0cdc5c4` (test RED)
- FOUND commit: `c384ab0` (feat GREEN)
