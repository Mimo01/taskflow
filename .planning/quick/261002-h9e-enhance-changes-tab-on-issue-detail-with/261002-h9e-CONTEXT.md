# Quick Task 261002-h9e: Enhance Changes tab on issue detail with side-by-side old vs new diffs - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Task Boundary

Rework how Jira changelog entries render in the issue detail Activity timeline (Changes filter).
Today `taskflow/src/routes/dashboard/issue-detail/ChangelogEntry.tsx` renders every item as one
sentence: "Alice changed Description from <whole old text> to <whole new text>". Replace with
field-type-aware rendering. Data source: `ChangelogHistory` in `taskflow/src/services/jira-changelog.ts`
(items have field, fieldtype, from/fromString, to/toString). Rendered from `ActivityTimeline.tsx`.

</domain>

<decisions>
## Implementation Decisions

### Long-text fields (Description, Summary, Environment, other multi-line/long custom text)
- Side-by-side word diff: two columns "Before | After"; removed words highlighted red in Before, added words green in After.
- Collapsed by default behind a "Show changes (+N / −M words)" toggle, with a one-line preview when collapsed.
- Columns stack vertically at narrow widths.
- Classify "long text" by field name allowlist (description, summary, environment) OR value length/newlines heuristic.

### Short single-value fields (Status, Priority, Assignee, Story Points, Sprint when single, etc.)
- Old → New chips: old value muted + strikethrough, arrow, new value.
- Status uses the existing `statusPillClass` pills (remember: pill needs a flex parent — see memory statuspill-needs-flex-parent).
- Null side rendered as ∅ (set/cleared cases).

### Multi-value fields (Labels, Components, Fix Version(s), Version, Sprint lists, Watchers-style comma lists)
- Show added tokens (+, green) and removed tokens (−, red) rather than two full lists.
- Note: Jira often emits one item per added/removed value for Fix Version/Component (from=null or to=null); Labels/Sprint come as space/comma-separated full lists — diff the token sets.

### Group burst edits
- Consecutive change histories by the same author within ~5 minutes (with no other timeline entry type between them) merge into one block: single author header + timestamp, all items listed.
- Grouping must be a pure, unit-tested function.

### Field icons + aligned layout
- Each item row: fixed-width field label column (small lucide icon + field name) then the value rendering. One row = one line for short/multi fields (user preference: no second line for compact rows).

### Claude's Discretion
- Diff algorithm/library choice (prefer the small `diff` npm package's diffWords if not already present, or a tiny LCS implementation).
- Exact icon mapping, color tokens (use existing theme tokens, colour = status/semantic only), threshold values.
- Filter-by-field was explicitly NOT selected — out of scope.

</decisions>

<specifics>
## Specific Ideas

Mockup chosen for long text:
```
Alice updated Description          2h ago
▸ Show changes (+12 / −4 words)
┌─ Before ────────────┬─ After ─────────────┐
│ Login fails when    │ Login fails when    │
│ [-token-] expires   │ {+session+} expires │
│ after 5 min.        │ after 5 min {+on +} │
│                     │ {+iOS only.+}       │
└─────────────────────┴─────────────────────┘
```
Mockup chosen for short fields:
```
Alice  Status   [To Do] → [In Progress]
       Priority ~~Minor~~ → Must
       Assignee  ∅ → Bob
```

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above. Relevant project memories:
statusPillClass needs flex parent; italic text clipped by truncate (pr-0.5); one row = one line;
Tailwind v4 space-y vs negative margins; pre-commit hook runs full vitest (combine RED/GREEN).

</canonical_refs>
