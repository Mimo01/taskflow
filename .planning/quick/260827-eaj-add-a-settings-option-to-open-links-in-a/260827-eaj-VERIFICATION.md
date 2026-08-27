---
phase: quick-260827-eaj
verified: 2026-08-27T10:45:00Z
status: human_needed
score: 6/6 must-haves verified (code-level); 1 item requires human runtime confirmation
overrides_applied: 0
human_verification:
  - test: "Open Settings → Links; confirm the dropdown lists System Default plus the browsers actually installed on this machine"
    expected: "Select shows System Default plus every browser detected via list_browsers on this OS"
    why_human: "Requires a running Tauri desktop session; cannot be enumerated by static analysis"
  - test: "Select a non-default browser, then click an 'open in browser' button on an issue detail page (or MR/release page)"
    expected: "The URL opens in the selected browser, NOT the OS default"
    why_human: "This is the single most important check per the plan's own threat model (RESEARCH pitfall 1): a misconfigured opener capability scope resolves to Application::Default and silently no-ops with zero automated signal — cargo check, tsc, and unit tests all pass whether or not the real Tauri opener plugin honors the scope at runtime. The SUMMARY explicitly states this check was NOT performed during execution (no interactive desktop session available)."
  - test: "Click a hyperlink inside a rendered issue description or comment"
    expected: "Opens in the same selected browser as button-originated links"
    why_human: "Same runtime-only capability-scope risk as above, applied to the WikiRenderer anchor click path"
  - test: "Quit and relaunch the app; confirm the browser selection persisted"
    expected: "externalBrowser setting survives restart (store version 29 persist)"
    why_human: "Requires an actual app restart; migrate-branch code was verified statically but the on-disk persistence round-trip was not exercised interactively"
  - test: "Switch back to System Default and confirm links open in the OS default browser again"
    expected: "openUrl(url) with no second argument opens in OS default"
    why_human: "Runtime confirmation of the null-preference code path in a live webview"
---

# Quick Task: Add a settings option to open links in a user-selectable browser Verification Report

**Task Goal:** Add a settings option to open links in a user-selectable browser (covers 'open in browser' links and links inside descriptions/comments)
**Verified:** 2026-08-27
**Status:** human_needed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open Settings → Links and see a browser dropdown listing System Default plus every browser detected on their machine | ✓ VERIFIED (code) | `LinksSection.tsx` renders `Select` with `SelectItem` "System Default" (`__default__` sentinel) + one `SelectItem` per `tauriService.invoke('list_browsers')` result; wired into `Settings.tsx` nav (`'links'` section, `ExternalLink` icon, line 54/102). `list_browsers` Rust command at `lib.rs:96` uses only `Path::exists()` probing per platform (`#[cfg(target_os)]` blocks for macOS/Windows/Linux), registered in `generate_handler!` (line 396-401). Runtime rendering not observed — see human_verification. |
| 2 | Selecting a browser persists across app restart | ✓ VERIFIED (code) / ? UNCERTAIN (runtime) | `settings.store.ts` has `externalBrowser: null as string|null` in `initialSettings` (line 62), `setExternalBrowser` action (line 337), persist `version: 29` (line 367) with `version < 29` migrate branch defaulting `undefined → null` (lines 482-483). Zustand persist middleware handles the actual localStorage/file round-trip — not independently exercised here. |
| 3 | Clicking any 'open in browser' button opens the URL in the selected browser | ✓ VERIFIED (code) / ? UNCERTAIN (runtime) | All 12 call sites (`IssueDetailContent.tsx:509`, `MergeRequestDetailPage.tsx:222`, `ReleaseDetailPage.tsx:206`, `ReleaseDetailSidebar.tsx:324/338/474`, `UnifiedTaskTable.tsx:445/745`, `SubtasksPanel.tsx:19`, `NotificationPopover.tsx:324`, `DiscussionThreads.tsx:101`, `WikiRenderer.tsx:1367`) call `openExternal(...)`. `openExternal.ts` reads `useSettingsStore.getState().externalBrowser` and calls `openUrl(url, selected)` before falling back. Unit tests (`openExternal.test.ts`, 4/4 passing) confirm this logic in isolation with a mocked plugin — the real `@tauri-apps/plugin-opener` + native OS launch behavior is unverified. |
| 4 | Clicking a link inside a rendered description or comment opens it in the selected browser | ✓ VERIFIED (code) / ? UNCERTAIN (runtime) | `WikiRenderer.tsx:1367` anchor click handler calls `openExternal(href)`; `DiscussionThreads.tsx:101` (comment links) likewise. Same runtime caveat as truth 3. |
| 5 | If the selected browser cannot be launched, the URL still opens in the OS default browser with no error toast | ✓ VERIFIED (code) | `openExternal.ts`: on `openUrl(url, selected)` rejection, falls through (swallowed in `catch {}`) to `await openUrl(url)`; final rejection swallowed via `onFallbackFailed?.()` (no toast triggered by default — only `SubtasksPanel` opts into a `window.open` rung). Test 3 in `openExternal.test.ts` explicitly covers "selected browser rejects → default browser called, no throw." |
| 6 | Choosing System Default restores the pre-existing default-browser behavior | ✓ VERIFIED (code) | When `externalBrowser === null`, `openExternal` calls `openUrl(url)` with no second argument — the exact pre-existing call shape. Test 1 and Test 4 in `openExternal.test.ts` cover this (single call, no retry on failure). |

**Score:** 6/6 truths pass static/code verification. Truths 1, 2, 3, 4, 6 have a live-runtime component that has NOT been exercised (see Human Verification).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/lib/openExternal.ts` | Single choke point, exports `openExternal` | ✓ VERIFIED | 44 lines, exports `openExternal` + `BrowserInfo`; documented as sanctioned boundary in header comment |
| `taskflow/src-tauri/src/lib.rs` | `list_browsers` command via `Path::exists()` | ✓ VERIFIED | `fn list_browsers` at line 96, registered in `generate_handler!` (grep count 2: definition + handler list) |
| `taskflow/src-tauri/capabilities/default.json` | `opener:allow-open-url` scope with `app: true` | ✓ VERIFIED | Additive entry present for both `http://*` and `https://*`, `opener:default` retained unchanged |
| `taskflow/src/routes/settings/LinksSection.tsx` | Browser picker UI | ✓ VERIFIED | 90 lines, `data-testid="section-links"`, Select-based picker, missing-selection fallback option |
| `taskflow/src/stores/settings.store.ts` | `externalBrowser` at store version 29 | ✓ VERIFIED | `version: 29`, `externalBrowser` field + `setExternalBrowser` action + migrate branch present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `openExternal.ts` | `useSettingsStore.externalBrowser` | `getState()` imperative read | ✓ WIRED | `useSettingsStore.getState().externalBrowser` present in source |
| `openExternal.ts` | `@tauri-apps/plugin-opener openUrl` | `openUrl(url, selected)` + fallback | ✓ WIRED | Both call shapes present exactly as specified |
| `WikiRenderer.tsx` | `@/lib/openExternal` | import + anchor click handler | ✓ WIRED | `openExternal(href)` at line 1367, confirmed import |
| `LinksSection.tsx` | `list_browsers` | `tauriService.invoke` | ✓ WIRED | `tauriService.invoke<BrowserInfo[]>('list_browsers')` in `useEffect` |

### Grep Gate (choke-point enforcement)

Only `src/lib/openExternal.ts` and `src/routes/dashboard/issue-detail/AttachmentsSection.tsx` (unrelated `openPath` import, correctly out of scope) import `@tauri-apps/plugin-opener` in non-test code. Confirmed via direct grep — matches plan requirement exactly.

### Automated Verification Run

| Check | Result |
|-------|--------|
| `cargo check` (src-tauri) | ✓ PASS — no warnings |
| `npx tsc --noEmit` | ✓ PASS — clean |
| `npx vitest run` (full suite) | ✓ PASS — 186 files / 2669 tests passed, 2 skipped, 13 todo |
| `openExternal.test.ts` (4 behavior tests) | ✓ PASS |
| `LinksSection.test.tsx` | ✓ PASS |
| `settings.store.test.ts` (v29 migration + externalBrowser default) | ✓ PASS |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| LINK-01 | Settings option to select external browser | ✓ SATISFIED | LinksSection.tsx + settings.store.ts |
| LINK-02 | All open-in-browser + description/comment links route through selection | ✓ SATISFIED | 12/12 call sites migrated, grep gate clean |
| LINK-03 | Silent fallback to OS default on launch failure | ✓ SATISFIED | openExternal.ts fallback chain + tests |

### Anti-Patterns Found

None blocking. Code reviewer (260827-eaj-REVIEW.md) found 0 critical, 1 warning (unrelated dead-code branch in `save_attachment`, pre-existing pattern not introduced by this task's core feature but touched file), 3 info-level robustness notes (missing scheme allowlist in WikiRenderer before calling openExternal, unreachable `?? ''` in NotificationPopover, stale JSDoc in `resetSettings`). None of these block the goal — they are hardening suggestions.

### Human Verification Required

The plan's own Task 3 `<human-check>` block designates the following as "the single most important check" — the SUMMARY.md explicitly confirms this was **not performed** during execution because no interactive desktop session was available. This is exactly the scenario the plan's RESEARCH pitfall 1 warns about: a misconfigured Tauri capability scope makes `openUrl(url, app)` resolve to `Application::Default` and silently no-op, with zero signal from `cargo check`, `tsc`, or mocked unit tests (which stub the plugin boundary and therefore cannot catch a real scope misconfiguration).

### 1. Browser dropdown populates correctly

**Test:** Open Settings → Links in `npm run tauri dev`
**Expected:** Dropdown shows System Default plus every browser actually installed on the test machine
**Why human:** Requires a live OS + Tauri IPC round trip; static analysis confirms the code path but not actual filesystem detection results on a real machine

### 2. Selected browser actually receives the URL (button-originated)

**Test:** Select a non-default browser in Links settings, then click an "open in browser" button (e.g., issue detail page)
**Expected:** URL opens in the selected browser, not the OS default
**Why human:** This is the critical capability-scope validation the plan calls out explicitly. A `ForbiddenUrl` no-op from a misconfigured scope would be invisible to every automated check that ran clean above.

### 3. Selected browser actually receives the URL (description/comment-originated)

**Test:** Click a hyperlink inside a rendered issue description or comment
**Expected:** Opens in the same selected browser
**Why human:** Same runtime-only risk, exercised via the `WikiRenderer` anchor path instead of a button `onClick`

### 4. Persistence across restart

**Test:** Quit and relaunch the app after selecting a browser
**Expected:** Selection persisted (store version 29)
**Why human:** Requires actual process restart; migrate-branch and persist config were verified statically only

### 5. System Default restores prior behavior

**Test:** Switch back to System Default and click a link
**Expected:** Opens in OS default browser
**Why human:** Runtime confirmation of the null-preference code path

### Gaps Summary

No code-level gaps found. All artifacts exist, are substantive, and are wired correctly; all 12 call sites were migrated; the choke-point grep gate is clean; the full automated test suite (2669 tests), `cargo check`, and `tsc --noEmit` all pass. The single outstanding item is the live-runtime confirmation that the `opener:allow-open-url` capability scope actually permits launching a non-default browser in a real Tauri webview — this was explicitly skipped during execution per the SUMMARY.md's own "Known Gaps" section, and the plan itself flags this as the highest-risk unverified path (RESEARCH pitfall 1: silent `ForbiddenUrl` no-op with no automated signal). Per the decision tree, human verification items being non-empty forces `status: human_needed` even though all code-level truths verify.

---

_Verified: 2026-08-27_
_Verifier: Claude (gsd-verifier)_
