---
status: diagnosed
trigger: "Jira PAT validation fails with CORS error: Fetch API cannot load https://jira.orange.sk/rest/api/2/myself due to access control checks"
created: 2026-03-11T10:30:00Z
updated: 2026-03-11T10:35:00Z
---

## Current Focus

hypothesis: Plain fetch() in Tauri 2 renderer IS subject to CORS because tauri-plugin-http's http:default capability has no allowed URL scope configured, so the webview enforces CORS normally
test: Read acl-manifests.json to confirm http:default requires explicit URL scope
expecting: Confirmed — scope is empty, so fetch() is blocked by CORS
next_action: DIAGNOSED — root cause confirmed

## Symptoms

expected: fetch() to https://jira.orange.sk/rest/api/2/myself succeeds without CORS error
actual: "[Error] Fetch API cannot load https://jira.orange.sk/rest/api/2/myself due to access control checks."
errors: "Fetch API cannot load https://jira.orange.sk/rest/api/2/myself due to access control checks."
reproduction: Enter Jira URL + PAT on onboarding Jira step, click Validate
started: Discovered during UAT (2026-03-11)

## Eliminated

- hypothesis: CSP in tauri.conf.json is blocking the request
  evidence: tauri.conf.json has "csp": null — CSP is completely disabled, not the cause
  timestamp: 2026-03-11T10:32:00Z

- hypothesis: tauri-plugin-http not registered in Rust backend
  evidence: lib.rs explicitly calls .plugin(tauri_plugin_http::init()) and Cargo.toml includes tauri-plugin-http = "2"
  timestamp: 2026-03-11T10:33:00Z

- hypothesis: http:default permission missing from capabilities
  evidence: capabilities/default.json includes "http:default" in permissions array
  timestamp: 2026-03-11T10:33:00Z

## Evidence

- timestamp: 2026-03-11T10:31:00Z
  checked: taskflow/src-tauri/tauri.conf.json
  found: "csp": null — Content Security Policy is disabled
  implication: CSP is not the blocker

- timestamp: 2026-03-11T10:31:00Z
  checked: taskflow/src-tauri/capabilities/default.json
  found: "http:default" is listed in permissions — but NO scope object is present
  implication: The capability is granted but no URL allowlist is configured

- timestamp: 2026-03-11T10:32:00Z
  checked: taskflow/src-tauri/gen/schemas/acl-manifests.json http section
  found: http:default description explicitly states "does not allow explicitly any origins to be fetched. This needs to be manually configured before usage." The global_scope_schema requires explicit URL entries.
  implication: http:default grants the fetch COMMANDS but zero URLs are in scope — every outbound fetch is blocked by the Tauri 2 security layer

- timestamp: 2026-03-11T10:33:00Z
  checked: taskflow/src/services/jira.ts
  found: Uses plain fetch() — NOT @tauri-apps/api/http or tauri-plugin-http's invoke-based fetch
  implication: Plain fetch() in Tauri 2 webview is subject to normal browser CORS. Only tauri-plugin-http's intercepted fetch (via invoke) bypasses CORS through the Rust backend. The code comment "Plain fetch() works in Tauri renderer — tauri-plugin-http not needed" is factually wrong for Tauri 2.

- timestamp: 2026-03-11T10:34:00Z
  checked: .planning/STATE.md decision log
  found: Decision recorded as "[Phase 01-foundation]: Plain fetch() works in Tauri renderer — tauri-plugin-http not needed for outbound API calls"
  implication: The design decision itself was incorrect. Tauri 2 does NOT bypass CORS for plain fetch(). tauri-plugin-http is exactly what is needed — but it must be used via its own fetch wrapper (imported from @tauri-apps/plugin-http), not the native browser fetch().

## Resolution

root_cause: In Tauri 2, plain browser fetch() in the renderer is NOT CORS-exempt. The webview runs in a normal browser security context and enforces CORS. The project's design decision "Plain fetch() works in Tauri renderer — tauri-plugin-http not needed" is wrong. To bypass CORS, code must use tauri-plugin-http's own fetch wrapper (which proxies through the Rust backend), AND the capabilities must include a URL scope allowlist. The current capabilities/default.json has "http:default" but no scope entry, meaning even if the correct fetch wrapper were used, all URLs would be blocked.

fix: (not applied — diagnose-only mode)
verification: (not applied — diagnose-only mode)
files_changed: []
