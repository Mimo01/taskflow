# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## time-logging-500 — Jira worklog API rejects ISO dates with Z suffix
- **Date:** 2026-03-23
- **Error patterns:** 500, Error parsing time, toISOString, Z, worklog, started
- **Root cause:** `LogWorkPopover.tsx` uses `new Date().toISOString()` which produces `Z`-suffixed UTC timestamps. Jira Server/DC worklog API cannot parse `Z` as a timezone designator and returns HTTP 500. It requires `+0000` offset format.
- **Fix:** Append `.replace('Z', '+0000')` to `.toISOString()` calls in both LogWorkPopover (create) and IssueDetailPage (update fallback).
- **Files changed:** taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx, taskflow/src/routes/dashboard/IssueDetailPage.tsx
---

## notification-no-sound — OS notification banners appear but no sound plays
- **Date:** 2026-03-26
- **Error patterns:** notification, no sound, silent, sendNotification, sound, Basso, tauri-plugin-notification
- **Root cause:** `sendNotification({ title, body })` in `tryDispatchOsNotification()` omits the `sound` property. On macOS, `tauri-plugin-notification` requires an explicit system sound name for audible alerts; without it notifications fire silently.
- **Fix:** Added `sound: 'Basso'` to the sendNotification options object.
- **Files changed:** taskflow/src/services/notifications.ts
---

## updater-acl-error — ACL blocks updater plugin + dev builds trigger spurious update modal
- **Date:** 2026-03-26
- **Error patterns:** ACL, plugin:updater|check not allowed, updater, capabilities, dev build, 0.0.0-dev, update modal
- **Root cause:** Two issues: (1) `capabilities/default.json` was missing `updater:default` permission, causing Tauri ACL to block `plugin:updater|check`. (2) `useUpdatePolling.ts` had no dev-build guard — once ACL was fixed, dev builds (version "0.0.0-dev") auto-checked and showed spurious update modal.
- **Fix:** (1) Added `"updater:default"` to capabilities/default.json. (2) Added `IS_DEV_BUILD` guard in useUpdatePolling.ts using `buildInfo.version.includes('-dev')`.
- **Files changed:** taskflow/src-tauri/capabilities/default.json, taskflow/src/hooks/useUpdatePolling.ts
---

## duplicate-os-notifications — OS notifications fire multiple times for the same notification
- **Date:** 2026-03-26
- **Error patterns:** duplicate, OS notification, multiple times, same notification, re-fire, sendNotification, tryDispatchOsNotification
- **Root cause:** `useNotificationPolling.ts` dispatched OS notifications for every item in `newItems` (cursor-filtered API results) without checking whether the item already existed in the store. When a stale cursor caused re-fetching of already-seen notifications, the store's `prependItems` silently deduplicated in-app entries but the OS dispatch loop had no equivalent guard.
- **Fix:** Before the OS dispatch loop, capture existing store item IDs into a Set. Skip `tryDispatchOsNotification` for any item whose ID is already in that Set.
- **Files changed:** taskflow/src/hooks/useNotificationPolling.ts
---

## wizard-paste-broken — Cmd+V paste silently fails in all Tauri webview inputs on macOS
- **Date:** 2026-03-29
- **Error patterns:** paste, Cmd+V, clipboard, input, nothing happens, ignored, wizard, macOS, Edit menu, PredefinedMenuItem
- **Root cause:** Tauri app `lib.rs` defined custom macOS menu bar (App, Go, Help) but omitted the standard Edit menu. On macOS, clipboard shortcuts (Cmd+V/C/X/A/Z) are routed through the OS menu system. Without `PredefinedMenuItem::paste/copy/cut/select_all/undo/redo` in an Edit submenu, macOS never dispatches these keystrokes to the webview.
- **Fix:** Added Edit submenu to the Tauri menu bar in `lib.rs` with `PredefinedMenuItem::undo`, `redo`, separator, `cut`, `copy`, `paste`, `select_all`.
- **Files changed:** taskflow/src-tauri/src/lib.rs
---
