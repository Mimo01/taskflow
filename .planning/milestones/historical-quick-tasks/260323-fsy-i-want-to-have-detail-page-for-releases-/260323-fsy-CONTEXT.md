# Quick Task 260323-fsy: Release Detail Page with Edit — Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Task Boundary

Create a detail page for releases. On the release detail page, users should be able to edit the release (name, date, description, status).

</domain>

<decisions>
## Implementation Decisions

### Edit Scope
- Editable fields: name, release date, description, and released/unreleased status toggle
- Uses Jira fix version update API

### Page Layout
- Claude's discretion — will choose based on content density and consistency with existing detail pages

### Navigation Flow
- Row click in the releases table navigates to the release detail page
- Breadcrumb navigation for returning to releases list

### Claude's Discretion
- Layout style (two-column vs single-column) — will match existing patterns where appropriate

</decisions>

<specifics>
## Specific Ideas

- Follow existing IssueDetailPage/MergeRequestDetailPage patterns for consistency
- Use React Query for data fetching and cache invalidation after edits
- Integrate with breadcrumb store for navigation trail
- Route pattern: `/release/:versionId`

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
