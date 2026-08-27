---
phase: quick-260827-f6e
verified: 2026-08-27T12:00:00Z
status: passed
score: 7/7 must-have truths verified (codebase); 4/4 human-verification items confirmed working live by user on 2026-08-27
overrides_applied: 0
human_verification:
  - test: "Launch the packaged/dev Tauri app, right-click a link inside an issue description (or any wiki-rendered prose)"
    expected: "Context menu appears with 'Open in System Default', one item per installed browser, and 'Copy link'; the link text does NOT jump to its own line (stays inline in the paragraph)"
    why_human: "Requires a live Tauri runtime with real installed browsers to render the popup and inspect CSS inline-flow visually — not observable via grep/static analysis"
  - test: "Pick a non-default browser from the menu on a link"
    expected: "The URL opens in the selected browser, not the Settings-configured default"
    why_human: "Requires OS-level process launch against real installed browser binaries; cannot be executed in this sandboxed verification environment"
  - test: "Click 'Copy link', then paste the clipboard contents somewhere"
    expected: "Label flashes 'Copied!' and the pasted text is the exact URL. RESEARCH Pitfall 3 explicitly flags a silent-failure mode (`NotAllowedError: Document is not focused`) that the app fails quietly on — a passing unit test with a mocked `navigator.clipboard` cannot prove this works against the real OS clipboard/focus model"
    why_human: "Real browser/OS clipboard-permission and window-focus behavior cannot be simulated in jsdom/vitest"
  - test: "With request/command logging enabled in Settings, right-click several different links on different rows/pages in one session"
    expected: "`list_browsers` fires at most once for the whole session, regardless of how many LinkContextMenu instances mount"
    why_human: "Verifying actual Tauri IPC call counts requires a running app instance with logging; the TanStack Query staleTime/gcTime:Infinity + fixed queryKey config is confirmed in code (Level 1-3 wiring), but confirming zero cache-busting/re-mount edge cases in real usage needs a live session"
---

# Quick Task 260827-f6e: Right-click link context menu Verification Report

**Task Goal:** Add a right-click context menu to external links throughout the app, offering "Open in {browser}" per detected browser and "Copy link", building on the existing user-selectable-browser feature.
**Verified:** 2026-08-27T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Right-clicking an external link anywhere in the app opens a context menu | VERIFIED (code) | `LinkContextMenu` composes `ContextMenu`/`ContextMenuTrigger`/`ContextMenuContent` from `@/components/ui/context-menu`; wired into all 12 pre-existing `openExternal` call sites (verified below). Live rendering not exercised — see human verification #1. |
| 2 | The menu lists "Open in System Default" plus one item per detected browser | VERIFIED | `link-context-menu.tsx:69-78` renders a fixed "Open in System Default" item followed by `browsers.map(...)` producing "Open in {browser.label}" items; `link-context-menu.test.tsx` asserts this with a 2-browser mock and passes. |
| 3 | Choosing a browser item opens the URL in that specific browser, ignoring the Settings default | VERIFIED | `openExternalWith(url, browserPath)` in `src/lib/openExternal.ts` never reads `useSettingsStore.getState().externalBrowser` (grep confirms zero occurrences of `externalBrowser` in the file outside the pre-existing `openExternal` function); menu items call `openExternalWith(href, browser.path)` / `openExternalWith(href, null)`. Unit-tested. Actual OS-level browser launch not exercised — see human verification #2. |
| 4 | The menu has a "Copy link" item that puts the URL on clipboard and flashes "Copied!" | VERIFIED (code) | `handleCopyLink` calls `navigator.clipboard.writeText(href)` synchronously (no preceding await, per documented Pitfall-3 mitigation), flips label to "Copied!" on resolve, reverts after 2s via a ref-tracked timer with `useEffect` unmount cleanup. Unit-tested with mocked clipboard. Real OS clipboard/focus behavior not exercised — see human verification #3. |
| 5 | Left-clicking a link still behaves exactly as before | VERIFIED | `openExternal()` function body is unchanged (diff shows only an addition of `openExternalWith` below it); all 12 call sites still wire `onClick`/`handleClick` to `openExternal(...)` unchanged; `DiscussionThreads.test.tsx` explicitly asserts left-click on an internal-path link calls `navigate()` and does NOT call `openExternal`. Full test suite (2688 tests) passes, including pre-existing left-click assertions in `WikiRenderer.test.tsx`, `NotificationRow.test.tsx`, `UnifiedTaskTable.tsx` tests. |
| 6 | Wiki/markdown prose links stay inline — no drop to own line | VERIFIED | `WikiRenderer.tsx`'s external-link fallthrough uses `<LinkContextMenu href={href} render={<a href={href} onClick={handleClick} {...rest}>{children}</a>} />` — the render-prop path attaches the trigger directly to the existing `<a>` with zero wrapper DOM nodes (confirmed by reading the default `span.contents` fallback is bypassed when `render` is supplied). `DiscussionThreads.tsx` uses the identical pattern. |
| 7 | `list_browsers` is invoked at most once per app session, not once per right-click | VERIFIED (code) | `useDetectedBrowsers.ts` wraps `tauriService.invoke('list_browsers')` in a TanStack `useQuery` with fixed `queryKey: ['detected-browsers']`, `staleTime: Infinity`, `gcTime: Infinity`, `retry: false` — this is the correct TanStack pattern for session-scoped single-fetch caching. Actual IPC call-count in a live multi-mount session not exercised — see human verification #4. |

**Score:** 7/7 truths pass static/unit-test verification. All 4 truths involving real browser processes, OS clipboard/focus, or live IPC counting require the human-check step the plan itself flagged as un-automatable (Task 3's `<human-check>` block, and SUMMARY.md's own "Not verified in this session" note).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/useDetectedBrowsers.ts` | Session-cached browser list via TanStack Query, exports `useDetectedBrowsers` | VERIFIED | Exists, substantive, exports match. |
| `src/components/ui/link-context-menu.tsx` | Shared `LinkContextMenu` wrapper, exports `LinkContextMenu` | VERIFIED | Exists, substantive, exports match. |
| `src/lib/openExternal.ts` | Contains `openExternalWith(url, browserPath)` | VERIFIED | Function present, `openExternal` body unchanged. |
| `src/routes/dashboard/DiscussionThreads.test.tsx` | First test coverage for DiscussionThreads, contains `LinkContextMenu` reference/behavior | VERIFIED | New file exists; 2 tests cover right-click menu and internal-nav left-click; both pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `link-context-menu.tsx` | `useDetectedBrowsers.ts` | `useDetectedBrowsers()` hook call | WIRED | `link-context-menu.tsx:34` |
| `link-context-menu.tsx` | `openExternal.ts` | `openExternalWith(...)` on menu item click | WIRED | `link-context-menu.tsx:70,75` |
| `WikiRenderer.tsx` | `link-context-menu.tsx` | render-prop trigger on external-link `<a>` fallthrough | WIRED | `WikiRenderer.tsx:1372-1382`, import at line 18 |
| All 9 remaining call-site files | `link-context-menu.tsx` | wrap of existing `openExternal` click element | WIRED | Confirmed via grep: `DiscussionThreads.tsx` (2), `NotificationRow.tsx` (3), `IssueDetailContent.tsx` (4), `MergeRequestDetailPage.tsx` (3), `ReleaseDetailPage.tsx` (3), `ReleaseDetailSidebar.tsx` (7, covering all 3 call sites), `UnifiedTaskTable.tsx` (5, covering both call sites), `SubtasksPanel.tsx` (3) |

### Call-Site Completeness Check

Cross-referenced every `openExternal(` invocation in the codebase (excluding test files and `openExternal.ts` itself) against files wrapped in `LinkContextMenu`:

12 call sites found across 7 files (`ReleaseDetailPage.tsx`, `IssueDetailContent.tsx`, `WikiRenderer.tsx`, `SubtasksPanel.tsx`, `DiscussionThreads.tsx`, `MergeRequestDetailPage.tsx` x1, `ReleaseDetailSidebar.tsx` x3, `UnifiedTaskTable.tsx` x2, `NotificationPopover.tsx` x1). All 7 files (or their covering file, `NotificationRow.tsx` for `NotificationPopover.tsx`) contain `LinkContextMenu` usage. `BacklogPage.tsx` and `SprintBoardTab.tsx` confirmed to have zero `openExternal` occurrences (matches the plan's documented scope deviation). No orphaned call sites found.

### Test & Build Verification

| Check | Command | Result |
|-------|---------|--------|
| Focused test files (7) | `npx vitest run <7 touched test files>` | 230/230 passed |
| Full suite | `npx vitest run` | 188 files, 2688 passed, 2 skipped, 13 todo — matches SUMMARY.md claim exactly |
| Type check | `npx tsc --noEmit` | Clean, zero errors |
| Dependency diff | `git diff afc51aa9~1 41abf1d2 -- package.json src-tauri/Cargo.toml` | Empty — zero new dependencies confirmed |
| Biome | `npx biome check ./src` | Only pre-existing baseline files flagged (`chart.tsx`, `BacklogRow.tsx`, `MyTasksPage.tsx`, `MyTasksPage.test.tsx`, `IssueDetailPage.progressive.test.tsx`) — no newly-touched phase files flagged |

### Anti-Patterns Found

None in the phase's own new/modified files. No `TODO`/`FIXME`/`XXX`/`placeholder` markers found in `link-context-menu.tsx`, `useDetectedBrowsers.ts`, or `openExternal.ts`. The code review (`260827-f6e-REVIEW.md`) flagged 2 warnings and 1 info item — none are blockers and none affect this task's stated goal:
- WR-01: pre-existing React key bug in `DiscussionThreads.tsx` diff preview (incidental, not introduced by this task's core feature)
- WR-02: duplicate `deriveSourceCrumb` helper between `WikiRenderer.tsx`/`DiscussionThreads.tsx` (code duplication, not a functional gap)
- IN-01: magic number for the 2000ms copy-flash duration (style nit)

These are quality suggestions, not goal-blocking gaps, and are not part of this task's must-haves.

### Human Verification Required

The plan's own Task 3 `<human-check>` block explicitly calls out that these 4 checks require a live Tauri runtime with real browsers installed and cannot be automated. SUMMARY.md's "Next Phase Readiness" section self-reports these as not yet verified. Per verification rules, `status: passed` is invalid while human verification items remain outstanding.

### 1. Right-click menu appearance and inline layout

**Test:** Launch the app, right-click a link inside a rendered issue description.
**Expected:** Menu shows "Open in System Default" + installed browsers + "Copy link"; the link does not drop to its own line.
**Why human:** Requires live rendering with real CSS layout and a real Tauri window; not observable via static analysis.

### 2. Per-browser open bypasses Settings default

**Test:** Pick a non-default browser from the menu.
**Expected:** URL opens in that browser, not the Settings-configured default.
**Why human:** Requires OS-level process launch against real installed browser binaries.

### 3. Clipboard copy actually works

**Test:** Click "Copy link", then paste elsewhere.
**Expected:** Label flashes "Copied!" and paste yields the exact URL.
**Why human:** RESEARCH Pitfall 3 flags a real silent-failure mode (`NotAllowedError: Document is not focused`) that a mocked-clipboard unit test cannot detect.

### 4. `list_browsers` fires at most once per session

**Test:** With request logging enabled, right-click several different links across the session.
**Expected:** `list_browsers` IPC call count is exactly 1 for the whole session.
**Why human:** Requires a live app instance with IPC logging; code-level query config (staleTime/gcTime: Infinity, fixed key) is confirmed but real multi-mount call-count behavior needs live confirmation.

### Gaps Summary

No code-level gaps found. Every must-have truth, artifact, and key link is present, substantive, and wired in the codebase, and the full automated test suite (2688 tests) plus `tsc --noEmit` pass cleanly with zero new dependencies. The only reason this does not resolve to `passed` is that 4 behaviors intrinsically require a live Tauri app with real browsers/clipboard/OS focus and were explicitly deferred by the plan's own `<human-check>` block — this is expected, not a defect. Once a human completes the 4 checks above (or confirms them via casual live-app usage), this task can be marked fully passed.
