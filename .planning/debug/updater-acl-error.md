---
status: resolved
trigger: "App shows 'Command plugin:updater|check not allowed by ACL' error on every open. Latest release installed, this may be a regression in the latest version."
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — Two issues: (1) ACL permission was missing (fixed), (2) dev builds auto-poll for updates and show v0.0.0-dev -> v0.1.0 modal because useUpdatePolling has no dev-build guard
test: Added IS_DEV_BUILD check to useUpdatePolling.ts — disables timer and query in dev builds
expecting: Dev builds no longer trigger automatic update checks or show update modal
next_action: Await human verification of the dev-build fix

## Symptoms

expected: App opens normally without errors
actual: Error 'Command plugin:updater|check not allowed by ACL' appears on every app open
errors: Command plugin:updater|check not allowed by ACL
reproduction: Open the app - happens every time
started: Started with latest release, may be a regression

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-26T00:01:00Z
  checked: .planning/debug/knowledge-base.md
  found: No matching prior patterns (error patterns: updater, ACL, plugin:updater|check not present)
  implication: Fresh investigation required

- timestamp: 2026-03-26T00:02:00Z
  checked: taskflow/src-tauri/capabilities/default.json
  found: File lists permissions for core, opener, stronghold, store, http, notification — NO updater permissions at all
  implication: This is the direct cause; Tauri ACL blocks plugin:updater|check

- timestamp: 2026-03-26T00:02:00Z
  checked: taskflow/src-tauri/tauri.conf.json
  found: plugins.updater is fully configured (pubkey + endpoints); createUpdaterArtifacts=true in bundle
  implication: Updater is intentionally set up, capability was simply never updated to grant permission

- timestamp: 2026-03-26T00:02:00Z
  checked: taskflow/src-tauri/Cargo.toml
  found: tauri-plugin-updater = "2" is in [dependencies]
  implication: Plugin is registered at the Rust level — the only missing piece is the capability permission

- timestamp: 2026-03-26T00:03:00Z
  checked: taskflow/src/hooks/useUpdatePolling.ts
  found: Hook calls updaterService.check() after 7s launch delay. Error path calls setError(msg) — this likely surfaces the ACL error message to the user
  implication: The error is generated on every app open because the polling hook fires automatically (unless update interval is set to 'manual')

- timestamp: 2026-03-26T00:04:00Z
  checked: taskflow/src/hooks/useUpdatePolling.ts (follow-up issue)
  found: useUpdatePolling has no dev-build guard. `enabled` condition only checks `ready && updateCheckInterval !== 'manual'`. With ACL fix applied, dev builds now successfully call updater, which sees 0.0.0-dev < 0.1.0 and shows update modal.
  implication: Need to skip auto-polling when buildInfo.version contains "-dev"

- timestamp: 2026-03-26T00:04:00Z
  checked: taskflow/src/lib/build-info.ts
  found: `buildInfo.version` = `import.meta.env.APP_VERSION`, which is "0.0.0-dev" for dev builds
  implication: Can use `buildInfo.version.includes('-dev')` as the dev-build guard

- timestamp: 2026-03-26T00:05:00Z
  checked: All update-related tests (35 tests across 5 files)
  found: All pass after fix
  implication: Fix does not break existing test suite

## Resolution

root_cause: Two issues: (1) `capabilities/default.json` was missing `updater:default` permission causing ACL error. (2) `useUpdatePolling.ts` had no guard for dev builds — once ACL was fixed, dev builds (version "0.0.0-dev") successfully check for updates and show a spurious update modal to v0.1.0.
fix: (1) Added `"updater:default"` to capabilities/default.json permissions. (2) Added `IS_DEV_BUILD` constant (`buildInfo.version.includes('-dev')`) to useUpdatePolling.ts — guards both the launch-delay timer and the query `enabled` flag so dev builds never auto-check.
verification: All 35 update-related tests pass. Human verified — dev builds open cleanly, no update checks or modal.
files_changed: ["taskflow/src-tauri/capabilities/default.json", "taskflow/src/hooks/useUpdatePolling.ts"]
