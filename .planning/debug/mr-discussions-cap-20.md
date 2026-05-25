---
slug: mr-discussions-cap-20
status: resolved
trigger: "On merge request detail the discussions are capped at 20. When there are more, they are silently not shown"
created: 2026-05-25
updated: 2026-05-25
---

# MR Detail Discussions Capped at 20

## Symptoms

<!-- DATA_START -->
- **Expected behavior:** All discussions on a merge request detail view should be shown
- **Actual behavior:** Only 20 discussions are shown; additional discussions are silently dropped
- **Error messages:** None (silent truncation)
- **Timeline:** Not specified
- **Reproduction:** Open a merge request with more than 20 discussions
<!-- DATA_END -->

## Current Focus

- hypothesis: resolved
- test: n/a
- expecting: n/a
- next_action: none — fix applied

## Evidence

- timestamp: 2026-05-25
  file: taskflow/src/services/gitlab.ts
  lines: 496-530 (original)
  observation: fetchMRDiscussions built URL with no per_page parameter — GitLab defaults to 20 per page. No pagination loop existed; only the first page was ever fetched and returned.

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
  lines: 122-131
  observation: Render layer passes discussions array directly with no slice or limit. Cap is entirely in the fetch layer.

- timestamp: 2026-05-25
  observation: All other paginated calls in gitlab.ts (fetchMilestones, fetchMRsForMilestone, etc.) use per_page=100 with a while-loop + page++ pattern. fetchMRDiscussions was the only endpoint missing this.

## Eliminated

- Render layer cap: MergeRequestDetailPage.tsx passes full discussions array to DiscussionThreads with no slice
- API error suppression: response errors are thrown, not swallowed; the issue is purely missing pagination

## Resolution

- root_cause: fetchMRDiscussions called the GitLab /discussions endpoint without a per_page parameter, causing GitLab to apply its default limit of 20. No pagination loop was implemented, so only the first page (up to 20 discussions) was ever returned.
- fix: Replaced single-fetch implementation with a paginated while-loop using per_page=100 and page increment, matching the pattern used by fetchMilestones and fetchMRsForMilestone. Fix applied to taskflow/src/services/gitlab.ts lines 496-542.
- fix_type: fetch-layer pagination
- cycles: 1 investigation + 1 fix
