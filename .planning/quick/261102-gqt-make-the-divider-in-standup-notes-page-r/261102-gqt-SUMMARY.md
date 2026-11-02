# Quick 261102-gqt: Resizable Standup Notes divider Summary

The Yesterday/Today divider on Standup Notes is now draggable and keyboard-operable (arrows, Shift for bigger steps). It has 320px floors per pane, persists in the settings store, starts 50/50, and double-click resets it.

## Commits
- 92d3c889: useResizable `handleKeyDown` (16px step, 64px with Shift, direction-aware, clamped); `standupYesterdayWidth` setting; persist v33 migration
- be93f5b2: `StandupSplit` component (role=separator, aria-valuenow, hover/focus ring); StandupNotesPage wired to it (no `w-1/2` left)

## Deviations
- [Rule 1] Existing settings.store test asserted `version: 32`; updated it to 33 and added a `version < 33` check.
- `StandupSplit` uses `offsetWidth || 960` (not `??`) for the max fallback, so a 0-width container (jsdom) does not drive max negative.
- Setup only: symlinked node_modules from the main checkout.

## Verification
Full vitest suite, tsc and biome passed via the pre-commit hook. Manual app check from the plan not run.

## Self-Check: PASSED
