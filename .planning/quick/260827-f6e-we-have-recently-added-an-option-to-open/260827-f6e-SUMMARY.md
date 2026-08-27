---
phase: quick-260827-f6e
plan: 01
subsystem: ui
tags: [react, tanstack-query, base-ui, context-menu, tauri, clipboard]

requires:
  - phase: quick-260827-eaj
    provides: openExternal(url) sanctioned boundary, list_browsers Tauri command, BrowserInfo shape, Settings → Links default-browser preference
provides:
  - openExternalWith(url, browserPath) explicit per-link browser override that bypasses the Settings default
  - useDetectedBrowsers() session-cached (staleTime/gcTime Infinity) TanStack Query wrapper over list_browsers
  - Shared LinkContextMenu component (right-click menu: System Default + per-browser + Copy link)
  - Every existing openExternal call site (12 of 12) wrapped in a right-click LinkContextMenu
affects: [wiki-renderer, discussion-threads, notifications, issue-detail, mr-detail, release-detail]

tech-stack:
  added: []
  patterns:
    - "base-ui render prop: `<LinkContextMenu render={<a .../>}>` clones props onto an existing element with no wrapper DOM node — used wherever a wrapper would break inline flow or CR-05 pointer-events layering"
    - "base-ui render prop default: `<LinkContextMenu href={url}>{children}</LinkContextMenu>` renders a `span.contents` trigger — used for plain button/row wraps where no box-model side effect matters"
    - "Session-scoped TanStack Query cache (staleTime/gcTime: Infinity, fixed queryKey) as the pattern for any Tauri command that should fire at most once per app session across many mounted consumers"

key-files:
  created:
    - src/lib/useDetectedBrowsers.ts
    - src/components/ui/link-context-menu.tsx
    - src/components/ui/link-context-menu.test.tsx
    - src/routes/dashboard/DiscussionThreads.test.tsx
  modified:
    - src/lib/openExternal.ts
    - src/lib/openExternal.test.ts
    - src/routes/dashboard/WikiRenderer.tsx
    - src/routes/dashboard/WikiRenderer.test.tsx
    - src/routes/dashboard/DiscussionThreads.tsx
    - src/routes/notifications/NotificationRow.tsx
    - src/routes/notifications/NotificationRow.test.tsx
    - src/routes/notifications/NotificationPopover.test.tsx
    - src/routes/dashboard/IssueDetailContent.tsx
    - src/routes/dashboard/MergeRequestDetailPage.tsx
    - src/routes/dashboard/ReleaseDetailPage.tsx
    - src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - src/routes/dashboard/SubtasksPanel.tsx

key-decisions:
  - "base-ui's evaluateRenderProp merges render-element's own props (including children) over the Trigger's computed props for all non-event/style/className keys — confirmed empirically, so `render={<a>{children}</a>}` needs no `children` prop on LinkContextMenu itself"
  - "closeOnClick={false} on the Copy link ContextMenuItem — base-ui's default closeOnClick=true would unmount the popup before the 'Copied!' flash could render"
  - "UnifiedTaskTable's CR-05 pointer-events-sensitive mr-cell-link uses the render-prop wrap (no wrapper element) rather than the default span.contents wrap, to stay conservative about the documented pointer-events inheritance hazard"
  - "ReleaseDetailPage's 'Open in Jira' button only wraps in LinkContextMenu when jiraVersionUrl is non-null (mirrors the existing handleOpenInJira null-guard) rather than passing an empty-string href"
  - "SubtasksPanel wraps every row unconditionally, even when onIssueClick overrides the left-click path to open an in-app peek sheet instead of the browser — right-click always offers the Jira browse link since it is a real, valid URL regardless of what left-click does"
  - "Stubbed @/lib/useDetectedBrowsers in 5 pre-existing test files (WikiRenderer, NotificationRow, NotificationPopover, ReleaseDetailSidebar) rather than retrofitting QueryClientProvider onto every bare render() call — LinkContextMenu now mounts unconditionally on external links in those trees"

requirements-completed: [LINKCTX-01, LINKCTX-02, LINKCTX-03]

duration: ~55min
completed: 2026-08-27
---

# Quick Task 260827-f6e: Right-click link context menu Summary

**Right-click context menu on every external link (wiki prose, discussions, notifications, and 9 button/row call sites) offering per-browser open + Copy link, built on a session-cached `useDetectedBrowsers` hook and a new `openExternalWith` explicit-browser boundary that never touches the Settings default.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files modified/created:** 19 (4 created, 15 modified)

## Accomplishments

- `openExternalWith(url, browserPath)` — new function in `src/lib/openExternal.ts`, fail-quiet like `openExternal`, deliberately bypasses `useSettingsStore.getState().externalBrowser`
- `useDetectedBrowsers()` — TanStack Query wrapper over `list_browsers`, `staleTime`/`gcTime: Infinity`, fires at most once per session regardless of how many `LinkContextMenu` instances mount
- `LinkContextMenu` — shared component composing the existing `context-menu.tsx` primitives; supports both a default `span.contents` trigger (children mode) and a render-prop trigger (zero wrapper elements) for inline-flow-sensitive call sites
- All 12 pre-existing `openExternal` call sites now carry the right-click menu: `WikiRenderer.tsx`, `DiscussionThreads.tsx` (+ new first-ever test file for that component), `NotificationRow.tsx` (covers `NotificationPopover.tsx`'s single site with no edit to that file), `IssueDetailContent.tsx`, `MergeRequestDetailPage.tsx`, `ReleaseDetailPage.tsx`, `ReleaseDetailSidebar.tsx` (×3), `UnifiedTaskTable.tsx` (×2), `SubtasksPanel.tsx`

## Task Commits

1. **Task 1: Build openExternalWith, useDetectedBrowsers, and the shared LinkContextMenu** - `afc51aa9` (feat)
2. **Task 2: Wire inline prose links and notification rows** - `17594bcf` (feat)
3. **Task 3: Wire the remaining button and row call sites** - `41abf1d2` (feat)

_All tasks were plain `type="auto"` (not TDD-gated at the plan level), though Task 1 and Task 2 carried `tdd="true"` and tests were written alongside the implementation in the same commit per the pre-commit-hook constraint (full vitest suite runs on every commit — see project memory "Pre-commit hook blocks RED commits")._

## Files Created/Modified

- `src/lib/openExternal.ts` — added `openExternalWith`, left `openExternal` byte-identical in body
- `src/lib/openExternal.test.ts` — added `openExternalWith` test suite (4 new tests)
- `src/lib/useDetectedBrowsers.ts` — new session-cached browser-list hook
- `src/components/ui/link-context-menu.tsx` — new shared `LinkContextMenu` component
- `src/components/ui/link-context-menu.test.tsx` — new test suite (7 tests)
- `src/routes/dashboard/WikiRenderer.tsx` — external-link fallthrough wrapped via render prop, still a single inline `<a>`
- `src/routes/dashboard/WikiRenderer.test.tsx` — 2 new tests + `useDetectedBrowsers` stub for the file's many bare `render()` calls
- `src/routes/dashboard/DiscussionThreads.tsx` — `useGitLabLinkComponents`'s `a` override wrapped the same way
- `src/routes/dashboard/DiscussionThreads.test.tsx` — new file, first test coverage for this component (2 tests: right-click menu, internal-nav left-click)
- `src/routes/notifications/NotificationRow.tsx` — open-in-browser `ActionIcon` wrapped in `LinkContextMenu`
- `src/routes/notifications/NotificationRow.test.tsx` — 2 new tests + `useDetectedBrowsers` stub
- `src/routes/notifications/NotificationPopover.test.tsx` — `useDetectedBrowsers` stub (no behavior change, only fixes a QueryClient-less render error introduced by the NotificationRow wrap)
- `src/routes/dashboard/IssueDetailContent.tsx` — "Open in Jira" segmented-control button wrapped
- `src/routes/dashboard/MergeRequestDetailPage.tsx` — "Open in GitLab" button wrapped
- `src/routes/dashboard/ReleaseDetailPage.tsx` — "Open in Jira" button wrapped, guarded by a new `jiraVersionUrl` computed value
- `src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` — exact/fuzzy GitLab milestone links + unlabeled-MR list-item link wrapped (3 sites)
- `src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` — `useDetectedBrowsers` stub
- `src/routes/dashboard/release-detail/UnifiedTaskTable.tsx` — `iidButton` (children wrap) and CR-05 `mr-cell-link` (render-prop wrap) wrapped
- `src/routes/dashboard/SubtasksPanel.tsx` — subtask row wrapped

## Decisions Made

See `key-decisions` in frontmatter. Most consequential: the base-ui render-prop children-merge behavior was verified empirically (via the passing "accepts a render prop" test) rather than assumed from documentation, since it determines whether `WikiRenderer`'s single-inline-`<a>` invariant holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `LinkContextMenu` import in `WikiRenderer.tsx`**
- **Found during:** Task 2, first test run after adding the JSX usage
- **Issue:** Used `<LinkContextMenu>` without importing it — `ReferenceError: LinkContextMenu is not defined` at render time
- **Fix:** Added the import
- **Files modified:** `src/routes/dashboard/WikiRenderer.tsx`
- **Verification:** `npx vitest run src/routes/dashboard/WikiRenderer.test.tsx` — all 150 tests pass
- **Committed in:** `17594bcf` (Task 2 commit)

**2. [Rule 1 - Bug] Copy link flash never appeared — popup closed on click**
- **Found during:** Task 1, `link-context-menu.test.tsx` first run
- **Issue:** base-ui `ContextMenuItem`'s default `closeOnClick={true}` unmounted the popup the instant "Copy link" was clicked, before the "Copied!" label could ever render or be observed
- **Fix:** Added `closeOnClick={false}` to the Copy link item only (the Open-in-* items keep the default close-on-select behavior)
- **Files modified:** `src/components/ui/link-context-menu.tsx`
- **Verification:** `npx vitest run src/components/ui/link-context-menu.test.tsx` — all 7 tests pass, including the fake-timer flash-and-revert test
- **Committed in:** `afc51aa9` (Task 1 commit)

**3. [Rule 1 - Bug] `LinkContextMenu` mounting broke 5 pre-existing test files that render without a `QueryClientProvider`**
- **Found during:** Task 2 and Task 3, full-suite runs after each file's wrap
- **Issue:** `LinkContextMenu` unconditionally calls `useDetectedBrowsers()` → `useQuery()`. Files whose external links now route through `LinkContextMenu` (`WikiRenderer.test.tsx`, `NotificationRow.test.tsx`, `NotificationPopover.test.tsx`, `ReleaseDetailSidebar.test.tsx`) have many pre-existing bare `render()` calls with no `QueryClientProvider` ancestor, throwing `Error: No QueryClient set, use QueryClientProvider to set one`
- **Fix:** Added `vi.mock('@/lib/useDetectedBrowsers', () => ({ useDetectedBrowsers: () => [] }))` to each of the 4 affected test files, rather than retrofitting a `QueryClientProvider` wrapper onto dozens of individual call sites across those files
- **Files modified:** `src/routes/dashboard/WikiRenderer.test.tsx`, `src/routes/notifications/NotificationRow.test.tsx`, `src/routes/notifications/NotificationPopover.test.tsx`, `src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx`
- **Verification:** `npx vitest run` — full suite green (2688 passed, 2 skipped, 13 todo)
- **Committed in:** `17594bcf` (WikiRenderer/NotificationRow/NotificationPopover), `41abf1d2` (ReleaseDetailSidebar)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs found via test-first development, 1 Rule 1 bug — broken pre-existing tests caused by this plan's own change)
**Impact on plan:** All three were necessary to reach a green test suite; none represent scope creep beyond what the plan's own tasks required.

## Issues Encountered

- The worktree's `taskflow/` subdirectory had no `node_modules` installed (only a `.vite` cache directory existed). Symlinked it from the main checkout's `taskflow/node_modules` (gitignored, not committed) to run `vitest`/`tsc`/`biome` locally. This is an environment-setup note, not a code change.

## User Setup Required

None — no external service configuration required. Zero new dependencies (confirmed: no changes to `package.json` or `src-tauri/Cargo.toml`).

## Next Phase Readiness

- Full `npx vitest run` (2688 passed), `npx tsc --noEmit` (clean), and `npx biome check ./src` (no NEW diagnostics beyond the documented baseline: `chart.tsx`, `BacklogPage.tsx`, `BacklogRow.tsx`, `MyTasksPage.tsx`, `MyTasksPage.test.tsx`, `IssueDetailPage.progressive.test.tsx`) all pass
- **Not verified in this session (requires a live Tauri app):** the Task 3 `<human-check>` steps — actually launching the packaged app, right-clicking a rendered link, confirming per-browser open behavior against real installed browsers, confirming an actual clipboard paste succeeds (RESEARCH Pitfall 3 flagged this as a silent-failure risk that specifically needs hand verification), and confirming `list_browsers` fires at most once per session via request logging. These are genuinely un-automatable from this environment (no Tauri runtime, no real browser installs to detect) and are the one item to close out before calling this fully done.

---

*Phase: quick-260827-f6e*
*Completed: 2026-08-27*
## Self-Check: PASSED
