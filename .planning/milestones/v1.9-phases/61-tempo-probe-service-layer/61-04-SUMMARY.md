---
plan: 61-04
phase: 61-tempo-probe-service-layer
status: complete
completed: 2026-05-21
subsystem: settings-ui
tags: [tempo, settings, integrations, toggle, tdd]
requires: [61-03]
provides: [tempo-toggle-ui]
affects: [taskflow/src/routes/settings/IntegrationsSection.tsx, taskflow/src/routes/settings/IntegrationsSection.test.tsx]
tech-stack:
  added: []
  patterns: [fine-grained-zustand-selectors, controlled-checkbox, tdd-red-green]
key-files:
  modified:
    - taskflow/src/routes/settings/IntegrationsSection.tsx
    - taskflow/src/routes/settings/IntegrationsSection.test.tsx
decisions:
  - "No sub-UI on Tempo enable (D-11) — bare toggle only; Phase 62 will add sidebar link"
  - "font-semibold on toggle title (UI-SPEC) not font-medium as used in AIO block"
metrics:
  duration: ~8 minutes
  tasks_completed: 2
  files_modified: 2
---

# Phase 61 Plan 04: Tempo Timesheets UI Toggle Summary

**One-liner:** Tempo Timesheets bare-toggle section added to Settings → Integrations, wired to `tempoEnabled`/`setTempoEnabled` from the v20 settings store, with 4 new TDD-green tests.

## What Was Built

### Task 1 — Extend IntegrationsSection.test.tsx (RED phase)

Extended the mock store type annotation and object literal to include `tempoEnabled: boolean` and `setTempoEnabled: ReturnType<typeof vi.fn>`. Added `mockStore.tempoEnabled = false` to three `beforeEach` reset blocks (the existing two describe blocks and the new one). Added a new `describe('Tempo Timesheets toggle (Phase 61)')` block with 4 tests:

1. **renders Tempo Timesheets checkbox** — `getByRole('checkbox', { name: /enable tempo timesheets/i })` is in the document
2. **checkbox is unchecked when tempoEnabled=false** — verifies default state
3. **checkbox is checked when tempoEnabled=true** — verifies controlled input
4. **toggling checkbox calls setTempoEnabled(true)** — verifies setter binding via `fireEvent.click`

Tests were intentionally RED at commit time (IntegrationsSection.tsx not yet modified).

### Task 2 — Add Tempo section to IntegrationsSection.tsx (GREEN phase)

Two additive edits:

1. **Selector additions** (after existing aio selectors):
   ```typescript
   const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
   const setTempoEnabled = useSettingsStore((s) => s.setTempoEnabled);
   ```

2. **JSX section** inserted after the AIO block's closing `</div>`, before the outer container's closing `</div>`:
   - `<div className="flex flex-col gap-4">` wrapper
   - `<h3>` with exact D-12 text "Tempo Timesheets" (uppercase, muted)
   - `<label>` with controlled `<input type="checkbox">` bound to `tempoEnabled`/`setTempoEnabled`
   - Exact D-12 description: "Show worklog data from Jira Tempo Timesheets. Requires Tempo plugin on your Jira instance."
   - No `{tempoEnabled && (...)}` conditional sub-UI (D-11 compliance)

## Verification Results

| Check | Result |
|-------|--------|
| `IntegrationsSection.test.tsx` targeted run | 18/18 passed (4 new Tempo + 14 prior) |
| `npx tsc --noEmit` | Clean (0 errors) |
| Full suite `npm test` | 1279 passed; 2 pre-existing failures in `src/services/jira.test.ts` (unrelated, confirmed pre-existed before this plan's changes via git stash verification) |

## Commit

| Hash | Message |
|------|---------|
| `54715fdd` | `feat(61-04): add Tempo Timesheets toggle to Settings → Integrations` |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The toggle is fully wired to the store. No placeholder data or mock values flow to the UI.

## Human Verification (Task 3): APPROVED

User confirmed all six steps in the running Tauri app:
- Tempo section appears below AIO section with correct copy and spacing
- Toggle is unchecked by default, checkbox on the right
- No sub-UI appears when enabled (bare toggle, D-11 compliant)
- Checked state persists across app quit + relaunch (v20 store migration confirmed)

## Self-Check: PASSED

- `/Users/user/Documents/Projects/taskflow/taskflow/src/routes/settings/IntegrationsSection.tsx` — exists, modified
- `/Users/user/Documents/Projects/taskflow/taskflow/src/routes/settings/IntegrationsSection.test.tsx` — exists, modified
- Commit `54715fdd` — verified present in git log
