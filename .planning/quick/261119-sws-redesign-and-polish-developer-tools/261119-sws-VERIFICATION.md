---
phase: quick-261119-sws
verified: 2026-11-19
status: human_needed
score: 7/7 must-haves verified (code level); visual polish pending human eye
human_verification:
  - test: "Open Developer Tools at several window widths"
    expected: "Page fills the viewport, only list and inspector panes scroll, header and tab bar stay fixed, no stray page scrollbar"
    why_human: "Layout and scrolling behaviour is not checkable by grep"
  - test: "Drag the inspector resize handle on all four tabs"
    expected: "Smooth resize, min 320px, width persists across tab switches, handle is subtle and not misaligned"
    why_human: "Interactive pointer behaviour and visual feel"
  - test: "Logs tab with live traffic: filters, Pause/Resume, arrow-key navigation, Copy as cURL"
    expected: "Rows stay one line, selection scrolls into view, 'Paused · N new' counts correctly, pasted cURL works after exporting tokens"
    why_human: "Real clipboard and live data flow"
  - test: "Cache tab while navigating the app"
    expected: "Rows update live without flicker or lag, Refetch/Invalidate/Reset/Remove act on the selected query only"
    why_human: "Live behaviour and performance feel"
  - test: "Settings gear popover"
    expected: "Popover opens and is aligned, toggles and the retention Select work, and the Select shows its label rather than a raw value"
    why_human: "Visual check of popover and Select rendering"
---

# Quick 261119-sws: Developer Tools redesign Verification

**Goal:** Redesign Developer Tools: Logs split-pane, Cache inspector replacing Operations and Waterfall, Notifications and Editor on the list + inspector pattern, full-width PageHeader shell with settings popover and counts.
**Status:** human_needed. All automated checks pass and no gaps were found.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Full-viewport shell under a standard PageHeader (no subtitle) | VERIFIED | DevToolsPage.tsx uses `flex h-full min-h-0 flex-col` and `PageHeader title="Developer Tools"`. Each TabsContent is `flex min-h-0 flex-1 flex-col`. |
| 2 | Tabs are Logs, Cache, Notifications, Editor with counts; Operations/Waterfall gone everywhere | VERIFIED | The four TabsTriggers use aria-hidden counts. The grep for `operationProfiling\|performanceWaterfall\|operation-profiler` in src hits only settings.store.ts:552-553 (v40 migration). Operations/Waterfall/OperationCard/WaterfallBar/DevToolsSettings files and routes/debug-logs are gone. DebugModeSection has no profil/waterfall mentions. |
| 3 | Gear popover with master, logging, body capture and retention; header Clear all | VERIFIED | DevToolsSettingsPopover.tsx has the `aria-label="Developer Tools settings"` trigger, three Switches, a Select with `items`, and "Applies to new entries." DevToolsPage.handleClear clears all three stores plus the pause snapshot. |
| 4 | Logs split pane: filters, pause, clear, stats, Headers/Request/Response/Timing, Copy URL/cURL/response, keyboard | VERIFIED | LogsTab has 4 FilterPopovers, Pause/Resume with "Paused · N new", Clear, computeLogStats and useListKeyboard (ArrowUp/ArrowDown/Escape). LogInspector has the four sub-tabs and the Copy buttons, with buildCurl wired. curl.ts emits $JIRA_TOKEN/$GITLAB_TOKEN placeholders and drops cookie headers. |
| 5 | Cache tab lists live queries with search and state filter, with row actions, and works when capture is off | VERIFIED | useQueryCacheRows subscribes to getQueryCache() through useSyncExternalStore with a 250ms coalesce and a 1s tick. CacheInspector has Refetch/Invalidate/Reset/Remove/Copy key/Copy data, all scoped `{queryKey, exact: true}`. Remove is disabled while observers > 0, and client.clear() is not used. CacheTab has no devToolsEnabled gate. |
| 6 | Notifications and Editor use the same layout with filters; inspectors keep the diff, outline, banner preview and raw items | VERIFIED | Both import ListInspectorLayout and useListKeyboard. entry-filters.ts and its tests exist. Their tests pass. |
| 7 | Profiler recording removed; settings v40 deletes the two keys | VERIFIED | Persist `version: 40`, with `if (version < 40)` deleting both keys. |

## Spot checks

- `npx vitest run src/routes/dev-tools src/lib/dev-tools`: 10 files, 67 tests passed.
- `npx tsc --noEmit`: clean.
- Debt markers (TBD/FIXME/XXX) in the dev-tools paths: none.
- The summary's full-suite and biome claims were not re-run, per instruction.

## Deviation note

The executor updated two settings.store.test.ts regexes from 39 to 40. This is a legitimate consequence of the version bump, not a test bend.

## Human verification required

See the frontmatter. The items cover visual layout, resize feel, live behaviour of Logs and Cache, and popover rendering.

## Gaps

None.
