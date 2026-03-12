---
phase: quick-4
plan: 01
subsystem: debug-logging
tags: [debug, logging, api, jira, gitlab, settings, ui]
dependency_graph:
  requires: []
  provides: [debug-log-store, apiFetch-wrapper, debug-mode-toggle, debug-logs-page]
  affects: [jira-service, gitlab-service, settings, sidebar, router]
tech_stack:
  added: []
  patterns: [zustand-no-persist, fetch-instrumentation, header-redaction, fifo-eviction]
key_files:
  created:
    - taskflow/src/stores/debug-log.store.ts
    - taskflow/src/lib/apiFetch.ts
    - taskflow/src/routes/settings/DebugModeSection.tsx
    - taskflow/src/routes/debug-logs/DebugLogs.tsx
    - taskflow/src/routes/debug-logs/index.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src/routes/settings/Settings.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/main.tsx
decisions:
  - "apiFetch uses getState() not hooks — safe to call outside React render cycle"
  - "FIFO eviction at 200 entries prevents unbounded memory growth"
  - "Authorization and PRIVATE-TOKEN headers always redacted in log entries"
  - "Debug Logs sidebar link is always visible (not role-gated) — useful for all roles"
metrics:
  duration_secs: 199
  completed_date: "2026-03-12"
  tasks_completed: 3
  files_created: 5
  files_modified: 6
---

# Quick Task 4: Jira/GitLab API Call Logging (Debug Mode) Summary

**One-liner:** In-memory API call logging via apiFetch wrapper with auth header redaction, debug mode toggle in Settings, and collapsible log viewer page.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create debug-log store and apiFetch wrapper | dff15f4 | debug-log.store.ts, apiFetch.ts, settings.store.ts |
| 2 | Wire apiFetch into jira.ts and gitlab.ts | 0c6ea21 | jira.ts, gitlab.ts |
| 3 | Debug Mode settings section, Debug Logs page, sidebar link, router wiring | d6cf783 | DebugModeSection.tsx, DebugLogs.tsx, Settings.tsx, Sidebar.tsx, main.tsx |

## What Was Built

### debug-log.store.ts
In-memory Zustand store (no persist middleware). Stores up to 200 `ApiLogEntry` records newest-first. FIFO eviction drops the oldest entries when the cap is exceeded. Exports `useDebugLogStore` and `ApiLogEntry`.

### apiFetch.ts
Wrapper around `@tauri-apps/plugin-http`'s `fetch`. Reads `debugMode` from `useSettingsStore.getState()` (not a hook — safe outside React). When disabled: zero-overhead passthrough. When enabled: captures method, URL, sanitized request headers (Authorization and PRIVATE-TOKEN replaced with `[REDACTED]`), HTTP status, duration in ms, and response body (truncated to 10,000 chars). Network errors are captured and re-thrown so callers are unaffected.

### Service wiring (jira.ts, gitlab.ts)
All 10 fetch call sites in each service file now use `apiFetch('jira', ...)` and `apiFetch('gitlab', ...)` respectively. The import line was changed from `@tauri-apps/plugin-http` to `../lib/apiFetch`. No other logic was changed.

### DebugModeSection.tsx
Settings section following the existing `NotificationSettingsSection` pattern. Checkbox bound to `debugMode`/`setDebugMode` from settings store (persisted via Tauri Store plugin across restarts).

### DebugLogs.tsx (/debug-logs route)
Log viewer with:
- Clear button (disabled when no entries)
- Yellow warning banner when debug mode is off, linking back to Settings
- Collapsible cards showing: source badge (Jira=blue, GitLab=orange), method, status (green/yellow/red/gray), truncated URL, duration, timestamp
- Expanded detail: request headers JSON, response body in scrollable pre block

### Sidebar and Router
Bug icon added to lucide-react import. "Tools" section added in the nav between role-specific Work links and the bottom Settings link. Always visible regardless of role. Route `/debug-logs` added to main.tsx router children.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

TypeScript check after all tasks:
```
src/components/app/SearchOverlay.test.tsx(6,1): error TS6133: 'React' is declared but its value is never read.
src/routes/onboarding/GitLabStep.tsx(20,3): error TS6133: 'SelectValue' is declared but its value is never read.
src/routes/onboarding/JiraStep.tsx(24,3): error TS6133: 'SelectValue' is declared but its value is never read.
```
Pre-existing errors only — confirmed out-of-scope. No new errors introduced.

## Self-Check: PASSED

All 5 created files confirmed present on disk. All 3 task commits (dff15f4, 0c6ea21, d6cf783) confirmed in git log.
