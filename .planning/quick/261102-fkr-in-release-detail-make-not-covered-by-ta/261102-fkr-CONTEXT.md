# Quick Task 261102-fkr: Release detail "Not covered by tasks above" nicer + more info - Context

**Gathered:** 2026-11-02
**Status:** Ready for planning

<domain>
## Task Boundary

In the release detail page (`taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx`, secondary section ~L1191, `SecondaryHeaderStrip`, `MrSubLine`), make the "Not covered by tasks above" section nicer and show more info per MR row.

</domain>

<decisions>
## Implementation Decisions

### Row info (user-selected)
- Show MR author (avatar/name) and reviewers.
- Show MR state + draft badge (Open / Draft / Merged / Closed).
- NOT selected: source→target branches, labels, updated date (do not add).

### Section presentation (user-selected)
- Header with count + reason summary: h4 plus count and chips such as "N no linked task · M not in fix version".
- Rows get a reason pill instead of the bare key glyph.

### Claude's Discretion
Exact styling, column widths, narrow-width behavior (follow container-query conventions in file).

</decisions>

<specifics>
## Specific Ideas

Project prefs (memory): one row = one line at every density (drop columns rather than stack); avatar never drops at narrow width; reuse existing CachedAvatar / statusPillClass-style patterns (pill needs flex parent); container queries never style the container itself; no '+N more' caps on pills; data on GitLabMR (`author`, `reviewers`, `state`, `draft`) already present — no new fetches. Keep existing data-testids (secondary-section, secondary-key-*, drift-row) and the test that `secondaryRows: []` renders no section.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
