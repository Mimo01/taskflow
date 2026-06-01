---
phase: 72
plan: 03
subsystem: services/jira (cutover)
tags: [greenhopper, cutover, deletion, jira, transitions, gh-cut-01]
requires:
  - Plan 72-01 (GH cache surface: useGhTransitions / getGhTransitions / invalidateGhTransitions + JiraTransition retained)
  - Plan 72-02 (four dashboard call sites migrated; no dashboard consumer left importing the legacy GET)
provides:
  - Zero references to the legacy per-issue REST GET fetcher across src/
  - postTransition (POST path) preserved as the permanent transition-write surface
  - JiraTransition interface preserved at src/services/jira.ts (consumed by the GH adapter)
affects:
  - taskflow/src/services/jira.ts (legacy GET function + JSDoc removed; postTransition JSDoc note updated)
  - taskflow/src/services/jira/transitions.ts (legacy GET function removed; top-of-file JSDoc rewritten to "POST operation"; unused JiraTransition type import dropped)
  - taskflow/src/services/jira.test.ts (legacy GET describe block + named import removed; file-header comment relabelled)
  - taskflow/src/services/jira/transitions.test.ts (describe('fetchTransitions',...) block + named import removed; describe('postTransition',...) preserved)
  - taskflow/src/routes/dashboard/StatusPopover.test.tsx (header + guard-test comments rephrased so no fetchTransitions literal remains)
  - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx (mock comment + one it() name rephrased)
  - taskflow/src/routes/dashboard/BulkActionBar.test.tsx (file-header rephrased)
  - taskflow/src/routes/dashboard/QuickCreateInput.test.tsx (file-header rephrased)
tech-stack:
  added: []
  patterns:
    - "Hard cutover per surface (GH-CUT-01) — legacy GET deleted in lockstep with its replacements going green"
key-files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/transitions.ts
    - taskflow/src/services/jira.test.ts
    - taskflow/src/services/jira/transitions.test.ts
    - taskflow/src/routes/dashboard/StatusPopover.test.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/BulkActionBar.test.tsx
    - taskflow/src/routes/dashboard/QuickCreateInput.test.tsx
decisions:
  - "Hard grep gate (`grep -rn 'fetchTransitions' src --include='*.ts' --include='*.tsx' | grep -v '^#'`) interpreted strictly — the `-v '^#'` filter only strips shell/markdown comments, not TS // or block comments. To satisfy the gate at 0 hits the residual `fetchTransitions` literal had to be scrubbed from explanatory comments and test descriptors in the four dashboard test files Plan 02 left behind (10 such hits per Plan 02 SUMMARY). All scrubs preserve meaning — the descriptive text now references 'the legacy per-issue REST GET path' instead of the function name."
metrics:
  duration: ~10 minutes
  completed: 2026-05-29
---

# Phase 72 Plan 03: Legacy fetchTransitions Cutover Summary

Deleted both copies of the legacy per-issue Jira REST GET fetcher (the `fetchTransitions` function in `services/jira.ts` and in `services/jira/transitions.ts`) along with their tests, completing the hard cutover specified by D-08 and the milestone-level GH-CUT-01. After this plan the codebase has **zero references** to the legacy fetcher name across `src/` (the hard grep gate is at 0). `postTransition` (the POST path that performs the actual transition) and the `JiraTransition` interface (consumed as the GH adapter's return type) are both preserved.

## What Shipped

### Task 1 — commit `878cd8fe`

**`src/services/jira.ts`**
- Deleted the legacy GET function block at former lines 680-721 (JSDoc + signature + body + closing brace). Approximately ~42 lines removed.
- Updated the JSDoc above `postTransition` (line ~729): the `@param transitionId` line now reads "Transition ID (from useGhTransitions / getGhTransitions)" — the dangling reference to the now-deleted GET is gone.
- **Preserved:** the `JiraTransition` interface at lines ~183-191 (the GH adapter in `services/jira/greenhopper/transitions.ts` returns this exact shape — `grep -c 'export interface JiraTransition' = 1`).
- **Preserved:** all four Plan 01 re-exports (`useGhTransitions` x2, `getGhTransitions` x2, `invalidateGhTransitions` x1, `fetchAllJiraStatuses` x1).

**`src/services/jira/transitions.ts`**
- Deleted the legacy GET function block at former lines 12-45 (~34 lines).
- Top-of-file JSDoc rewritten:
  - Before: "Jira issue transition operations."
  - After: "Jira issue transition POST operation. The legacy per-issue REST GET path was removed in Phase 72 (D-08 / GH-CUT-01)."
- Dropped the now-unused `import type { JiraTransition } from './types';` line (grep `JiraTransition` in this file returns 0).
- **Preserved:** `postTransition` exactly as-is (grep `export async function postTransition = 1`).

**`src/services/jira.test.ts`**
- Removed `fetchTransitions` from the named-import list (~line 21).
- Removed the `describe('fetchTransitions', ...)` block (former lines 213-228) — one test case (DEV-02).
- Updated the file-header comment to drop the DEV-02 reference: "DEV-01, DEV-03, DEV-04: Phase 2 Jira sprint & transition functions (DEV-02 legacy GET path removed in Phase 72-03 per D-08 / GH-CUT-01)."
- Preserved the surrounding `describe('postTransition', ...)` cases (DEV-03) intact.

**`src/services/jira/transitions.test.ts`**
- Removed `fetchTransitions` from the named-import line: `import { postTransition } from './transitions';`.
- Removed the entire `describe('fetchTransitions', ...)` block (former lines 18-41) — 2 test cases.
- Preserved the `describe('postTransition', ...)` block (2 cases) and the shared `vi.mock`/`beforeEach` scaffolding.

**Dashboard test-file comment scrub** — required to satisfy the hard grep gate at 0 hits:
- `StatusPopover.test.tsx` — header comment, mock-block comment, and the it()'s body comment + name rephrased to "the legacy REST GET fetcher" / "the legacy per-issue REST GET path"; the source-grep guard test logic is unchanged (the assertion that StatusPopover loads against a narrow mock still holds).
- `SprintBoardTab.test.tsx` — the jira-service mock block comment and one it() name rephrased.
- `BulkActionBar.test.tsx` — file-header docblock rephrased; biome autofix applied a one-line reformat of the `getGhTransitions: vi.fn().mockResolvedValue([...])` block to satisfy line-width (the header shifted line counts).
- `QuickCreateInput.test.tsx` — file-header docblock rephrased.

No production behavior changed in the dashboard files; only comments and one test descriptor string.

## Verification

```
$ cd taskflow && grep -rn 'fetchTransitions' src --include='*.ts' --include='*.tsx' | grep -v '^#' | wc -l
0
$ ./node_modules/.bin/tsc --noEmit -p .
(no output — clean)
$ ./node_modules/.bin/vitest run
Test Files  140 passed | 3 skipped (143)
     Tests  1649 passed | 2 skipped | 18 todo (1669)
   Duration  9.52s
$ ./node_modules/.bin/biome check <8 touched files>
Checked 8 files in 19ms. No fixes applied.
```

Re-run on touched files only: `6 files, 132 tests, all passed`.

## Acceptance Assertions

| Assertion | Expected | Actual |
|-----------|----------|--------|
| `grep -rn 'fetchTransitions' src --include='*.ts' --include='*.tsx' \| grep -v '^#' \| wc -l` (hard D-08 gate) | 0 | 0 |
| `grep -c 'export async function fetchTransitions' src/services/jira.ts` | 0 | 0 |
| `grep -c 'export async function fetchTransitions' src/services/jira/transitions.ts` | 0 | 0 |
| `grep -c 'export async function postTransition' src/services/jira/transitions.ts` | 1 | 1 |
| `grep -c 'export interface JiraTransition' src/services/jira.ts` | 1 | 1 |
| `grep -c 'useGhTransitions' src/services/jira.ts` | ≥ 1 | 2 |
| `grep -c 'getGhTransitions' src/services/jira.ts` | ≥ 1 | 2 |
| `grep -c 'invalidateGhTransitions' src/services/jira.ts` | ≥ 1 | 1 |
| `grep -c 'fetchAllJiraStatuses' src/services/jira.ts` | ≥ 1 | 1 |
| tsc --noEmit | exit 0 | exit 0 |
| vitest run (full suite) | exit 0 / no failures | exit 0 / 0 failures |
| biome check (touched files) | exit 0 | exit 0 |

## Deviations from Plan

### In-scope cleanup beyond the literal task description

**1. [Rule 2 — Critical scope expansion] Dashboard test-file comments scrubbed**
- **Found during:** Step 6 (hard grep gate) after deleting the function blocks. The grep returned 10 lines, all from `routes/dashboard/*.test.tsx`. Plan 02's SUMMARY already flagged these 10 hits as "all in comments / test descriptors" — they remained because Plan 02 did not own the deletion gate. The Plan 03 hard gate (`grep ... | grep -v '^#' | wc -l = 0`) does not exempt JS/TS comments — `-v '^#'` only filters lines beginning with `#` (shell/markdown). To reach 0, these literal `fetchTransitions` mentions had to go.
- **Fix:** Rephrased headers / comments / one it() descriptor to reference "the legacy per-issue REST GET path" or "the legacy REST GET fetcher" instead of the function name. No assertion logic or mock surface changed. The source-grep guard in StatusPopover.test.tsx still verifies the mock-narrow import path holds.
- **Files modified:** `routes/dashboard/StatusPopover.test.tsx`, `routes/dashboard/SprintBoardTab.test.tsx`, `routes/dashboard/BulkActionBar.test.tsx`, `routes/dashboard/QuickCreateInput.test.tsx`.
- **Commit:** `878cd8fe`.

**2. [Rule 1 — Bug from edit cascade] Biome line-width violation after header rewrite in BulkActionBar.test.tsx**
- **Found during:** Step 7 (biome run).
- **Issue:** Rephrasing the BulkActionBar.test.tsx file-header docblock added one line, shifting the `getGhTransitions: vi.fn().mockResolvedValue([...])` array literal across biome's line-width threshold.
- **Fix:** Ran `biome check --write` on the single file. Biome rewrote the value as a chained call (`vi.fn().mockResolvedValue([...])` flattened) — semantics identical, only formatting changed.
- **Files modified:** `routes/dashboard/BulkActionBar.test.tsx`.
- **Commit:** `878cd8fe` (folded into the same commit).

No architectural changes were introduced. No new files. No package installs.

## Threat Surface

No new threat flags. The plan's `<threat_model>` covers all introduced surface:
- T-72-13 (accidental deletion of postTransition / JiraTransition): mitigated — both grep-asserted retained (counts 1 / 1).
- T-72-14 (Plan 02 left a consumer behind): mitigated — Step 1 pre-flight grep on `src/routes/dashboard/` returned 10 hits, all confirmed by inspection to be comments/test descriptors (zero imports, zero call expressions).
- T-72-15 (stale mock/import surfaces in future audit): mitigated — the hard gate at `src/` covers `.ts` + `.tsx` and reads 0.
- T-72-16 (cutover audit): standard git history.
- T-72-SC (package installs): no packages installed.

## Known Stubs

None.

## Legacy Code Status

- `src/services/jira.ts` — legacy GET deleted; `JiraTransition` interface and the four Plan 01 re-exports preserved.
- `src/services/jira/transitions.ts` — legacy GET deleted; `postTransition` (POST path) preserved.
- `src/services/jira.test.ts` / `src/services/jira/transitions.test.ts` — `fetchTransitions` test cases gone; `postTransition` test cases preserved.

## Self-Check: PASSED

Files verified to exist (relative to worktree root):

- FOUND: taskflow/src/services/jira.ts (modified)
- FOUND: taskflow/src/services/jira/transitions.ts (modified)
- FOUND: taskflow/src/services/jira.test.ts (modified)
- FOUND: taskflow/src/services/jira/transitions.test.ts (modified)
- FOUND: taskflow/src/routes/dashboard/StatusPopover.test.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/SprintBoardTab.test.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/BulkActionBar.test.tsx (modified)
- FOUND: taskflow/src/routes/dashboard/QuickCreateInput.test.tsx (modified)

Commits verified in `git log`:

- FOUND: 878cd8fe feat(72-03): delete legacy fetchTransitions GET + tests (D-08 / GH-CUT-01)
