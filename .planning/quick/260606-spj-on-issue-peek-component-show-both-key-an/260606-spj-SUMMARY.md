---
phase: quick-260606-spj
plan: "01"
subsystem: peek-panel
tags: [peek, issue-detail, merge-requests, header, react-query]
dependency_graph:
  requires: []
  provides: [useLinkedMRs hook, PeekPanel header redesign, single-column MR bottom placement]
  affects: [PeekPanel, IssueDetailSidebar, IssueDetailView]
tech_stack:
  added: []
  patterns: [TanStack Query deduplication, hook extraction, omit-prop gating]
key_files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts
  modified:
    - taskflow/src/components/app/PeekPanel.tsx
    - taskflow/src/components/app/PeekPanel.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
decisions:
  - "Kept header in PeekPanel (not IssueDetailView) so Close/Open controls remain visible during loading — avoids early-return skeleton hiding controls"
  - "useQuery in PeekPanel uses same key ['jira-issue-detail', issueKey, jiraBaseUrl] as IssueDetailView — TanStack Query dedupes, zero extra fetch"
  - "Extracted useLinkedMRs hook so both IssueDetailSidebar (two-column) and IssueDetailView single-column bottom slot share one cached fetch"
  - "omitMergeRequests={layout==='single-column'} gates the sidebar MR section; two-column path unchanged"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-06"
  tasks_completed: 3
  files_changed: 5
---

# Phase quick-260606-spj Plan 01: Peek header icon+key+title redesign and MR reposition Summary

**One-liner:** Peek header redesigned with IssueTypeIcon+key+truncated title via deduped useQuery; MR section extracted to useLinkedMRs hook and moved to the bottom of single-column peek below description/activity.

## What Was Built

### Task 1: PeekPanel header redesign with deduped issue read

`PeekPanel.tsx` now issues a `useQuery` with the same key `['jira-issue-detail', issueKey, jiraBaseUrl]` as `IssueDetailView` — TanStack Query dedupes the request so there is no extra network fetch.

Header layout:
- Left side (`min-w-0 flex-1`): `IssueTypeIcon` (renders after load) + key badge (`shrink-0`, always visible) + title `<span className="truncate pr-0.5">` (renders after load)
- Right side (`shrink-0`): Open full page (ExternalLink) + Close (X, aria-label "Close preview") — always visible, even during loading

The `min-w-0 flex-1` parent prevents the 0-width flex pitfall; `pr-0.5` guards the italic/overhang truncate-clip pitfall. While `issue` is undefined (loading), only the key and controls show.

### Task 2: useLinkedMRs hook + MR repositioned to single-column bottom

New file `useLinkedMRs.ts` extracts the `gitlab-project-mrs` query and client-side `issueKey` filter from `IssueDetailSidebar`. The hook is called from both:
- `IssueDetailSidebar` (replaces inlined query; `omitMergeRequests` prop gates the render)
- `IssueDetailView` top-level (feeds the single-column bottom slot)

`IssueDetailView` passes `omitMergeRequests={layout === 'single-column'}` to `sidebarNode` — two-column keeps MR in the sidebar exactly as before. The single-column branch now renders `<MergeRequestsSection>` at the bottom of the content block (after `activitySectionNode`).

### Task 3: PeekPanel test updates

Added mocks for `@tanstack/react-query` (useQuery returns `{data: undefined, isLoading: false}`), `auth.store`, `settings.store`, `stronghold`, and `jira` so the new imports resolve without live infrastructure. All 7 PEEK tests pass.

## Verification

- `npm run check` (biome + tsc): PASSED (465 files clean)
- `npm test` (vitest): 1883 tests passed, 0 failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Format] Biome import order and formatter violations in PeekPanel.tsx and IssueDetailSidebar.tsx**
- **Found during:** Task 2 verification (`npm run check`)
- **Issue:** Biome flagged import ordering (IssueDetailView import must come before service imports per path-sort rules) and two formatter issues (multiline JSX expression should be inline; useAuthStore destructure should be on one line)
- **Fix:** Reordered PeekPanel imports to put `@/routes/...` before `@/services/...`; collapsed the JSX conditional and destructure to match Biome's expected format
- **Files modified:** `PeekPanel.tsx`, `IssueDetailSidebar.tsx`

## Known Stubs

None — no placeholder data, hardcoded empty values, or TODO markers in modified files.

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary changes introduced.

## Self-Check

- [x] `taskflow/src/routes/dashboard/issue-detail/useLinkedMRs.ts` — FOUND
- [x] `taskflow/src/components/app/PeekPanel.tsx` — FOUND
- [x] `taskflow/src/components/app/PeekPanel.test.tsx` — FOUND
- [x] `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` — FOUND
- [x] `taskflow/src/routes/dashboard/IssueDetailView.tsx` — FOUND
- [x] Commit cea77481 (Task 1) — FOUND
- [x] Commit 51fa5933 (Task 2) — FOUND
- [x] Commit 817914bc (Task 3) — FOUND

## Self-Check: PASSED
