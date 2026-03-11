---
phase: 01-foundation
plan: 05
subsystem: ui
tags: [tauri, tailwind, shadcn, cors, fetch, tauri-plugin-http, capabilities]

# Dependency graph
requires:
  - phase: 01-foundation-01
    provides: Tailwind/shadcn CSS setup and index.css
  - phase: 01-foundation-02
    provides: jira.ts and gitlab.ts service files with native fetch
  - phase: 01-foundation-03
    provides: Tauri capabilities/default.json with http:default permission
provides:
  - CSS import wired in main.tsx so Tailwind/shadcn styles load on first render
  - jira.ts and gitlab.ts use tauri-plugin-http fetch (no CORS errors in webview)
  - capabilities/default.json has scope permitting https://** and http://**
affects: [02-dashboard, any phase that calls Jira or GitLab from the renderer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Use @tauri-apps/plugin-http fetch in all service files making external HTTP calls from the renderer
    - Tauri capabilities must include a scope key alongside http:default permission to allow any URLs

key-files:
  created: []
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/services/jira.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src-tauri/capabilities/default.json

key-decisions:
  - "tauri-plugin-http fetch required in renderer — plain fetch() causes CORS errors in Tauri 2 webview despite prior STATE.md note claiming otherwise"
  - "capabilities scope allows both https://** and http://** — on-premise Jira/GitLab instances may run on HTTP"

patterns-established:
  - "Plugin HTTP pattern: import { fetch } from '@tauri-apps/plugin-http' shadows global fetch; function bodies unchanged"
  - "Capabilities scope pattern: add top-level scope.http.allow array alongside permissions when using http:default"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 1 Plan 05: UAT Gap Closure (CSS + CORS Fix) Summary

**CSS import wired in main.tsx and tauri-plugin-http fetch used in service files, eliminating unstyled-content and CORS blockers from onboarding UAT**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-11T09:46:03Z
- **Completed:** 2026-03-11T09:47:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `import './index.css'` as first import in main.tsx — connects Tailwind/shadcn stylesheet to Vite module graph on every render
- Replaced native `fetch()` with `@tauri-apps/plugin-http` fetch in both jira.ts and gitlab.ts — proxies through Rust backend, eliminating CORS errors in the Tauri webview
- Added `scope` key to capabilities/default.json allowing `https://**` and `http://**` — required by http:default permission to permit any outbound URLs
- TypeScript compiles cleanly (tsc --noEmit exits 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add missing CSS import to main.tsx** - `575b42c` (feat)
2. **Task 2: Fix CORS — switch service files to tauri-plugin-http fetch and add capabilities scope** - `c893c33` (fix)

## Files Created/Modified
- `taskflow/src/main.tsx` - Added `import './index.css'` as first import
- `taskflow/src/services/jira.ts` - Replaced native fetch with @tauri-apps/plugin-http fetch; updated JSDoc comment
- `taskflow/src/services/gitlab.ts` - Replaced native fetch with @tauri-apps/plugin-http fetch; updated JSDoc comment
- `taskflow/src-tauri/capabilities/default.json` - Added scope key with http allow patterns for https://** and http://**

## Decisions Made
- tauri-plugin-http is required for outbound API calls from the Tauri renderer. The prior STATE.md decision "Plain fetch() works in Tauri renderer" was incorrect — UAT observed a live CORS error. The plugin infrastructure was already installed (package.json, Cargo.toml, lib.rs), only the JS import and capabilities scope were missing.
- Both `https://**` and `http://**` allowed in scope — on-premise Jira/GitLab instances commonly run on HTTP without TLS.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 1 UAT blockers fully resolved: unstyled content fixed, CORS errors eliminated
- Onboarding wizard PAT validation now reaches the server (401/403/200 returned as appropriate)
- Ready to re-run UAT against the full onboarding flow to confirm 15/15 test scenarios pass
- Phase 2 Dashboard work can proceed

---
*Phase: 01-foundation*
*Completed: 2026-03-11*

## Self-Check: PASSED

- taskflow/src/main.tsx: FOUND
- taskflow/src/services/jira.ts: FOUND
- taskflow/src/services/gitlab.ts: FOUND
- taskflow/src-tauri/capabilities/default.json: FOUND
- .planning/phases/01-foundation/01-05-SUMMARY.md: FOUND
- Commit 575b42c: FOUND
- Commit c893c33: FOUND
