---
phase: quick
plan: 260509-zzx
subsystem: dev-tools / debug-log
tags: [dev-tools, logging, request-body, apiFetch]
dependency_graph:
  requires: []
  provides: [request-body-logging]
  affects: [dev-tools-logs-tab, debug-logs-page]
tech_stack:
  added: []
  patterns: [conditional-render, pre-formatted-log-capture]
key_files:
  created: []
  modified:
    - taskflow/src/stores/debug-log.store.ts
    - taskflow/src/lib/apiFetch.ts
    - taskflow/src/routes/dev-tools/LogsTab.tsx
    - taskflow/src/routes/debug-logs/DebugLogs.tsx
decisions:
  - "Render entry.requestBody directly (no formatBody call) — body is pre-formatted at capture time in apiFetch"
  - "Truncate request bodies at 5_000 chars (half of the 10_000 limit used for response bodies) to limit log bloat"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-09"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 260509-zzx: Log Request Body in Dev Tools Summary

**One-liner:** Capture and display POST/PUT request bodies in dev tools log entries, with JSON pretty-printing and 5,000-char truncation.

## What Was Built

Request body capture and display for the dev tools log system. POST and PUT API calls now show their full request payload in the log detail panel alongside the URL, request headers, and response body.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add requestBody to ApiLogEntry and capture in apiFetch | a14638a | debug-log.store.ts, apiFetch.ts |
| 2 | Render Request Body section in LogsTab.tsx and DebugLogs.tsx | 8c71cdc | LogsTab.tsx, DebugLogs.tsx |

## Changes

**`taskflow/src/stores/debug-log.store.ts`**
- Added `requestBody?: string` to `ApiLogEntry` interface, positioned after `requestHeaders`
- Added comment noting truncation to 5_000 chars

**`taskflow/src/lib/apiFetch.ts`**
- Added request body capture block before try/catch, gated on `requestLogging && init?.body != null`
- Handles `string` and non-string body types via `String(init.body)` coercion
- Pretty-prints valid JSON; falls back to raw string for non-JSON
- Truncates to 5,000 chars with `[truncated]` marker
- `requestBody` field added to both error-path and success-path `ApiLogEntry` literals

**`taskflow/src/routes/dev-tools/LogsTab.tsx`**
- Added conditional `{entry.requestBody && ...}` block between Request Headers and Response Body sections
- Uses `entry.requestBody` directly (no `formatBody` call — already formatted at capture)

**`taskflow/src/routes/debug-logs/DebugLogs.tsx`**
- Same conditional block added in same position
- Uses `entry.requestBody` directly (local `formatBody` not applied — body pre-formatted)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- [x] `taskflow/src/stores/debug-log.store.ts` — modified, `requestBody` field present
- [x] `taskflow/src/lib/apiFetch.ts` — modified, `requestBody` captured and included in both entries
- [x] `taskflow/src/routes/dev-tools/LogsTab.tsx` — modified, "Request Body" section rendered
- [x] `taskflow/src/routes/debug-logs/DebugLogs.tsx` — modified, "Request Body" section rendered
- [x] Commit a14638a — exists (Task 1)
- [x] Commit 8c71cdc — exists (Task 2)
- [x] `npx tsc --noEmit` passes with no errors
