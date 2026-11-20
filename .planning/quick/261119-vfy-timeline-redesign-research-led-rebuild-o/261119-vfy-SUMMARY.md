# Quick Task 261119-vfy: Simplified Logs timeline - Summary

Logs -> Timeline rebuilt as a page-load waterfall (name | bar | duration rows, loads newest first, sticky one-line headers, newest open), and the old lane/burst/zoom/strip/cache-lane machinery plus query-activity capture deleted.

## Commits
- 712827e3 feat: pure load model (`lib/dev-tools/timeline-loads.ts`) + 37 unit tests
- 076c7536 feat: new `LogsTimeline`, `loadOpen` store record, LogsTab/DevToolsPage wiring, component tests
- 765caf25 refactor: deleted old timeline code, query-activity store/hook/diffing, `timelineBarClass`

## Verification
- `tsc --noEmit` clean; full `npm test`: 486 files passed, 7168 tests passed.
- Biome check clean on all touched files (no `--write` outside the touched files).
- Deletion grep returned nothing. Pre-delete grep showed only the expected consumers (main.tsx mount, `timelineBarClass` definition).

## Decisions
- No virtualization: closed loads render only a header, bars are percent-positioned, and a 1000-row test guards the worst case. Non-pending loads receive `load.doneEnd` as `now`, so they do not change between ticks.
- `loadOpen` is a record (not a set) so explicitly closing the newest load is representable.

## Deviations
1. [Rule 3] Removed the `useQueryActivityStore.clear()` calls in LogsTab and DevToolsPage, and the two query-activity Clear tests in DevToolsPage.test.tsx, in Task 2 rather than Task 3. The plan said to leave them for Task 3, but the Task 2 commit had to stay green and consistent with the new Clear handler. The store itself was still deleted in Task 3.
2. Biome `--write` was run on the six touched Task 2 files and the two new Task 1 files only (formatting).
3. Renamed the DevToolsPage.test describe block to "waterfall and header".
4. Test-side only: my first assertion expected a '500 ms' span; the real span is 150 ms; fixed the test.

## Visual check
Not done. No screenshot of the running app or a rendered preview could be produced in this environment, so the match with `timeline-mockup.html` was checked by structure and class names only (grid `minmax(11rem,30%) 1fr 4.5rem`, 32px sticky headers, 26px rows, status text only when not OK, tick labels only when open). A real-app look before UAT is still needed.

## Known Stubs
None.

## Orchestrator follow-up (ed7cb3f6)

I rendered the timeline myself with a throwaway Vite page and headless Chromium, in light and dark, using sample loads. The result matches the mockup: name | bar | duration rows, sticky load headers, a faint lead-in for queue wait, and status shown only when not OK. Two issues came up and were fixed:
- Fallback labels showed raw path fragments ("17/merge_requests"). They now name the resource in words ("Merge requests", "Remotelink · PROJ-1"). Tests were updated first and failed before the fix.
- The load's start time wrapped to two lines. It now grows leftwards with nowrap.
