---
quick_id: 260523-mqj
type: quick
plan: 1
description: fix all failing tests
status: complete
completed: 2026-05-23
duration: ~6m
key-files:
  modified:
    - taskflow/src/routes/dashboard/index.tsx
  created:
    - .planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md
commits:
  - 55ab38c8  # fix(tests): dashboard greeting parses first name from token[0] (cluster C1)
  - 29dac3e7  # fix(tests): move dashboard ambient SVG inside hero section (cluster C2)
metrics:
  failures_at_triage: 3
  clusters_total: 2
  clusters_fixed: 2
  clusters_blocked: 0
  final_test_files: "114 passed | 5 skipped (119)"
  final_tests: "1334 passed | 2 skipped | 39 todo (1375)"
---

# Quick Task 260523-mqj: Fix All Failing Tests — Summary

Restored a green Vitest suite by fixing two distinct root causes in the Dashboard hero component: an inverted name-token index that surfaced the surname as the greeting, and an out-of-section decorative SVG that violated the Test 6 DOM contract.

## Final Test Result

- **Before:** 1 file failed, 3 tests failed (113 passed | 5 skipped, 1331 tests passed | 2 skipped | 39 todo).
- **After:** 0 failed, **114 passed | 5 skipped (119)** test files, **1334 passed | 2 skipped | 39 todo (1375)** tests.
- Skip and todo counts are identical between runs — no tests were muted, skipped, or weakened to fake a pass.
- `npm test` from `taskflow/` exits 0.

## Per-Cluster Outcome

| Cluster | Status | Commit | Root cause (one-line) |
| --- | --- | --- | --- |
| C1 — Dashboard name parsing inverted (Tests 1 + 2) | FIXED | `55ab38c8` | Source parsed `displayName` as `"Surname Firstname [Status]"` (tokens[1]), but live Jira returns `"Firstname Surname"` (2 tokens). Switched to tokens[0] with a defensive `[Status]` strip. |
| C2 — Dashboard hero SVG placement (Test 6) | FIXED | `29dac3e7` | Decorative SVG was a sibling of `<section>`; Test 6 contract requires `document.querySelector('section svg')` to find it. Moved SVG inside the section with `overflow-hidden` bounding and `relative` text layering. |

## Why production code (not the tests) was the bug

Both clusters fall under "test was right, source was wrong":

- **C1:** Commit `8adc3169` (2026-05-21) hypothesised that Jira returns `"Surname Firstname [Status]"`, but the same day's quick-plan `260521-t6m` documented the real shape as the 2-token form `"Milan Mozolak"`. The test mocks (`'Alice Doe'`, `'Milan Mozolak'`) encode the Firstname-Surname convention; tokens[0] is the correct first-name selector.
- **C2:** Test 6 was added in commit `46db80bf` as TDD-RED for a hero-section decoration. When the ambient SVG was later added at the outer-wrapper level it was never wired up to satisfy the test contract.

## Follow-up Work Surfaced

- `taskflow/src/routes/dashboard/index.tsx` has 2 pre-existing Biome formatting errors and 1 warning on `<h1>` and `<path>` JSX one-liners. These exist at HEAD before this task and are out of scope here; a dedicated lint cleanup should run `biome check --write` across the codebase (repo-level reports 40 errors + 842 warnings + 7 infos).
- Dashboard tests emit `An update to Dashboard inside a test was not wrapped in act(...)` stderr warnings because the unawaited `readSecret('jira-pat')` promise resolves after render. Tests still pass; a follow-up could wrap assertions in `waitFor(...)` to silence the noise.

## Notes

- Both commits used `--no-verify` because the pre-commit Biome hook fails on pre-existing unrelated formatting issues in the dashboard file (per project memory rule: `--no-verify` OK in this case; rationale documented in each commit message).
- Dual-file `jira.ts` gotcha did not apply (no jira logic touched).
- No `.skip`/`.only` added; no assertions weakened; no try/catch swallowing introduced.

## Self-Check: PASSED

- Files verified:
  - `taskflow/src/routes/dashboard/index.tsx` — modified (FOUND on disk)
  - `.planning/quick/260523-mqj-fix-all-failing-tests/FAILURES.md` — created (FOUND on disk)
- Commits verified:
  - `55ab38c8` — FOUND in `git log` (C1 fix)
  - `29dac3e7` — FOUND in `git log` (C2 fix)
- Final `npm test` run reproduces the green tally above.
