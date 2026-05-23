---
phase: quick-260514-qr8
plan: "01"
subsystem: settings/integrations
tags: [settings, aio, ui, sort]
dependency_graph:
  requires: []
  provides: [alphabetically-sorted-aio-project-dropdown]
  affects: [taskflow/src/routes/settings/IntegrationsSection.tsx]
tech_stack:
  added: []
  patterns: [useMemo for derived sorted list, localeCompare case-insensitive sort]
key_files:
  modified:
    - taskflow/src/routes/settings/IntegrationsSection.tsx
    - taskflow/src/routes/settings/IntegrationsSection.test.tsx
decisions:
  - useMemo keyed on projects prevents re-sorting on every render
  - localeCompare with sensitivity:'base' gives case-insensitive locale-aware ordering
  - Spread-before-sort ([...projects].sort) avoids mutating the React Query cache
metrics:
  duration: ~5 minutes
  completed: "2026-05-14T17:21:04Z"
---

# Quick Task 260514-qr8: Sort AIO Project Options Alphabetically in Settings

**One-liner:** Alphabetical (case-insensitive, locale-aware) AIO project dropdown sort via useMemo+localeCompare in Settings Integrations section.

## What Was Done

Added `sortedProjects` derived via `useMemo` in `IntegrationsSection.tsx` — a spread-sorted copy of the `projects` array using `localeCompare` with `sensitivity: 'base'` for case-insensitive ordering. The `SelectContent` now renders `sortedProjects.map` instead of `(projects ?? []).map`. The original `projects` array (React Query cache) is never mutated.

## Commits

| Task | Type | Commit | Description |
|------|------|--------|-------------|
| Task 1 (RED) | test | a71a8b2 | add failing alphabetical-sort assertions for AIO project picker |
| Task 1 (GREEN) | feat | c59176c | sort AIO project options alphabetically by name in Settings |

## TDD Gate Compliance

- RED gate: `test(quick-260514-qr8-01)` commit a71a8b2 — 2 new tests failing (alphabetical order assertion + case-insensitive test)
- GREEN gate: `feat(quick-260514-qr8-01)` commit c59176c — all 14 tests passing

## Test Results

All 14 `IntegrationsSection.test.tsx` tests pass, including:
- `renders the project list when aioEnabled is true and the query resolves` — now asserts alphabetical order from a non-alphabetical mock
- `sorts AIO project options alphabetically by name (case-insensitive)` — new test with mixed-case names (charlie, Alpha, bravo) asserts Alpha → bravo → charlie order

## Files Modified

### `taskflow/src/routes/settings/IntegrationsSection.tsx`

- Added `useMemo` to React import
- Added `sortedProjects` memoized derivation after `selectedProject` (lines ~42-47):
  ```ts
  const sortedProjects = useMemo(
    () => projects ? [...projects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })) : [],
    [projects],
  );
  ```
- Replaced `(projects ?? []).map(...)` with `sortedProjects.map(...)` in `SelectContent`

### `taskflow/src/routes/settings/IntegrationsSection.test.tsx`

- Updated `'renders the project list'` test: mock now returns projects in non-alphabetical order (Three, One, Two); assertion checks rendered order is One, Three, Two
- Added new test `'sorts AIO project options alphabetically by name (case-insensitive)'` with mixed-case inputs

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — UI-only render-order change with no new network surface.

## Self-Check

- [x] `taskflow/src/routes/settings/IntegrationsSection.tsx` — exists and modified
- [x] `taskflow/src/routes/settings/IntegrationsSection.test.tsx` — exists and modified
- [x] commit a71a8b2 — RED gate confirmed
- [x] commit c59176c — GREEN gate confirmed
- [x] 14/14 tests passing

## Self-Check: PASSED
