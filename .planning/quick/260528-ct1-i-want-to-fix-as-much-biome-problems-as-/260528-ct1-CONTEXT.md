# Quick Task 260528-ct1: I want to fix as much biome problems as possible - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Task Boundary

Fix all 49 remaining Biome a11y warnings in `taskflow/src`. Current breakdown:
- 12 `noLabelWithoutControl` — labels without associated form controls
- 11 `useSemanticElements` — divs/spans with roles that should be semantic HTML
- 10 `useKeyWithClickEvents` — onClick without keyboard equivalents
- 7 `useButtonType` — `<button>` missing explicit `type` attribute
- 5 `noStaticElementInteractions` — static elements with event handlers but no role/keyboard
- 2 `useAriaPropsSupportedByRole` — aria props not supported by the element's role
- 2 `noSvgWithoutTitle` — `<svg>` missing `<title>` element

</domain>

<decisions>
## Implementation Decisions

### noLabelWithoutControl (12 warnings)
- Fix properly: add `htmlFor`/`id` pairing or wrap content in `<label>` — correct a11y fix

### useKeyWithClickEvents + noStaticElementInteractions (15 warnings)
- Add `onKeyDown` handlers (Enter/Space/Escape as appropriate) — real a11y improvement
- For complex interactive elements (lightboxes, overlays), add role + tabIndex alongside keyboard handlers

### useSemanticElements (11 warnings)
- Change to semantic HTML elements (e.g. `<div role="banner">` → `<header>`, `<div role="article">` → `<article>`)

### useButtonType (7 warnings)
- Add `type="button"` (or `type="submit"` where appropriate) to every `<button>` missing it

### useAriaPropsSupportedByRole + noSvgWithoutTitle (4 warnings)
- Claude's Discretion: fix using standard patterns (remove invalid aria props; add `<title>` to SVGs)

</decisions>

<specifics>
## Specific Ideas

- All fixes are in `taskflow/src/` — the app lives in the `taskflow/` subdirectory
- Run `npm run check` from `taskflow/` to verify progress
- Target: 0 Biome warnings after fixes

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
