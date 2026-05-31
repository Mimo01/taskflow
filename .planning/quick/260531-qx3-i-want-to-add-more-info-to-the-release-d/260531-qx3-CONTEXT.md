# Quick Task 260531-qx3: Add more info to the release detail page - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Task Boundary

Add more information to the release detail page (`taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`), surfacing data already available from the Jira FixVersion / GitLab milestone / MR data but not currently displayed.

</domain>

<decisions>
## Implementation Decisions

### What to add (locked)
Add exactly these three info groups. Do NOT add the milestone timeline (start_date→due_date / merge-time) group — it was explicitly NOT selected.

1. **MR state distribution** — a compact summary of the milestone's MRs by state, e.g. "X merged · Y open · Z closed". Parallels the existing issue progress bar. Use `Badge` tones (green=merged, blue=opened, gray=closed).
2. **Contributor list** — aggregated unique MR authors in the milestone (e.g. "N contributors") shown as a group of `CachedAvatar`s with names. Reuse the existing CachedAvatar component.
3. **Issue breakdown / effort** — richer issue stats beyond the current done/total: issue status distribution (e.g. new / in progress / done) and, when populated, story points total vs. completed (Jira `customfield_10016`).

### Placement
- **Claude's discretion, per info group.** Decide the best location for each piece individually — compact stats fit the right metadata sidebar (MetaRow / small badges), richer breakdowns (e.g. contributor avatars, status distribution) may warrant a small section in the main left column. Match existing density and patterns; don't overcrowd the sidebar.

### Missing data
- **Hide gracefully.** Only render a field/section when its underlying data exists. No empty rows, "—" placeholders, or zero-states. If no GitLab milestone matched → omit MR-derived sections. If story points absent → omit the effort line but still show issue status distribution.

</decisions>

<specifics>
## Specific Ideas

Reuse existing components and patterns already in `ReleaseDetailPage.tsx`:
- `MetaRow` (label + value) for sidebar additions
- `Badge` with `tone`/`variant` for state-count summaries
- `CachedAvatar` for contributor aggregation
- `Progress` bar pattern (mirrors existing done/total bar) for status distribution if useful
- lucide-react icons consistent with existing usage (GitMerge, Users, etc.)

Data sources already available in the page's loaded data:
- GitLab MR details: `state`, `author`, `merged_at`, etc. (used for unmatched-MRs / labels today)
- Jira issues: `status`, and `customfield_10016` (story points) on issue detail

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Implementation must conform to the existing `ReleaseDetailPage.tsx` structure and the project's Biome/tsc clean baseline (`npm run check`).

</canonical_refs>
