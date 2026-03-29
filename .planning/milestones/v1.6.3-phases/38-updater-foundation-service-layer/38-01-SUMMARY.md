---
phase: 38-updater-foundation-service-layer
plan: 01
subsystem: infra
tags: [vite, tauri, build-pipeline, version-injection, git-tags, semver]

# Dependency graph
requires: []
provides:
  - "inject-version.cjs script that reads git tag, normalizes to SemVer, writes tauri.conf.json, exports APP_VERSION/APP_COMMIT_SHA/APP_BUILD_DATE env vars"
  - "Vite define block injecting build metadata as import.meta.env constants at compile time"
  - "build-info.ts typed accessor for APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE"
  - "tauri.conf.json with 0.0.0-dev placeholder version and createUpdaterArtifacts: true"
affects: [38-updater-foundation-service-layer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time version injection via Vite define block + Node.js pre-build script"
    - "import.meta.env typed constants via vite-env.d.ts ImportMetaEnv augmentation"
    - "inject-version.cjs as .cjs extension to avoid ES module conflicts (package.json type:module)"

key-files:
  created:
    - taskflow/scripts/inject-version.cjs
    - taskflow/src/lib/build-info.ts
    - taskflow/src/lib/build-info.test.ts
  modified:
    - taskflow/vite.config.ts
    - taskflow/vitest.config.ts
    - taskflow/src-tauri/tauri.conf.json
    - taskflow/src/vite-env.d.ts
    - taskflow/package.json

key-decisions:
  - "Renamed inject-version.js to inject-version.cjs because package.json has type:module; CommonJS require() requires .cjs extension"
  - "Added define block to vitest.config.ts as well as vite.config.ts so import.meta.env constants resolve during test runs"

patterns-established:
  - "Version injection pattern: node scripts/inject-version.cjs writes tauri.conf.json + exports env vars for Vite define"
  - "Build metadata accessor: import { buildInfo } from '@/lib/build-info' provides version, commitSha, buildDate"

requirements-completed: [CI-03, CI-04]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 38 Plan 01: Build-Time Version Injection Pipeline Summary

**Git-tag-to-runtime version pipeline: inject-version.cjs reads git tag, normalizes to SemVer, writes tauri.conf.json, and Vite define injects APP_VERSION/APP_COMMIT_SHA/APP_BUILD_DATE as typed import.meta.env constants**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-24T21:29:00Z
- **Completed:** 2026-03-24T21:37:39Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments

- Version injection pipeline reads git tag with `git describe --tags --match "v[0-9]*"` and normalizes 1-, 2-, or 3-component versions to full SemVer
- Vite define block in both vite.config.ts and vitest.config.ts injects APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE at compile/test time with fallback defaults
- tauri.conf.json updated with `0.0.0-dev` placeholder and `createUpdaterArtifacts: true` for future updater setup
- 4 unit tests in build-info.test.ts all pass (non-empty strings, no 'v' prefix)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create version injection script, update build config, and add build-info module** - `50e0e76` (feat)

## Files Created/Modified

- `taskflow/scripts/inject-version.cjs` - Node CommonJS script reading git tag, normalizing to SemVer, writing tauri.conf.json version field, printing APP_* env vars to stdout
- `taskflow/src/lib/build-info.ts` - Typed accessor exporting `buildInfo` with version, commitSha, buildDate from import.meta.env
- `taskflow/src/lib/build-info.test.ts` - 4 Vitest tests verifying non-empty string exports and no 'v' prefix on version
- `taskflow/vite.config.ts` - Added define block for APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE
- `taskflow/vitest.config.ts` - Added same define block so constants resolve in test environment
- `taskflow/src-tauri/tauri.conf.json` - Version set to 0.0.0-dev placeholder; createUpdaterArtifacts: true added to bundle
- `taskflow/src/vite-env.d.ts` - ImportMetaEnv interface augmented with APP_VERSION, APP_COMMIT_SHA, APP_BUILD_DATE
- `taskflow/package.json` - Added inject-version and tauri:build scripts

## Decisions Made

- **inject-version.js → inject-version.cjs:** package.json has `"type": "module"` which makes .js files ES modules; the script uses `require()` (CommonJS), so it must use `.cjs` extension to avoid the "require is not defined in ES module scope" error.
- **vitest.config.ts define block:** The vitest.config.ts is separate from vite.config.ts and doesn't inherit the vite define block. Without it, `import.meta.env.APP_*` resolves as `undefined` in tests, causing all 4 tests to fail. Added the same define block to vitest.config.ts as a Rule 2 (missing critical functionality) fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed inject-version.js to inject-version.cjs**
- **Found during:** Task 1 (script verification step)
- **Issue:** `node scripts/inject-version.js` failed with "require is not defined in ES module scope" because package.json has `"type": "module"`
- **Fix:** Renamed file to `.cjs` extension and updated package.json script references accordingly
- **Files modified:** taskflow/scripts/inject-version.cjs, taskflow/package.json
- **Verification:** `node scripts/inject-version.cjs` outputs APP_VERSION=1.5.0, APP_COMMIT_SHA, APP_BUILD_DATE correctly
- **Committed in:** 50e0e76

**2. [Rule 2 - Missing Critical] Added define block to vitest.config.ts**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** All 4 tests failed with `typeof buildInfo.version === 'undefined'` because vitest.config.ts is separate from vite.config.ts and doesn't inherit the define block
- **Fix:** Added the identical define block to vitest.config.ts so import.meta.env.APP_* constants resolve during test runs
- **Files modified:** taskflow/vitest.config.ts
- **Verification:** All 4 build-info tests pass
- **Committed in:** 50e0e76

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes essential for functionality. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `updater.test.ts` and `update.store.test.ts` (stubs from parallel plan work) caused `npm run check` to report failures. These are out of scope — my new files pass `biome check` and TypeScript cleanly.

## Known Stubs

None — all constants fall back to well-defined default strings ("0.0.0-dev", "dev", "unknown").

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Build-time version injection pipeline complete and tested
- Plans 02+ (updater service, Tauri plugin configuration) can use `buildInfo.version` directly
- `tauri:build` script ready for CI to call with git tag available

---
*Phase: 38-updater-foundation-service-layer*
*Completed: 2026-03-24*
