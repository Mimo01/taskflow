---
status: complete
---
# Quick 261103-kn9: Release detail Progress slot, empty state for future releases

Done inline after the user rejected two designs: 261103-jqy (release train) and 261103-kbn (empty burnup frame).

- When there is too little history for the burnup (a future release, or one whose window opened today), the Progress slot shows the shared `EmptyState` (compact, `py-0`) with a CalendarClock icon, "No burnup yet", and either "It starts when <prev> ships on <date>." or "It appears after the first day of the release window." The wording was changed at UAT because issues can be done before the chart has history.
- The header aside reads "after <prev>" while the window hasn't opened, otherwise "since <prev>".
- Removed: `ReleaseTimeline` (old track) and `deriveBurnupFrame`, together with their tests. `releaseBurnup.ts` and `ReleaseBurnup.tsx` are restored to their state before 843129a1, so the real burnup is unchanged.
- `EmptyState` gains an optional `className`.
- Checked by screenshot at 260/420px, light and dark. The full test suite passed in the pre-commit hook.

Commits: a78fce15, 4be089b5
