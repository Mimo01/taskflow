---
slug: whats-new-modal-not-showing
status: wont_fix
trigger: "After updating the app, the updated modal doesn't show itself"
created: 2026-05-26
updated: 2026-05-26
---

# Debug Session: whats-new-modal-not-showing

## Symptoms

- **Expected behavior:** After the app updates to a new version, a "What's new" changelog modal should appear to the user.
- **Actual behavior:** Nothing appears at all — no modal renders, the app looks normal with no indication of the update.
- **Error messages:** None reported yet.
- **Timeline:** Worked previously, recently broke after a change/commit.
- **Reproduction:** Deploy/build a new app version and reload.

## Current Focus

- hypothesis: OLD `persistChangelogBeforeRestart` (pre-f57e01bc) wrote a plain JS object to LazyStore instead of a JSON string; on restart Zustand's createJSONStorage called JSON.parse on the plain object, threw SyntaxError, and silently reverted all settings to defaults — including lastSeenChangelog = null — making the WhatsNewDialog condition false.
- test: Trace the update flow: UpdateDialog.handleUpdateNow → persistChangelogBeforeRestart → restart → settings store hydration → WhatsNewDialog open condition
- expecting: After confirming the old write was a plain object, the dialog's guard `lastSeenChangelog !== null` evaluates to false and the dialog stays closed
- next_action: Propose recovery fix for users who updated to v1.10.0 from a pre-fix binary
- reasoning_checkpoint: The `f57e01bc` commit fixed the write corruption going forward, but users who updated TO v1.10.0 ran the OLD binary's persistChangelogBeforeRestart — which wrote a plain object — causing the same corruption. The fix needs a recovery mechanism for this transition.

## Evidence

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/lib/tauri-storage.ts
  finding: >
    BEFORE commit f57e01bc: persistChangelogBeforeRestart called
    `settingsLazyStore.set(STORE_KEY, patched)` where `patched` was a plain JS
    object `{ state: {...}, version: N }`. Tauri's LazyStore stores plain objects
    natively as JSON, but when Zustand's createJSONStorage later calls
    `store.get('settings-store')`, it receives the plain object back. Zustand's
    adapter then calls `JSON.parse(plainObject)` — coercing the object to the
    string `"[object Object]"` before parsing — throwing SyntaxError. Zustand
    catches this and falls back to store defaults: lastSeenChangelog = null,
    lastSeenVersion = null.

- timestamp: 2026-05-26T00:01:00Z
  file: taskflow/src/components/update/WhatsNewDialog.tsx (line 28)
  finding: >
    Open condition: `const open = lastSeenVersion !== buildInfo.version &&
    lastSeenChangelog !== null;`. After store corruption, both lastSeenVersion
    and lastSeenChangelog default to null. `null !== "1.10.0"` = true, but
    `null !== null` = false. open = false. Dialog stays closed.

- timestamp: 2026-05-26T00:02:00Z
  file: taskflow/src/lib/tauri-storage.ts (commit f57e01bc, 2026-05-23)
  finding: >
    Fix committed: now reads `settingsLazyStore.get<string>(STORE_KEY)`, checks
    `typeof raw === 'string'`, JSON.parses the string, patches
    lastSeenChangelog, and writes back `JSON.stringify(patched)`. This fixes
    forward writes. Recovery path added for `'[object Object]'` stored as string.

- timestamp: 2026-05-26T00:03:00Z
  file: .github/workflows/release-cross-platform.yml
  finding: >
    Separate CI bug (f573c471, 2026-05-26): upload-to-releases job created a
    lightweight tag before force-fetching the annotated tag, causing TAG_BODY to
    read the commit message instead of release notes. Fixed by adding
    `git fetch --tags --force` before reading %(contents:body).

- timestamp: 2026-05-26T00:04:00Z
  finding: >
    Root cause confirmed: users who updated TO v1.10.0 did so using the OLD
    pre-fix binary's persistChangelogBeforeRestart (plain-object write). The new
    binary (v1.10.0) has the write fix, but the corruption already happened
    during the update transition. The store now has lastSeenChangelog = null
    (default), so the dialog never opens. Future updates from v1.10.0 will work
    correctly because the new persistChangelogBeforeRestart writes a proper JSON
    string. A one-time recovery is needed for the v1.10.0 transition cohort.

## Eliminated

- Settings store migration clearing lastSeenChangelog: no migration touches it after v11
- WhatsNewDialog rendering gate (onboardingComplete): not an issue — dialog is rendered correctly
- lastSeenVersion being set to new version during install: setLastSeenVersion is only called from WhatsNewDialog.handleDismiss
- CI bug (wrong release notes in latest.json): f573c471 fixed this; even with wrong notes the dialog should still show

## Resolution

- root_cause: >
    Pre-fix `persistChangelogBeforeRestart` (before commit f57e01bc) wrote a
    plain JS object to Tauri LazyStore. On the restart after update, Zustand's
    createJSONStorage called JSON.parse on the plain object, threw SyntaxError,
    and silently reverted all settings to defaults (lastSeenChangelog = null).
    The WhatsNewDialog open condition `lastSeenChangelog !== null` then evaluated
    false, keeping the dialog hidden.
- fix: >
    The write corruption is fixed in f57e01bc (already in v1.10.0). A recovery
    path for users who transitioned to v1.10.0 with a corrupted store is needed:
    add a settings store migration (version bump to 24) that detects
    lastSeenVersion !== buildInfo.version and lastSeenChangelog === null, and
    sets a bundled/fallback changelog so the dialog can open. Alternatively,
    change the WhatsNewDialog condition to open when lastSeenVersion differs from
    buildInfo.version regardless of lastSeenChangelog, showing a fallback message
    when no changelog is stored.
- verification: pending
- files_changed: none
- decision: >
    WON'T FIX (2026-05-26). Root cause is a one-time transition artifact affecting
    only the cohort that updated TO v1.10.0 from a pre-f57e01bc binary. The write
    corruption is already fixed in v1.10.0, so updates from v1.10.0 onward write
    the store correctly and the dialog will show normally on the next release.
    User decided to accept the one-time miss rather than ship a recovery migration.
