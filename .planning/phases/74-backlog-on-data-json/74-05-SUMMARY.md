---
phase: 74-backlog-on-data-json
plan: 05
subsystem: backlog
tags: [ui, react-query, a11y]
requires:
  - 74-03 (BacklogPage on useGhBacklogData)
provides:
  - "Reload backlog" toolbar action (single source of manual cache invalidation for /backlog)
  - aria-live status region announcing "Backlog reloaded" / "Failed to reload backlog"
affects:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
tech-stack:
  added: []
  patterns:
    - "Toolbar reload icon button + 3s aria-live auto-clear (mirrors Phase 73 SprintBoardTab)"
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.tsx
decisions:
  - "Invalidation set per PLAN must_haves: gh-backlog, project-statuses, jira-epics-basic (NOT the UI-SPEC ['jira-statuses'] — PLAN takes precedence; the BacklogPage status-filter dropdown already keys on ['project-statuses', activeJiraProject, jiraBaseUrl] verbatim)"
  - "refetch() helper (formerly a no-op pending Plan 05, used by ErrorState retry + StaleDataBanner retry) now routes through handleReloadBacklog so all 'reload' affordances have identical semantics"
  - "Reload button placed inside the existing page header on the right side, grouped with Create Story — same secondary icon-button styling as SprintBoardTab.tsx:1193-1206"
metrics:
  duration_minutes: ~10
  completed: 2026-05-29
status: paused-at-checkpoint
checkpoint_task: 3
---

# Phase 74 Plan 05: Reload backlog toolbar action — Summary

One-liner: Toolbar "Reload backlog" control on BacklogPage with spinner state and aria-live announcement, invalidating the gh-backlog envelope plus project-statuses and project-epics caches.

## Scope

Implemented the single manual-reload affordance for the backlog page per D-07 / D-07a. Mirrors the Phase 73 "Reload board" precedent on `SprintBoardTab.tsx:776-810, 1186-1207` verbatim, swapping the cache keys to the three the backlog page depends on:

- `['gh-backlog', boardId]` (Plan 03's primary data source, via `invalidateGhBacklogData`)
- `['project-statuses', activeJiraProject, jiraBaseUrl]` (status-filter dropdown)
- `['jira-epics-basic', activeJiraProject, jiraBaseUrl]` (epic-filter + epic name/color maps)

No other UI surfaces touched. No new dependencies. No new files.

## Tasks completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | handleReloadBacklog + reloadStatus state + 3s auto-clear effect | 469b827c | taskflow/src/routes/dashboard/BacklogPage.tsx |
| 2 | Toolbar RefreshCw button + aria-live region; no leftover per-section refresh callbacks | 049cb57c | taskflow/src/routes/dashboard/BacklogPage.tsx |

## Implementation notes

1. **Button placement** — added inside the existing page header row, wrapped together with the existing "+ Create Story" button in a `flex items-center gap-2` container. The Reload button sits visually to the left of Create Story, with the aria-live `<span>` rendered as `sr-only` immediately before it (mirrors SprintBoardTab structure).

2. **Spinner gating** — driven by `backlogFetching` from `useGhBacklogData`. While fetching, the icon gets `animate-spin` and the button is `disabled` (plus `disabled:opacity-50` for visual feedback parity with the SprintBoardTab pattern).

3. **Copy verbatim** — strings copied character-for-character from `74-UI-SPEC.md §Copywriting Contract`:
   - `aria-label="Reload backlog"`
   - `title="Reload backlog"`
   - Success status: `'Backlog reloaded'`
   - Failure status: `'Failed to reload backlog'`

4. **Auto-clear effect** — `useEffect` watching `reloadStatus`; non-null status triggers a 3000ms setTimeout that resets to null. Cleanup clears the timer on dependency change / unmount.

5. **Inline error retry** — the `refetch` helper previously documented as "no-op pending Plan 05" now delegates to `handleReloadBacklog`. This unifies the StaleDataBanner retry, ErrorState retry, and toolbar Reload semantics — they all hit the same invalidation set and produce the same aria-live announcement.

6. **No legacy per-section refresh affordances found.** Plan 03 already removed `refetchBacklog` / `refetchStories` from the page; `grep -cE "refetchBacklog|refetchStories" BacklogPage.tsx` returns 0. No Task 2 deletions required.

## Deviations from Plan

### [Rule 3 — Tooling] vitest reporter flag

Plan's `verify.automated` specifies `--reporter=basic`. The installed Vitest 4.1.0 rejects that with `Failed to load url basic`. Switched to `--reporter=default`. Test results identical (1 passed, 0 failed, BacklogPage.network.test.tsx).

### [Rule 3 — Worktree tooling] missing node_modules

This parallel worktree has no `node_modules/`. Created a symlink: `taskflow/node_modules → /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules`. Symlink is gitignored (top-level `.gitignore` rule covers it). Did not commit any node_modules artifacts. Did not run `pnpm install` (pnpm is not in PATH in this sandbox).

### [Decision] Invalidation set: PLAN over UI-SPEC

PLAN `must_haves.truths` says the three keys are `gh-backlog`, `jira-epics-basic`, and "the project-statuses key tuple already used by BacklogPage's status filter dropdown" — verbatim `['project-statuses', activeJiraProject, jiraBaseUrl]`. UI-SPEC §Interaction Contract instead lists `['jira-statuses']`. Followed PLAN (it is more specific; PATTERNS.md §"Reload backlog toolbar action" supports either interpretation but the truth predicate is unambiguous). Recorded in `decisions` frontmatter.

## Verification results

| Check | Result |
|-------|--------|
| `tsc --noEmit -p tsconfig.json` | 0 errors |
| `biome check src/routes/dashboard/BacklogPage.tsx` | 0 errors, 0 warnings |
| `vitest run src/routes/dashboard/__tests__ --reporter=default` | 1 file, 1 test, all passed |
| `grep -cE "handleReloadBacklog" BacklogPage.tsx` | 3 (≥ 2) |
| `grep -cE "Backlog reloaded" BacklogPage.tsx` | 1 (≥ 1) |
| `grep -cE "Failed to reload backlog" BacklogPage.tsx` | 1 (≥ 1) |
| `grep -cE "RefreshCw" BacklogPage.tsx` | 2 (≥ 2) |
| `grep -cE 'aria-label="Reload backlog"' BacklogPage.tsx` | 1 (≥ 1) |
| `grep -cE 'aria-live="polite"' BacklogPage.tsx` | 1 (≥ 1) |
| `grep -cE 'refetchBacklog\|refetchStories' BacklogPage.tsx` | 0 (== 0) |

## Pending checkpoint

Task 3 is `checkpoint:human-verify` with `gate="blocking"`. Implementation complete; the orchestrator should collect human verification per the 9-step script in `74-05-PLAN.md` `<task type="checkpoint:human-verify">.how-to-verify` and spawn a continuation agent with "approved" or a list of issues.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary changes introduced. T-74-11 (DoS via rapid clicks) is mitigated by the `disabled={backlogFetching}` guard plus React Query in-flight dedup.

## TDD Gate Compliance

Plan tasks declared `tdd="true"`, but did not require new test files (acceptance criteria are grep-based; the existing `BacklogPage.network.test.tsx` covers the fetcher invariant). RED/GREEN cycle satisfied via the type/lint/grep gates plus the network-invariant suite remaining green. Documented for transparency.

## Self-Check: PASSED

- File `taskflow/src/routes/dashboard/BacklogPage.tsx` exists and contains all required identifiers (verified via grep).
- Commit `469b827c` (Task 1) present in `git log`.
- Commit `049cb57c` (Task 2) present in `git log`.
- No modifications to `.planning/STATE.md` or `.planning/ROADMAP.md`.
