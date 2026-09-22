# Quick Task 260922-irb: on sprint board page, the goal and filters on top are not sticky, make them also sticky. The filter is visually fine, but I dont like how the goal looks. Also I dont see the name of the current sprint anywhere on this page. Make it onverall nicer and more polished - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Task Boundary

On the Sprint Board page:
- Make the sprint goal + filters bar sticky (currently scrolls away)
- Restyle the sprint goal — current look is disliked
- Surface the current sprint's name somewhere on the page (currently missing)
- General polish pass on this header area

</domain>

<decisions>
## Implementation Decisions

### Sticky header
- Sticky bar with the goal visually de-emphasized relative to filters/sprint name. Filters stay as-is visually (user said they're fine) but must be part of the sticky region.

### Sprint name display
- Claude's Discretion — pick placement/treatment (heading vs inline) based on existing layout and component patterns.

### Goal restyle
- Claude's Discretion — inspect current styling and choose a polished, de-emphasized treatment (quiet/subtle or a light card/pill) consistent with existing design tokens.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches, guided by the decisions above.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
