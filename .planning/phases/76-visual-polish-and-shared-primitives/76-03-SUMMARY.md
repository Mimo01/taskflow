---
phase: 76-visual-polish-and-shared-primitives
plan: "03"
subsystem: settings-store
tags: [settings, persistence, migration, rank, backlog, discovery]
dependency_graph:
  requires: []
  provides: [rankFieldKey-in-settings-store, backlog-rank-discovery-seam]
  affects: [taskflow/src/stores/settings.store.ts, taskflow/src/routes/dashboard/BacklogPage.tsx]
tech_stack:
  added: []
  patterns: [discovered-field-key-persistence, zustand-migrate-version-bump, settings-store-discovery-useEffect]
key_files:
  created: []
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/stores/settings.store.test.ts
decisions:
  - "D-10: settings store bumped to v25 (was v24); v25 migration backfills rankFieldKey = null for upgrading users"
  - "D-11: rankFieldKey composed as customfield_${rankCustomFieldId}; probe-verified id 10105 -> customfield_10105; write-once guard (!rankFieldKey) prevents background poll re-triggering"
  - "rankFieldKey preserved across resetSettings('preferences') — discovered from Jira instance, not user preference"
metrics:
  duration_seconds: 130
  completed_date: "2026-06-03"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
  files_created: 0
---

# Phase 76 Plan 03: rankFieldKey Persistence + BacklogPage Discovery Summary

**One-liner:** Settings store v25 persists `rankFieldKey` (default null, preserved on preferences reset) and BacklogPage discovers it once from `backlog.rankCustomFieldId` as `customfield_${id}`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add rankFieldKey + v25 migration to settings store | `23f388c3` | `settings.store.ts` |
| 2 | Discover rankFieldKey in BacklogPage + add D-11 contract test | `903daa0b` | `BacklogPage.tsx`, `settings.store.test.ts` |

## What Was Built

**Task 1 — Settings store v25:**
- `rankFieldKey: null as string | null` added to `initialSettings` (8th discovered field key, after `quickFilters`)
- `rankFieldKey: string | null` + `setRankFieldKey: (key: string) => void` added to `SettingsState` interface with doc comment
- `setRankFieldKey: (key) => set({ rankFieldKey: key })` action added alongside `setFlaggedFieldKey`
- `rankFieldKey: s.rankFieldKey` preserved in `resetSettings('preferences')` branch — same pattern as the other 7 discovered keys
- `if (version < 25) { if (s.rankFieldKey === undefined) s.rankFieldKey = null; }` migration block appended after v24 block
- `version: 24` bumped to `version: 25`

**Task 2 — BacklogPage discovery seam + contract test:**
- `rankFieldKey` and `setRankFieldKey` added to the existing `useSettingsStore()` destructure
- Discovery `useEffect` added after `useGhBacklogData` call: writes `customfield_${backlog.rankCustomFieldId}` once, guarded by `!rankFieldKey` to prevent background poll re-trigger. `useEffect` already imported — no import change needed
- New `describe('settings.store — rankFieldKey (Phase 76)')` block in `settings.store.test.ts`: asserts (a) persist version is 25, (b) default `rankFieldKey` is `null`, (c) `setRankFieldKey('customfield_10105')` sets state to `'customfield_10105'` (D-11 composed-key contract for probe-verified id 10105)
- All 59 `settings.store.test.ts` tests GREEN; biome + tsc clean

## Verification

- `npx vitest run src/stores/settings.store.test.ts` — 59 tests passed
- `biome check ./src` — Checked 432 files in 83ms. No fixes applied.
- `tsc --noEmit` — clean (no output)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `rankFieldKey` is populated at runtime from the GreenHopper backlog response; the null default is correct until the first backlog load.

## Threat Flags

None. `rankFieldKey` is a non-secret field-id string (`customfield_10105`) on an already-authenticated trusted data path. No new trust boundaries introduced.

## Self-Check

- [x] `taskflow/src/stores/settings.store.ts` modified — FOUND
- [x] `taskflow/src/routes/dashboard/BacklogPage.tsx` modified — FOUND
- [x] `taskflow/src/stores/settings.store.test.ts` modified — FOUND
- [x] Commit `23f388c3` exists — FOUND
- [x] Commit `903daa0b` exists — FOUND

## Self-Check: PASSED
