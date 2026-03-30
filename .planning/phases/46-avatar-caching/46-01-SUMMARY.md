---
phase: 46-avatar-caching
plan: 01
subsystem: ui
tags: [avatar, caching, blob-url, lazystore, tauri-plugin-store, tauri-plugin-http, react-hook]

# Dependency graph
requires: []
provides:
  - avatarCache.ts singleton service (Map + LazyStore, inflight dedup, 30-day TTL, chunked base64)
  - useAvatarCache hook (sync cache hit, async fetch, cancellation)
  - CachedAvatar component (initials fallback, instant swap to image, 4 sizes, ARIA accessible)
  - 13 unit tests covering all cache behaviors and component states
affects: [46-02-avatar-wiring, any phase using user avatars]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level singleton cache: Map + LazyStore, no React Context/TanStack Query"
    - "Inflight deduplication with Promise Map (same URL collapses concurrent requests)"
    - "Chunked uint8ToBase64 (8192 bytes/chunk) to prevent stack overflow on large blobs"
    - "LazyStore mock with shared filename-keyed backing store for test isolation"
    - "vi.spyOn(URL, 'createObjectURL') pattern instead of vi.stubGlobal (preserves constructor)"

key-files:
  created:
    - taskflow/src/services/avatarCache.ts
    - taskflow/src/services/avatarCache.test.ts
    - taskflow/src/hooks/useAvatarCache.ts
    - taskflow/src/components/ui/cached-avatar.tsx
    - taskflow/src/components/ui/cached-avatar.test.tsx
  modified:
    - taskflow/src/test/setup.ts

key-decisions:
  - "LazyStore mock upgraded to share state by filename so resetForTesting() and test instances see same disk data"
  - "vi.spyOn(URL, 'createObjectURL') used instead of vi.stubGlobal('URL', ...) to preserve URL as constructor"
  - "resetForTesting() exported from avatarCache.ts to enable per-test module state isolation"
  - "Jira URL auth detection via useAuthStore.getState().jiraBaseUrl, matching AuthImage.tsx pattern"
  - "blob URLs not revoked on component unmount — only on evictAvatar() (shared cache pattern)"

patterns-established:
  - "Pattern 1: Module-level singleton with resetForTesting() for test isolation without module re-import"
  - "Pattern 2: Filename-keyed LazyStore mock so multiple instances of same store share backing data"
  - "Pattern 3: vi.spyOn on URL static methods — safe for tests that need URL as constructor elsewhere"

requirements-completed: [CACH-01, CACH-02]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 46 Plan 01: Avatar Caching Infrastructure Summary

**Module-level blob URL cache with Map + LazyStore persistence, 30-day TTL eviction, inflight dedup, and CachedAvatar component with initials-first rendering**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T14:11:05Z
- **Completed:** 2026-03-30T14:16:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Avatar cache service with Map (in-memory) + LazyStore (disk) persistence, zero extra dependencies
- Inflight deduplication ensures concurrent requests for same URL fire only one network fetch
- CachedAvatar component renders initials immediately then swaps to blob image with no layout shift
- 13 unit tests (8 service + 5 component) covering all cache states, TTL eviction, error paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Avatar cache service with tests and test infrastructure** - `8ba1f64` (feat)
2. **Task 2: useAvatarCache hook and CachedAvatar component with tests** - `ae46ebd` (feat)

**Plan metadata:** (pending final commit)

_Note: TDD tasks committed with both test and implementation in one commit per task_

## Files Created/Modified

- `taskflow/src/services/avatarCache.ts` - Singleton cache service: initAvatarCache, getCachedBlobUrl, fetchAndCacheAvatar, evictAvatar, resetForTesting
- `taskflow/src/services/avatarCache.test.ts` - 8 unit tests: memory hit, inflight dedup, sync getCachedBlobUrl, disk init, TTL eviction, eviction, 500 error, empty blob
- `taskflow/src/hooks/useAvatarCache.ts` - React hook with sync init, async fetch, cancellation guard
- `taskflow/src/components/ui/cached-avatar.tsx` - CachedAvatar component + getInitials export
- `taskflow/src/components/ui/cached-avatar.test.tsx` - 5 unit tests: no-url, loading, cache hit, initials, size prop
- `taskflow/src/test/setup.ts` - LazyStore mock upgraded: added keys() method and filename-keyed shared store registry

## Decisions Made

- LazyStore mock upgraded to share backing data by filename (via a `stores: Map<filename, Map>` registry in the mock factory). This enables `resetForTesting()` in the service module and manual `new LazyStore(...)` in tests to see the same disk state, which is required for the disk init test.
- `vi.spyOn(URL, 'createObjectURL')` instead of `vi.stubGlobal('URL', {...})`. The stubGlobal approach replaces URL with a plain object, breaking `new URL(...)` usage anywhere in the test environment. Spying on the static method preserves the constructor.
- `resetForTesting()` always exported (not guarded by `import.meta.env.MODE`). The function is a no-op in production since nothing calls it — simpler than conditional export.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LazyStore mock instance isolation broke disk init test**
- **Found during:** Task 1 (GREEN phase, Test 4)
- **Issue:** Each `new LazyStore(filename)` created an independent `Map`, so data written by test setup into one instance was invisible to the module's private instance. Test 4 always returned null.
- **Fix:** Upgraded LazyStore mock in setup.ts to use a module-level `stores: Map<string, Map>` registry keyed by filename. Added `static clearStore(filename)` helper for test cleanup. All instances with same filename now share state.
- **Files modified:** taskflow/src/test/setup.ts
- **Verification:** Test 4 passes (disk init populates memoryCache from LazyStore)
- **Committed in:** 8ba1f64

**2. [Rule 1 - Bug] vi.stubGlobal('URL') broke URL as constructor**
- **Found during:** Task 1 (GREEN phase, first run)
- **Issue:** Plan specified using `vi.stubGlobal('URL', {...URL, createObjectURL: vi.fn()})`. This replaced URL with a plain object, causing `TypeError: URL is not a constructor` when LazyStore or other code used `new URL(...)`.
- **Fix:** Replaced with `vi.spyOn(URL, 'createObjectURL').mockImplementation(...)` and same for revokeObjectURL. Spying patches only the static methods, not the constructor.
- **Files modified:** taskflow/src/services/avatarCache.test.ts
- **Verification:** All 8 tests pass with no constructor errors
- **Committed in:** 8ba1f64

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in test setup)
**Impact on plan:** Both fixes were in test infrastructure only. Production code unchanged. No scope creep.

## Issues Encountered

- No node_modules in worktree (parallel execution environment) — installed with `npm install --prefer-offline` before running tests. This added ~2 min to setup but was a one-time worktree initialization cost.

## User Setup Required

None - no external service configuration required. All dependencies already installed.

## Next Phase Readiness

- avatarCache.ts, useAvatarCache.ts, and CachedAvatar are ready for Plan 02 wiring
- Plan 02 will replace 11+ inline avatar `<img>` usages across the codebase with `<CachedAvatar />`
- initAvatarCache() needs to be called in main.tsx before first render (Plan 02 task)
- Full test suite green: 792 tests passed, no regressions

## Known Stubs

None — all exports are fully implemented and tested. No placeholder data or TODO stubs.

---
*Phase: 46-avatar-caching*
*Completed: 2026-03-30*
