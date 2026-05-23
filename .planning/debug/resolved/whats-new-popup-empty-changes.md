---
slug: whats-new-popup-empty-changes
status: resolved
trigger: After updating the app there is a popup with info — What's New in v1.8.1 / Here's what changed in this update — but the actual changes are empty (even though they exist and show correctly in other places)
created: 2026-05-19
updated: 2026-05-19
---

## Symptoms

- expected: Popup should display changelog entries for v1.8.1
- actual: Popup shows title "What's New in v1.8.1" and subtitle "Here's what changed in this update" but the changes list is empty
- works_elsewhere: Dedicated release notes screen/page shows the changes correctly
- timeline: Always been broken — popup has never shown content
- reproduction: Popup appears automatically on first app launch after updating
- errors: Not yet checked

## Current Focus

hypothesis: RESOLVED — see Resolution below
test: n/a
expecting: n/a
next_action: n/a

## Evidence

- timestamp: 2026-05-19
  finding: WhatsNewDialog reads `lastSeenChangelog` from the settings store (persisted via Tauri LazyStore). It renders empty because `lastSeenChangelog` is always `null` on launch.
  file: src/components/update/WhatsNewDialog.tsx:28

- timestamp: 2026-05-19
  finding: The only place `setLastSeenChangelog` was called was in `UpdateDialog.handleUpdateNow`, immediately followed by `await invoke('plugin:process|restart')`. The Zustand persist middleware calls `storage.setItem()` fire-and-forget (does not await the returned Promise), so the Tauri `store.set()+store.save()` never completed before the process was killed.
  file: src/components/update/UpdateDialog.tsx:71 (original)

- timestamp: 2026-05-19
  finding: Confirmed via `zustand/esm/middleware.mjs`: `api.setState` calls `setItem()` and returns its Promise, but the internal `set()` wrapper used by store actions discards the return value — callers cannot await it.
  file: taskflow/node_modules/zustand/esm/middleware.mjs:363-371

## Eliminated

- Rendering bug in WhatsNewDialog (confirmed: it renders correctly when `lastSeenChangelog` is non-null — shown by existing tests)
- Data missing from the update API response (confirmed: `changelog` field is present in `useUpdateStore` and displayed correctly in the UpdateDialog available view)

## Resolution

root_cause: Zustand's persist middleware fires `storage.setItem()` asynchronously without awaiting the result. In `UpdateDialog.handleUpdateNow`, calling `setLastSeenChangelog(changelog)` triggers a fire-and-forget Tauri store write, then `invoke('plugin:process|restart')` kills the process before `store.save()` completes. On next launch `lastSeenChangelog` is still `null`, so `WhatsNewDialog` treats it as "no changelog available" and renders nothing.

fix: Added `persistChangelogBeforeRestart(markdown)` to `src/lib/tauri-storage.ts`. It reads the current persisted settings JSON directly from a shared `settingsLazyStore` LazyStore singleton, patches `lastSeenChangelog`, and fully awaits `store.set()+store.save()` before returning. `UpdateDialog.handleUpdateNow` now calls `await persistChangelogBeforeRestart(changelog)` instead of `setLastSeenChangelog(changelog)` before invoking restart.

verification: 38/38 tests passing across all update-related files including 2 new tests covering the persist-before-restart path and ordering guarantee.

files_changed:
  - src/lib/tauri-storage.ts (added settingsLazyStore export and persistChangelogBeforeRestart)
  - src/components/update/UpdateDialog.tsx (replaced setLastSeenChangelog with await persistChangelogBeforeRestart)
  - src/components/update/UpdateDialog.test.tsx (mocked tauri-storage, added 2 new tests)
