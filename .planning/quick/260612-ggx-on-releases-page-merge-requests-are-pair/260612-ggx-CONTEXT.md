# Quick Task 260612-ggx: Warn when a task's MR is not in the release's milestone - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Task Boundary

On the Releases page, merge requests are paired to tasks based on milestone. Today the
page fetches MRs that ARE in the release's matched GitLab milestone and links them to Jira
issues by ticket key — so a task's linked MR is always in the right milestone by
construction. A task with no MR in that milestone simply shows the existing "Missing MR"
indicator.

Add a NEW warning that distinguishes a genuinely missing MR from the case where the task
DOES have a merge request, but that MR is not assigned to the release's milestone (a
different milestone, or no milestone at all).
</domain>

<decisions>
## Implementation Decisions

### Warning location
- Show in BOTH places:
  - **Release detail page** (`ReleaseDetailPage.tsx`): a per-task row indicator in the
    issues table, alongside / replacing the existing "Missing MR" indicator
    (~lines 812–859). This is the precise, primary surface.
  - **Releases list view** (`ReleasesTab.tsx`): a summary badge on the release card/row
    indicating ≥1 task has an MR on the wrong milestone, consistent with the existing
    Badge warning patterns (tone="orange"/"red").

### Trigger condition
- Warn when the task's MR is assigned to a **different milestone OR has no milestone at
  all** — i.e. any MR linked to the task (by ticket key) that is not in the release's
  matched milestone. Matches the literal request: "doesn't have the milestone the release
  is for."

### MR states checked
- Check **all states** (opened, merged, closed). A merged MR on the wrong milestone is
  still a release-accuracy problem.

### Data source / fetch strategy
- **Per task, only when missing.** Only do the broader (cross-milestone) MR lookup for a
  task when that task has NO MR in the release's milestone (i.e. the current "Missing MR"
  case). Tasks that already have an in-milestone MR are correct and need no extra fetch.
- For each such task, search the project's MRs by the task's ticket key (project-scoped,
  all states) and check whether any returned MR's milestone differs from (or is absent
  vs.) the release's milestone. Prefer a project-scoped MR search
  (`/projects/:id/merge_requests?search=<key>&in=title&state=all`) over the existing
  global `searchGitLabMRs` (which is open-only, cross-project, capped at 20). Reuse the
  existing ticket-key linking logic (`linkEngine.linkMRToTask` / `extractTicketKeys`).

### Claude's Discretion
- Exact wording/icon/tone of the new indicator (keep consistent with existing
  `AlertTriangle` + orange "Missing MR" styling and the `Badge` tone conventions).
- Tooltip copy (should name the MR's actual milestone, e.g. "MR !123 is on milestone X,
  not this release").
- Caching/query-key shape for the per-task MR lookups (follow existing react-query
  patterns and staleTime used by the milestone-MR query).
</decisions>

<specifics>
## Specific Ideas

- Existing precise surfaces to extend:
  - `ReleaseDetailPage.tsx` ~812–859: per-row MR cell with the "Missing MR" `AlertTriangle`
    branch — the new state ("MR exists, wrong milestone") slots in here.
  - `ReleasesTab.tsx` ~347–400: existing warning Badges (tone orange/red) — add the
    summary badge here.
  - Milestone-MR query: `ReleaseDetailPage.tsx` ~318–351 (`fetchMilestoneMRs`,
    `linkMRToTask`, `releaseMrByIssue`, `matchedRows`).
- Ticket-key linking helpers: `services/linkEngine.ts` (`linkMRToTask`, `extractTicketKeys`).
- MR shape has `milestone: { id: number; title: string } | null` — compare against the
  release's matched milestone (`matchedMilestone`, id/title).
</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.
</canonical_refs>

<open_tensions>
## Tension to reconcile in planning

"Both locations" + "per-task-if-missing" fetch: the detail page only runs per-task lookups
for the single release being viewed (cheap — only for its missing-MR tasks). The list view
shows multiple releases; running per-task lookups for every release's missing-MR tasks
could be costly. Planner should pick a sensible strategy — e.g. compute the summary badge
from the same per-task check but bounded to the releases actually rendered in the list, lazy
/ on-visible, and gracefully degrade (no badge) when data isn't loaded — rather than
eagerly fanning out unbounded GitLab calls. Detail-page row is the primary, must-have
surface; the list badge is the secondary surface and must not regress list-view performance.
</open_tensions>
