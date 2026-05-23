# Quick Task 260323-gog: Release detail page — match Jira tasks with GitLab MRs - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Task Boundary

Show Jira tasks in the release detail page. Match each Jira task to its GitLab merge request in the matched milestone. Flag tasks missing MRs and MRs not linked to any Jira task. Progress based on Jira issue statuses.

</domain>

<decisions>
## Implementation Decisions

### Task List Layout
- Claude's discretion — user open to either table or cards

### Matching Strategy
- Claude's discretion — reuse existing linkEngine patterns (ticket key in MR title/branch), optionally extend

### Missing MR Indicators
- Inline warning badges: orange ⚠ badge for Jira tasks missing an MR
- Separate bottom section for unmatched MRs: blue ℹ badge with "MRs in milestone not linked to Jira"

### Claude's Discretion
- Layout format (table vs cards vs hybrid)
- Whether to also scan commit messages for matching (title/branch may suffice)

</decisions>

<specifics>
## Specific Ideas

- Progress bar should be based on Jira issue statuses (done count / total count), already partially implemented
- Reuse `linkMRToTask` from linkEngine.ts for matching MR → Jira issue key
- Need to fetch: issues with `fixVersion = {versionId}` AND MRs from the matched GitLab milestone
- GitLab API: `GET /projects/:id/merge_requests?milestone=:title` to get MRs in a milestone

</specifics>

<canonical_refs>
## Canonical References

- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` — current release detail page
- `taskflow/src/services/linkEngine.ts` — MR ↔ Jira issue matching logic
- `taskflow/src/services/releaseLinker.ts` — GitLab milestone ↔ Jira fix version matching
- `taskflow/src/services/gitlab.ts` — GitLab API service (MRs, milestones)
- `taskflow/src/services/jira.ts` — Jira API service (fix versions, issue search)

</canonical_refs>
