---
phase: 39-update-ux-version-policy
verified: 2026-03-25T00:18:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "Trigger update available state in a real Tauri build and verify UpdateDialog renders correctly"
    expected: "Dialog appears with version info, rendered markdown changelog, Later and Update Now buttons"
    why_human: "Tauri IPC and plugin-updater cannot be exercised in Vitest; visual rendering of react-markdown requires real browser"
  - test: "Click Update Now and observe download progress bar animating"
    expected: "Progress bar fills with accurate percentage, Stop Download button visible, dialog is non-dismissable"
    why_human: "Real network download needed; progress event stream from plugin-updater cannot be simulated end-to-end"
  - test: "Let 10-second countdown reach zero and verify relaunch fires"
    expected: "App restarts, What's New dialog appears on relaunch with the changelog from the update"
    why_human: "invoke('plugin:process|relaunch') is a Tauri IPC call; cannot test without a real Tauri runtime"
  - test: "Set buildInfo.version below softMinimum in version-policy.json and verify SoftMinimumBanner appears"
    expected: "Banner visible below TopBar with warning icon, version message, Update Now and dismiss X buttons"
    why_human: "buildInfo.version is a build-time env var (APP_VERSION); requires a real build with a specific version string"
  - test: "Set buildInfo.version below hardMinimum and verify HardMinimumOverlay blocks all interaction"
    expected: "Fixed z-[200] overlay covers entire app, no dismiss, only Update Now button, clicking triggers update check"
    why_human: "Same build-time constraint as above; z-index layering requires visual inspection"
---

# Phase 39: Update UX + Version Policy Verification Report

**Phase Goal:** Users experience a complete update lifecycle — from notification through installation — and the app enforces minimum version requirements
**Verified:** 2026-03-25T00:18:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When update store status is 'available', a modal dialog shows current version, available version, rendered markdown changelog, and 'Update Now' / 'Later' buttons | VERIFIED | `UpdateDialog.tsx` lines 146-166: AvailableView renders DialogTitle "Update Available", DialogDescription with `v{buildInfo.version} → v{availableVersion}`, ReactMarkdown changelog, "Later" + "Update Now" buttons. Test `renders available view with version and changelog` passes. |
| 2 | Clicking 'Update Now' transitions the dialog to a download progress view with a progress bar and percentage | VERIFIED | `handleUpdateNow()` calls `setDownloading()` then `updaterService.downloadAndInstall()` with progress callback. DownloadingView renders `role="progressbar"` with `aria-valuenow`, percentage label. Test passes. |
| 3 | After download completes, a 10-second countdown shows before auto-restart, cancellable via 'Restart Later' | VERIFIED | `ReadyView` sub-component: `useState(10)`, `setInterval` decrementing every 1000ms, at `seconds <= 0` calls `invoke('plugin:process|relaunch')`. "Restart Later" stops countdown and calls `setAvailable()` to return to available view. Test passes. |
| 4 | On download error, dialog shows error message with 'Retry' and 'Dismiss' buttons | VERIFIED | `ErrorView` renders DialogTitle "Download Failed", DialogDescription with `text-destructive` class, "Dismiss" (outline, calls `resetToIdle`) + "Retry" (destructive, calls `handleUpdateNow`). Test passes. |
| 5 | On first launch after update (lastSeenVersion !== buildInfo.version), a 'What's New' dialog shows the changelog | VERIFIED | `WhatsNewDialog.tsx` line 27: `const open = lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null`. Renders "What's New in v{buildInfo.version}" with ReactMarkdown changelog. Test passes. |
| 6 | 'Got it' dismiss sets lastSeenVersion to current version so the dialog does not reappear | VERIFIED | `handleDismiss()` calls `setLastSeenVersion(buildInfo.version)`. Dialog open condition becomes false immediately. Test `'Got it' updates lastSeenVersion to current version` passes. |
| 7 | version-policy.json exists at repo root with softMinimum, hardMinimum, and optional message fields | VERIFIED | File exists at `/version-policy.json` with `{"softMinimum": "0.0.0", "hardMinimum": "0.0.0"}`. Safe defaults — no enforcement until manually bumped. |
| 8 | When current app version is below softMinimum, a persistent banner appears with warning icon, message, 'Update Now' button, and dismiss X | VERIFIED | `SoftMinimumBanner.tsx`: TriangleAlert icon, default message with version, "Update Now" (default variant) + X dismiss (ghost variant, sr-only label). Wired in main.tsx behind `softMinimumActive && !softNagDismissed && policy`. Tests pass. |
| 9 | Soft minimum banner is dismissible once per session (React useState, not persisted) and reappears on next launch | VERIFIED | `main.tsx` line 143: `const [softNagDismissed, setSoftNagDismissed] = useState(false)` — session-only, not in settings store. `onDismiss={() => setSoftNagDismissed(true)}`. Resets on next app start. |
| 10 | When current app version is below hardMinimum, a full-screen overlay blocks all app interaction with only an 'Update Now' button | VERIFIED | `HardMinimumOverlay.tsx`: `className="fixed inset-0 z-[200]"`, Lock icon, "Update Required" heading, no dismiss mechanism, single "Update Now" button. Wired as last element in AppLayout JSX. Tests pass. |
| 11 | When version-policy.json is unreachable (network error, 404, malformed JSON), no banner or overlay appears (fail-open) | VERIFIED | `fetchVersionPolicy()` returns null on any catch, non-ok response, or missing fields. `useVersionPolicyCheck()` defaults `policy = null`, both flags false when null. 5 dedicated tests covering all fail-open cases all pass. |
| 12 | Dev builds (version containing '-dev' or equal to '0.0.0-dev') skip policy enforcement entirely | VERIFIED | `isBelow()` line 46: `if (current.includes('-dev') || current === '0.0.0-dev') return false`. Tests `isBelow('0.0.0-dev', '1.0.0') returns false` and `isBelow('1.5.0-dev', '1.6.0') returns false` both pass. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/components/update/UpdateDialog.tsx` | Update lifecycle dialog with available/downloading/ready/error views | VERIFIED | Exports `UpdateDialog`, 228 lines, all four views present, uses `useUpdateStore`, `updaterService.downloadAndInstall`, `showCloseButton={false}`, `role="progressbar"`, `aria-live="polite"` |
| `taskflow/src/components/update/WhatsNewDialog.tsx` | Post-update changelog dialog | VERIFIED | Exports `WhatsNewDialog`, reads `lastSeenVersion`/`lastSeenChangelog` from settings store, `buildInfo.version` comparison, "Got it" button |
| `taskflow/src/stores/settings.store.ts` | lastSeenVersion and lastSeenChangelog fields with v11 migration | VERIFIED | `version: 11`, `lastSeenVersion: null`, `lastSeenChangelog: null`, `setLastSeenVersion`, `setLastSeenChangelog`, `if (version < 11)` migration block all present |
| `taskflow/src/services/versionPolicy.ts` | fetchVersionPolicy function and VersionPolicy type | VERIFIED | Exports `fetchVersionPolicy`, `isBelow`, `VersionPolicy`, uses `compareVersions`, multiple `return null` fail-open paths, `-dev` check |
| `taskflow/src/hooks/useVersionPolicyCheck.ts` | Hook that fetches policy and computes soft/hard enforcement state | VERIFIED | Exports `useVersionPolicyCheck`, computes `softMinimumActive` and `hardMinimumActive`, uses TanStack Query with `version-policy` query key, mirrors update polling interval |
| `taskflow/src/components/update/SoftMinimumBanner.tsx` | Dismissible nag banner for soft minimum violation | VERIFIED | Exports `SoftMinimumBanner`, `TriangleAlert`, "Update Now", sr-only "Dismiss update reminder", `policy.message` fallback |
| `taskflow/src/components/update/HardMinimumOverlay.tsx` | Full-screen blocking overlay for hard minimum violation | VERIFIED | Exports `HardMinimumOverlay`, `fixed inset-0 z-[200]`, "Update Required", `Lock`, `updaterService.check`, "Couldn't check for updates" error message |
| `version-policy.json` | Version policy definition file | VERIFIED | Exists at repo root with `softMinimum` and `hardMinimum` fields, safe defaults `"0.0.0"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `UpdateDialog.tsx` | `update.store.ts` | `useUpdateStore()` hook | WIRED | Line 27: `import { useUpdateStore }`, line 89: destructured in component body |
| `UpdateDialog.tsx` | `updater.ts` | `updaterService.downloadAndInstall` | WIRED | Line 29: `import { updaterService }`, line 117: called in `handleUpdateNow()` |
| `WhatsNewDialog.tsx` | `settings.store.ts` | `lastSeenVersion` comparison with `buildInfo.version` | WIRED | Line 21: `import { useSettingsStore }`, line 25: reads `lastSeenVersion`, `lastSeenChangelog`, `setLastSeenVersion` |
| `main.tsx` | `UpdateDialog.tsx` | mounted in AppLayout return JSX | WIRED | Line 33: `import { UpdateDialog }`, line 511: `<UpdateDialog />` |
| `main.tsx` | `WhatsNewDialog.tsx` | mounted in AppLayout return JSX | WIRED | Line 34: `import { WhatsNewDialog }`, line 512: `<WhatsNewDialog />` |
| `main.tsx` | `useUpdatePolling` | called in AppLayout body | WIRED | Line 29: `import { useUpdatePolling }`, line 438: `useUpdatePolling()` |
| `useVersionPolicyCheck.ts` | `versionPolicy.ts` | `fetchVersionPolicy` call | WIRED | Line 10: `import { fetchVersionPolicy, isBelow }`, line 28: called as `queryFn` |
| `main.tsx` | `SoftMinimumBanner.tsx` | conditionally rendered in AppLayout | WIRED | Line 32: `import { SoftMinimumBanner }`, lines 470-476: conditional `{softMinimumActive && !softNagDismissed && policy && <SoftMinimumBanner ... />}` |
| `main.tsx` | `HardMinimumOverlay.tsx` | last element in AppLayout (z-[200]) | WIRED | Line 31: `import { HardMinimumOverlay }`, line 513: `{hardMinimumActive && policy && <HardMinimumOverlay policy={policy} />}` |
| `main.tsx` | `useVersionPolicyCheck` | called in AppLayout body | WIRED | Line 30: `import { useVersionPolicyCheck }`, line 142: `const { softMinimumActive, hardMinimumActive, policy } = useVersionPolicyCheck()` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `UpdateDialog.tsx` | `status`, `availableVersion`, `changelog`, `downloadProgress`, `errorMessage` | `useUpdateStore()` — Zustand store populated by `updaterService` events from `useUpdatePolling` | Yes — store is set by `setAvailable()`, `setProgress()`, `setError()` triggered by real Tauri plugin events | FLOWING |
| `WhatsNewDialog.tsx` | `lastSeenVersion`, `lastSeenChangelog` | `useSettingsStore()` — persisted to `settings.json` via Tauri Store plugin | Yes — `lastSeenChangelog` written by `UpdateDialog` before relaunch via `setLastSeenChangelog(changelog)` | FLOWING |
| `SoftMinimumBanner.tsx` | `policy`, `softMinimumActive` | `useVersionPolicyCheck()` → `fetchVersionPolicy()` → HTTP fetch to remote URL | Yes — real HTTP fetch with JSON validation; safe defaults in `version-policy.json` prevent false positives | FLOWING |
| `HardMinimumOverlay.tsx` | `policy`, `hardMinimumActive` | same as above | Yes — same data pipeline | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 phase 39 test files pass | `npx vitest run src/components/update/UpdateDialog.test.tsx src/components/update/WhatsNewDialog.test.tsx src/services/versionPolicy.test.ts src/components/update/SoftMinimumBanner.test.tsx src/components/update/HardMinimumOverlay.test.tsx` | 33/33 tests pass | PASS |
| TypeScript compilation | `npx tsc --noEmit` | No errors | PASS |
| Full suite — no regressions from phase 39 | `npx vitest run` | 741 pass, 16 pre-existing failures in `ReleasesTab.test.tsx` and `jira.test.ts` (unmodified by phase 39, last touched at phases 22/25) | PASS |
| `versionPolicy.ts` exports correct symbols | `node -e "const m = require('./taskflow/src/services/versionPolicy.ts'); console.log(typeof m.fetchVersionPolicy, typeof m.isBelow)"` | N/A — ESM/TS source; verified via imports in tests | SKIP (TS module) |
| `compare-versions` package installed | `grep compare-versions taskflow/package.json` | `"compare-versions": "^6.1.1"` in dependencies | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| UPD-02 | 39-01 | Update prompt dialog shows changelog (rendered markdown), new version, and "Update Now" / "Later" actions | SATISFIED | `UpdateDialog.tsx` AvailableView: ReactMarkdown changelog, `v{current} → v{new}`, "Update Now" + "Later" buttons. Test `renders available view with version and changelog` confirms. |
| UPD-03 | 39-01 | User can download, install, and restart the app in one click with a progress bar | SATISFIED | `handleUpdateNow()` calls `updaterService.downloadAndInstall()` with progress tracking. DownloadingView renders `role="progressbar"` with `aria-valuenow`. ReadyView auto-relaunches via `invoke('plugin:process|relaunch')`. |
| UPD-04 | 39-01 | After updating, a "What's New" dialog shows the release notes for the version just installed | SATISFIED | `WhatsNewDialog.tsx` shows when `lastSeenVersion !== buildInfo.version && lastSeenChangelog !== null`. Changelog persisted to settings store by `UpdateDialog` before relaunch. |
| POL-01 | 39-02 | Public repo hosts a version-policy.json defining softMinimum and hardMinimum version thresholds | SATISFIED | `version-policy.json` exists at repo root with both fields. `useVersionPolicyCheck` fetches from `VERSION_POLICY_URL` (placeholder pointing to GitHub raw URL, to be finalized in Phase 41). |
| POL-02 | 39-02 | App shows a persistent nag banner (dismissible once per session) when below softMinimum | SATISFIED | `SoftMinimumBanner.tsx` wired in `main.tsx` with session-only `softNagDismissed` state (not persisted). `softMinimumActive` logic confirmed: below soft but not hard. |
| POL-03 | 39-02 | App shows a full-screen blocking overlay (no dismiss) when below hardMinimum; fails open if policy unreachable | SATISFIED | `HardMinimumOverlay.tsx` with `z-[200] fixed inset-0`, no dismiss button. `fetchVersionPolicy` returns null on any error; `useVersionPolicyCheck` returns `hardMinimumActive=false` when policy null. |

**All 6 requirements satisfied. No orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `useVersionPolicyCheck.ts` | 14-15 | `VERSION_POLICY_URL` is a placeholder pointing to `OWNER/RELEASES_REPO` | Info | Expected — PLAN explicitly notes "will resolve to public repo in Phase 41". No enforcement occurs at `0.0.0` defaults. Non-blocking. |
| `UpdateDialog.tsx` | 17 | `invoke('plugin:process|relaunch')` instead of official plugin API | Info | Documented deviation — `@tauri-apps/plugin-process` not in project deps. Using raw IPC is functionally equivalent. SUMMARY decision log entry `[39-01]` documents this. Non-blocking. |

No blockers. No stubs. No empty implementations.

### Human Verification Required

#### 1. Full Update Flow (Tauri Runtime)

**Test:** In a built Tauri app where a newer version is available, verify the complete update lifecycle renders and functions correctly.
**Expected:** UpdateDialog opens with version info and markdown changelog, progress bar animates during download, 10-second countdown auto-restarts, What's New dialog appears on next launch.
**Why human:** Tauri IPC, plugin-updater event stream, and actual relaunch require a running Tauri process — cannot be exercised in Vitest.

#### 2. Version Policy Enforcement (Real Build)

**Test:** Build the app with `APP_VERSION=1.5.0` and set `version-policy.json` to `{"softMinimum":"1.6.0","hardMinimum":"1.7.0"}` (or via dev override). Verify SoftMinimumBanner appears and is dismissible per session.
**Expected:** Yellow warning banner below TopBar. Dismiss X hides it for the session. Restart resets it.
**Why human:** `buildInfo.version` is a Vite build-time env var; can't override at runtime in tests without a full build.

#### 3. Hard Minimum Overlay Blocking Behavior

**Test:** Same build setup with version below `hardMinimum`. Verify entire app is blocked.
**Expected:** Fixed overlay covers everything, clicking anywhere behind it does nothing, only Update Now button works.
**Why human:** z-index layering and pointer-event blocking require visual/interactive inspection in a real browser.

### Gaps Summary

No gaps. All must-haves are verified, all requirement IDs are satisfied, all tests pass (33/33 new tests; 16 pre-existing failures in unrelated files unchanged by this phase), and TypeScript compiles clean.

The only deferred item is `VERSION_POLICY_URL` being a placeholder — this is by design, tracked for Phase 41. It does not affect phase 39 goal achievement because the fail-open semantics correctly return `policy = null` when the placeholder URL is unreachable, resulting in no enforcement.

---

_Verified: 2026-03-25T00:18:00Z_
_Verifier: Claude (gsd-verifier)_
