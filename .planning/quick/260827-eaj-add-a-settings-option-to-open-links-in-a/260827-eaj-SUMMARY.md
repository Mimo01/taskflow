---
phase: quick-260827-eaj
plan: 01
subsystem: settings, external-link-opening
tags: [tauri, opener-plugin, settings-store, browser-detection]
dependency-graph:
  requires: []
  provides:
    - "src/lib/openExternal.ts: single sanctioned external-URL boundary (openExternal fn)"
    - "list_browsers Tauri command: filesystem-based browser detection"
    - "externalBrowser persisted setting (store version 29)"
  affects:
    - "All 12 pre-existing external-link click sites now route through openExternal"
tech-stack:
  added: []
  patterns:
    - "Choke-point pattern: only openExternal.ts and AttachmentsSection.tsx import @tauri-apps/plugin-opener"
    - "Path::exists() filesystem probing for cross-platform browser detection (no subprocess, no new crate)"
    - "Scoped opener:allow-open-url capability additive to opener:default"
key-files:
  created:
    - taskflow/src/lib/openExternal.ts
    - taskflow/src/lib/openExternal.test.ts
    - taskflow/src/routes/settings/LinksSection.tsx
    - taskflow/src/routes/settings/LinksSection.test.tsx
  modified:
    - taskflow/src-tauri/src/lib.rs
    - taskflow/src-tauri/capabilities/default.json
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/settings.store.test.ts
    - taskflow/src/routes/dashboard/WikiRenderer.tsx
    - taskflow/src/routes/dashboard/DiscussionThreads.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/SubtasksPanel.tsx
    - taskflow/src/routes/dashboard/SubtasksPanel.test.tsx
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/settings/Settings.tsx
decisions:
  - "openExternal accepts an optional onFallbackFailed callback (backward-compatible extra param) so SubtasksPanel can add its window.open rung as a third fallback without leaking openUrl back out of the choke point — explicitly authorized by the plan's 'adjust the panel, not the test' guidance"
  - "Settings-store test mocks that call getState() imperatively (IssueDetailSheet.test.tsx, SubtasksPanel.test.tsx) needed a getState() static added to their vi.mock stand-in, since openExternal reads the preference via useSettingsStore.getState() for non-React call sites"
metrics:
  duration: ~55min
  completed: 2026-08-27
---

# Quick Task 260827-eaj: Add a settings option to open links in a user-selectable browser Summary

Added a Links section to Settings with a cross-platform browser picker (System Default + every detected browser via filesystem probing), routed all 12 existing external-link call sites through a single `openExternal()` choke point that silently falls back to the OS default browser, and widened the Tauri opener capability scope to permit launching a non-default browser.

## What was built

**Task 1 — Backend browser detection + capability scope** (`275f2687`)
- `list_browsers` Tauri command in `src-tauri/src/lib.rs`: detects installed browsers via `Path::exists()` only (no subprocess, no new crate) across macOS (`/Applications` + `~/Applications`), Windows (`%ProgramFiles%`/`%ProgramFiles(x86)%`/`%LOCALAPPDATA%`), and Linux (`$PATH` scan). Returns an empty `Vec<BrowserInfo>` on no matches — never errors.
- `capabilities/default.json`: added an additive `opener:allow-open-url` scope (`{ "url": "http://*", "app": true }` + https variant) alongside the existing `opener:default`, so a non-default `openUrl(url, appPath)` call no longer resolves to `Application::Default` and gets silently rejected.

**Task 2 — openExternal choke point + 12 call-site migration** (`5a03826a`)
- `src/lib/openExternal.ts`: reads `useSettingsStore.getState().externalBrowser` imperatively, tries the selected browser first (if any), falls back to the OS default, and never rejects. Accepts an optional `onFallbackFailed` callback for one additional caller-owned fallback rung.
- `settings.store.ts`: added `externalBrowser: string | null` + `setExternalBrowser`, bumped persist version 28 → 29 with a migrate branch.
- Migrated all 12 `openUrl(` call sites across 9 files (WikiRenderer, DiscussionThreads, IssueDetailContent, ReleaseDetailPage, SubtasksPanel, MergeRequestDetailPage, ReleaseDetailSidebar ×3, UnifiedTaskTable ×2, NotificationPopover) to `openExternal(`.
- 4 behavior tests for `openExternal` (null preference, selected preference, fallback-on-failure, no-retry-on-null-failure) — all pass.

**Task 3 — Links settings section** (`059eda30`)
- `LinksSection.tsx`: fetches `list_browsers` via `tauriService.invoke` on mount, renders a shadcn `Select` with "System Default" (mapped to `null` via a `__default__` sentinel) plus every detected browser. If the persisted `externalBrowser` path isn't in the fetched list, an extra "(basename) (not found)" option keeps the Select honest without auto-clearing the setting.
- Wired into `Settings.tsx`: new `'links'` section between Appearance and Sidebar, using the `ExternalLink` icon (distinct from `Link2` used by Connections).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SubtasksPanel's window.open fallback needed a signal from openExternal since it never rejects**
- **Found during:** Task 2
- **Issue:** `SubtasksPanel.test.tsx` mocks `openUrl` to always reject, expecting the panel's try/catch to fall through to `window.open`. Since `openExternal` swallows all rejections (per the locked "fail quietly" decision), the panel's catch would never fire.
- **Fix:** Added an optional `onFallbackFailed?: () => void` parameter to `openExternal` (backward-compatible — all other 8 call sites pass none) that fires only when the final default-browser `openUrl` attempt also fails. `SubtasksPanel.tsx`'s `openJiraIssue` passes a callback that calls `window.open(...)`, preserving the three-rung chain (selected browser → default browser → `window.open`) exactly as the plan's Task 2 action text explicitly authorized ("adjust the panel, not the test").
- **Files modified:** `src/lib/openExternal.ts`, `src/routes/dashboard/SubtasksPanel.tsx`
- **Commit:** `5a03826a`

**2. [Rule 1 - Bug] Two existing test files' settings-store mocks lacked `getState()`, breaking `openExternal`'s imperative read**
- **Found during:** Task 2 (running `npx vitest run` for the full dashboard/notifications/stores suite)
- **Issue:** `IssueDetailSheet.test.tsx` and `SubtasksPanel.test.tsx` each mock `@/stores/settings.store` as a plain callable (`useSettingsStore: vi.fn(() => ({...}))`) with no `.getState` static. `openExternal` calls `useSettingsStore.getState()` for non-React call sites, which threw `TypeError: useSettingsStore.getState is not a function` when a mocked test clicked an "open in browser" affordance.
- **Fix:** Added a `getState: () => state` static to both mocks' `useSettingsStore` stand-ins (mirroring the pattern already used in `UpdatesSection.test.tsx`), plus `externalBrowser: null` in each mock's state object.
- **Files modified:** `src/routes/dashboard/IssueDetailSheet.test.tsx`, `src/routes/dashboard/SubtasksPanel.test.tsx`
- **Commit:** `5a03826a`

**3. [Rule 1 - Bug] settings.store.test.ts's hardcoded version-28 smoke test needed updating for the version 29 bump**
- **Found during:** Task 2
- **Issue:** A source-string assertion test (`persist version is 28 (v28 migration smoke...)`) reads `settings.store.ts` and asserts `version === 28`. Bumping to 29 for `externalBrowser` broke this test by design (it's meant to catch exactly this kind of drift).
- **Fix:** Updated the test to assert 29 with an updated description, and added a new `externalBrowser defaults to null` assertion.
- **Files modified:** `src/stores/settings.store.test.ts`
- **Commit:** `5a03826a`

No architectural deviations (Rule 4) were needed.

## Verification

- `cd taskflow/src-tauri && cargo check` — passes, no new warnings.
- `cd taskflow && npx vitest run` — full suite green: 186 test files passed (2 skipped), 2669 tests passed (2 skipped, 13 todo).
- `cd taskflow && npx tsc --noEmit` — clean.
- `cd taskflow && npx biome check ./src` — no NEW diagnostics beyond the documented pre-existing baseline (chart.tsx, BacklogRow.tsx, MyTasksPage.tsx/.test.tsx, IssueDetailPage.progressive.test.tsx); all touched files individually clean.
- Grep gate: only `src/lib/openExternal.ts` and `src/routes/dashboard/issue-detail/AttachmentsSection.tsx` (openPath, out of scope) import `@tauri-apps/plugin-opener` in non-test code.

## Known Gaps

The plan's Task 3 `<human-check>` step (launch `npm run tauri dev`, manually pick a non-default browser, click an "open in browser" button and a description/comment link, verify the URL opens in the selected browser rather than the OS default, restart to confirm persistence, switch back to System Default) was **not performed** — this execution environment has no interactive desktop session to run the Tauri dev build and click through the UI. This is the single most important manual check per the plan (RESEARCH pitfall 1: a missing/misconfigured capability scope makes the feature silently no-op with zero automated signal). Automated coverage (cargo check, capability-file grep, unit tests, tsc, biome) all pass, but the capability scope's actual runtime effect on a live Tauri webview is unverified. Recommend running the 5-step manual UAT from Task 3's `<human-check>` before considering this feature fully verified.

## Self-Check: PASSED

All 8 key files confirmed present on disk (`ls` verification). All 3 task commits (`275f2687`, `5a03826a`, `059eda30`) confirmed present in `git log`.
