---
phase: quick-260607-nm9
plan: "01"
subsystem: settings/avatar-cache
tags: [cache, settings, avatar, react-query, tdd]
dependency_graph:
  requires: []
  provides: [clearAvatarCache-service, clear-all-app-cache-ui]
  affects: [taskflow/src/services/avatarCache.ts, taskflow/src/routes/settings/DebugModeSection.tsx]
tech_stack:
  added: []
  patterns: [TDD red-green, inline-cleared-feedback, confirmation-dialog]
key_files:
  created: []
  modified:
    - taskflow/src/services/avatarCache.ts
    - taskflow/src/services/avatarCache.test.ts
    - taskflow/src/routes/settings/DebugModeSection.tsx
decisions:
  - "clearAvatarCache() resets inflight Map too — prevents stale in-flight promises from repopulating the cache immediately after clear"
  - "__cache_version__ sentinel key is preserved in the disk store during clear — no need to re-write it"
  - "Clear button has no disabled guard (unlike the notification row's itemCount check) — cache may always be cleared regardless of content"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-07"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 3
---

# Phase quick-260607-nm9 Plan 01: Add "Clear all app cache" Summary

**One-liner:** `clearAvatarCache()` service export + confirmation-gated Settings row that wipes avatar blob-URL memory cache, avatar-cache.json disk store, and react-query client cache.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing tests for clearAvatarCache | `56d20274` | avatarCache.test.ts |
| 1 (GREEN) | clearAvatarCache() service export | `6c534be5` | avatarCache.ts |
| 2 | "Clear all app cache" UI row | `52239935` | DebugModeSection.tsx |

## What Was Built

### Task 1: clearAvatarCache() service export (TDD)

Added `clearAvatarCache(): Promise<void>` to `taskflow/src/services/avatarCache.ts`:

- Iterates `memoryCache` revoking each blob URL via `URL.revokeObjectURL`
- Resets `memoryCache` and `inflight` to new empty Maps
- Reads `diskStore.keys()`, deletes every key except `__cache_version__`, then calls `diskStore.save()`
- All disk ops wrapped in `.catch(() => {})` — function never throws

4 new tests (Tests 17-20) covering: memory cleared, blob URLs revoked, disk keys deleted, no-throw guarantee. All 20 tests pass.

### Task 2: "Clear all app cache" row in Advanced > Data

Added a second row to the Data subsection in `DebugModeSection.tsx`, below "Clear notification cache":

- `useQueryClient` hook for react-query cache
- `const [cacheCleared, setCacheCleared] = useState(false)` separate from existing `cleared` state
- `handleClearCache()` async handler: `await clearAvatarCache(); queryClient.clear(); setCacheCleared(true)` + 3s reset
- Dialog: title "Clear all app cache?", description explains what is and is NOT cleared, destructive confirm "Clear cache"
- Clear button always enabled (no itemCount guard)
- When cleared: emerald inline Check + "Cleared" indicator, matching existing notification row pattern

## Verification

- `npx vitest run src/services/avatarCache.test.ts` — 20/20 passed
- `npx vitest run src/routes/settings/Settings.test.tsx` — 15/15 passed
- `npm run check` (biome + tsc) — GREEN (biome auto-fixed import order)

## Checkpoint: Task 3 (human-verify)

**Awaiting manual verification** — Task 3 is a `checkpoint:human-verify`. The executor does not run the GUI app.

**To verify:**
1. Run `cd taskflow && npm run tauri dev`
2. Open Settings → Advanced → Data — confirm two rows: "Clear notification cache" and "Clear all app cache"
3. Populate the avatar cache (visit Backlog/Board to load avatars)
4. Click "Clear" on the new row → confirm dialog appears → click "Clear cache"
5. Row shows inline green "Cleared" indicator (no toast)
6. Navigate to pages with avatars — they re-fetch correctly; no errors
7. Verify settings, sidebar config, and Jira/GitLab connections are untouched

**Resume signal:** Type "approved" or describe issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome import order auto-fixed**
- **Found during:** Task 2 verification (`npm run check`)
- **Issue:** `useQueryClient` import was placed after lucide-react/react imports; biome `organizeImports` flagged it
- **Fix:** Ran `biome check --write` to auto-apply the safe import reorder (`@tanstack/react-query` moves to top as an external package)
- **Files modified:** `taskflow/src/routes/settings/DebugModeSection.tsx`
- **Not a separate commit** — fixed before the Task 2 commit

**2. [Rule 3 - Blocking] node_modules not present in worktree**
- **Found during:** Task 1 test run
- **Issue:** The worktree at `.claude/worktrees/agent-ab3fc507348efa8c9/taskflow/` has no `node_modules/` (they live in the main repo)
- **Fix:** Created a symlink: `ln -sf /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules <worktree>/taskflow/node_modules`
- **No code change** — infrastructure-only fix

## Known Stubs

None — all data paths are fully wired.

## Threat Flags

None — this change adds a destructive-but-safe cache-clear action behind a confirmation dialog. No new network endpoints, auth paths, or trust boundary changes introduced.

## Self-Check: PASSED

- FOUND: taskflow/src/services/avatarCache.ts
- FOUND: taskflow/src/services/avatarCache.test.ts
- FOUND: taskflow/src/routes/settings/DebugModeSection.tsx
- FOUND commit 56d20274 (RED test)
- FOUND commit 6c534be5 (GREEN impl)
- FOUND commit 52239935 (UI row)
