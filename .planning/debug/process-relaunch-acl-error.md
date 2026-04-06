---
status: resolved
trigger: "Command plugin:process|relaunch not allowed by ACL — triggers when app tries to relaunch after downloading an update"
created: 2026-04-06T00:00:00Z
updated: 2026-04-06T00:00:00Z
---

## Current Focus

hypothesis: tauri-plugin-process is not installed (Cargo dep, plugin registration, ACL permission all missing) so invoke('plugin:process|relaunch') is rejected by Tauri ACL
test: Add plugin dependency, register it, and add ACL permission
expecting: Relaunch command succeeds after update download
next_action: Apply three-part fix: Cargo.toml + lib.rs + capabilities/default.json

## Symptoms

expected: Update should download, install, and relaunch the app cleanly
actual: Update downloads successfully but restarting/relaunching triggers "Command plugin:process|relaunch not allowed by ACL" error
errors: Command plugin:process|relaunch not allowed by ACL
reproduction: Trigger an app update, let it download, then click restart/relaunch
started: Since phase 39 implementation — plugin was never added as dependency

## Eliminated

(none — root cause identified on first hypothesis)

## Evidence

- timestamp: 2026-04-06T00:00:00Z
  checked: taskflow/src-tauri/Cargo.toml
  found: tauri-plugin-process is NOT listed as a dependency
  implication: The process plugin Rust crate is not compiled into the app

- timestamp: 2026-04-06T00:00:00Z
  checked: taskflow/src-tauri/src/lib.rs
  found: No .plugin(tauri_plugin_process::init()) registration
  implication: Even if the crate were present, the plugin wouldn't be initialized

- timestamp: 2026-04-06T00:00:00Z
  checked: taskflow/src-tauri/capabilities/default.json
  found: No process:allow-restart or process:allow-relaunch permission
  implication: ACL blocks the IPC call — this is the direct cause of the error message

- timestamp: 2026-04-06T00:00:00Z
  checked: taskflow/src/components/update/UpdateDialog.tsx line 73
  found: Code calls invoke('plugin:process|relaunch') — raw IPC to the process plugin
  implication: This is the call that triggers the ACL error

- timestamp: 2026-04-06T00:00:00Z
  checked: node_modules/@tauri-apps/plugin-process
  found: JS package not installed either
  implication: Confirms plugin was never set up — only raw invoke() was used

## Resolution

root_cause: tauri-plugin-process was never added as a dependency. The code uses invoke('plugin:process|relaunch') which requires the Rust plugin to be installed, registered, and permitted via ACL. All three are missing.
fix: 1) Add tauri-plugin-process = "2" to Cargo.toml, 2) Register plugin in lib.rs, 3) Add "process:allow-restart" to capabilities/default.json
verification: cargo check passes — compiles cleanly with tauri-plugin-process v2.3.1. Needs human verification of actual update+relaunch flow.
files_changed:
- taskflow/src-tauri/Cargo.toml
- taskflow/src-tauri/src/lib.rs
- taskflow/src-tauri/capabilities/default.json
