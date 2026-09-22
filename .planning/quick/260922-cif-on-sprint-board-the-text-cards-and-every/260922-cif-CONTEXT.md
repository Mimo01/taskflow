# Quick Task 260922-cif: On sprint board, the text, cards and everything is too large even on compact view. Make it more compact and fit better onto the screen - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Task Boundary

Sprint board (`src/routes/dashboard/SprintBoardTab.tsx`) card and text sizing is too large in compact density mode. Tighten sizing so more cards/content fit on screen without cutting content.

</domain>

<decisions>
## Implementation Decisions

### Density target
- Aggressive density in compact mode: smaller fonts, tighter padding, shorter row/card heights — prioritize fitting more on screen over breathing room.

### Scope (density modes affected)
- Claude's discretion: apply tightening to the `density-compact:` variant only. The app already has a `density-compact:` / `density-comfortable:` Tailwind variant system (see `SprintBoardTab.tsx` uses like `min-h-[80px] density-compact:min-h-[56px] density-comfortable:min-h-[96px]`). Default/comfortable mode should NOT shrink — the user explicitly complained about compact view specifically, implying normal view sizing is fine as-is.

### Card content
- Just shrink existing elements (font size, padding, gaps, min-heights) — do not hide/drop any fields, badges, or avatars in compact mode.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Reduce `density-compact:` values for font sizes, padding (`p-2`/`p-1`), gaps, min-heights, and any other size-affecting classes on sprint board cards and column headers.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
