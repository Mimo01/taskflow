# Quick Task 261102-fy2: Polish standup notes page - Summary

**One-liner:** Standup page now shows a trailing status pill on every Jira issue row (Yesterday + Today), uses one density scale for all rows/gaps, and is rem-sized throughout.

## Commits

| Task | Commit | Description |
| ---- | ------ | ----------- |
| 1 | d21511ef | `fetchIssueMeta` requests/maps status (main + parent follow-up); `buildGroups` threads status onto groups and sub-task groups; issue-meta staleTime 1h -> 5m; markdown unchanged (tested) |
| 2 | 2e1895d5 | Click-through `statusPillClass` pill in Yesterday headers/sub-task headers; Today IssueRow trailing cluster; new IssueActivityGroup tests; TodayColumn heading/pill test fix |
| 3 | b87c5dce | Unified row padding scale, density-aware group/section gaps, header fixes, container-query for the progress slot |

## Screenshots (`.planning/quick/261102-fy2-polish-standup-notes-page-density-text-s/screenshots/`)

compact-sm, compact-xl, default-sm, default-md, default-xl, comfortable-sm, comfortable-xl, default-md-dark, narrow-900-default-md, extreme-700-default-md (window 700px, see deviations). All inspected: every row is one line, pills right-aligned and not clipped, summaries ellipsise before pills, row heights/gaps change per density, text and icons scale with font scale.

## Deviations from Plan

1. **[Rule 1 - layout] SP/progress slots reserved per section, not always.** Plan said fixed-width slots always. Always reserving a 9rem progress slot starved summaries ("Checkout re...") when most rows had no estimate. Now slots are reserved only if some row in that section has points/estimate (alignment preserved within a section). Progress bar narrowed w-20 -> w-14 and slot is w-36.
2. **[Rule 1 - layout] Progress slot hidden below a 32rem container (`@container` on TodayColumn root, `@[32rem]:flex`).** At ~350px columns the trailing cluster overflowed horizontally. At 900px window width (450px columns) it renders cleanly. At an extreme 700px window the longest status names ("Selected for Development", "Ready for Release") on indented sub-task rows still slightly overflow; no min window width is configured in Tauri (default 1100). Left as-is; screenshot `extreme-700-default-md.png` documents it.
3. **SP chip shows the bare number** (BacklogRow chip style, `w-7`) instead of "N pts", per plan item 3.
4. **StandaloneMrGroup `dense` prop removed** - after unifying the padding scale it had no effect (all callers just stopped passing it).
5. StandupPageHeader screenshot not taken (needs queries via WatchedPersonPicker); change there is only `shrink-0 gap-4` / `min-w-0`.
6. The CONTEXT/RESEARCH files were not committed on the base commit; read from the main checkout. Red/green was committed as one commit per task (pre-commit hook), tests were written alongside implementation.

## Verification

Full vitest suite (270 files / 4172 tests), tsc and biome passed via pre-commit on tasks 1-3 commits. Preview harness (`src/__preview`, `standup-preview.html`) deleted, vite stopped. `grep` for px sizes lists only `CachedAvatar size={20}` usages (rem-mapped internally).

## Known Stubs

None.

## Self-Check: PASSED
