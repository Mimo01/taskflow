---
phase: 38-updater-foundation-service-layer
plan: 03
subsystem: infra
tags: [tanstack-query, polling, zustand, settings, tauri-updater, tauri-conf]

# Dependency graph
requires:
  - phase: 38-updater-foundation-service-layer/38-02
    provides: updaterService.check() and useUpdateStore state machine
provides:
  - useUpdatePolling hook with 7s launch delay and configurable interval
  - updateCheckInterval setting in settings store (1/6/12/24h or manual)
  - tauri.conf.json updater plugin endpoint configuration
affects: [39-updater-ui, any component rendering update status]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Query polling with launch delay via useState/useEffect ready gate"
    - "Settings store v10 migration for updateCheckInterval default"

key-files:
  created:
    - taskflow/src/hooks/useUpdatePolling.ts
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/settings.store.test.ts
    - taskflow/src-tauri/tauri.conf.json

key-decisions:
  - "7000ms launch delay (mid-range of D-03's 5-10s window) to avoid competing with Jira/GitLab initial fetches"
  - "refetchIntervalInBackground: false — no update checks while app is hidden"
  - "No pubkey in tauri.conf.json yet — deferred to Phase 41 per D-11"
  - "Reused 'jira' source type for debug log entries (existing enum, sufficient for dev tools display)"

patterns-established:
  - "Launch delay gate: useState(false) + useEffect setTimeout → enabled flag for useQuery"

requirements-completed: [UPD-01]

# Metrics
duration: 5min
completed: 2026-03-24
---

# Plan 03: Update Polling Hook + Settings Integration

**TanStack Query polling hook wired to updater service with configurable interval and 7s launch delay**

## What was built

1. **Settings store v10** — Added `updateCheckInterval` (type: `1 | 6 | 12 | 24 | 'manual'`, default: 6h) with migration from v9. 3 new tests pass.

2. **useUpdatePolling hook** — Mirrors useNotificationPolling pattern. Fires after 7s launch delay (D-03), polls at user interval, logs all results to debug store (D-02), surfaces nothing to UI (D-01). Manual mode disables polling entirely.

3. **tauri.conf.json updater config** — Added `plugins.updater.endpoints` block pointing to GitHub releases. No pubkey yet (deferred per D-11 to Phase 41).

## Self-Check: PASSED

- [x] useUpdatePolling.ts created with LAUNCH_DELAY_MS, updaterService.check(), store integration
- [x] settings.store.ts has updateCheckInterval with v10 migration
- [x] tauri.conf.json has plugins.updater.endpoints (no pubkey)
- [x] All settings store tests pass (18/18)
- [x] Biome format clean on new file
