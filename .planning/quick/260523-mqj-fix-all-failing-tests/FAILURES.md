# 260523-mqj — FAILURES Triage

## Status: GREEN (initial: RED, final: GREEN — see Final Result section)

## Summary

- **Test Files:** 1 failed | 113 passed | 5 skipped (119)
- **Tests:** 3 failed | 1331 passed | 2 skipped | 39 todo (1375)
- **Duration:** 8.20s

## Failures

### `src/routes/dashboard/index.test.tsx` — Dashboard

1. **Test 1 (greeting renders first name only): heading contains "Alice" but not "Doe"**
   - Error: `TestingLibraryElementError: Unable to find an element with the text: /Alice/`
   - Rendered DOM shows `Good afternoon, Doe` instead of `Good afternoon, Alice`.
   - Mock sets `jiraUserDisplayName: 'Alice Doe'`.

2. **Test 2 (Milan Mozolak): heading contains "Milan" but not "Mozolak"**
   - Error: `Unable to find an element with the text: /Milan/`
   - Rendered DOM shows `Good afternoon, Mozolak` instead of `Good afternoon, Milan`.
   - Mock sets `jiraUserDisplayName: 'Milan Mozolak'`.

3. **Test 6 (decorative SVG present): hero section contains an aria-hidden SVG**
   - Error: `AssertionError: expected null not to be null` at `document.querySelector('section svg')`.
   - DOM has an `<svg aria-hidden="true">` element but it is a sibling of `<section>`, not a child.

## Clusters

### C1 — Dashboard hero name parsing inverted (Tests 1 + 2)

**Failing tests:** Test 1, Test 2 in `src/routes/dashboard/index.test.tsx`.

**Root cause:** `src/routes/dashboard/index.tsx:51–52` parses `jiraUserDisplayName` with:
```ts
const tokens = jiraUserDisplayName?.trim().split(/\s+/) ?? [];
const firstName = tokens[1] ?? tokens[0] ?? null;
```
This was changed in commit `8adc3169` ("fix first name from Surname Firstname Status format") under the assumption that Jira returns `"Surname Firstname [Status]"`. That is incorrect for this codebase: real Jira `displayName` for the live user is the 2-token form `"Milan Mozolak"` (Firstname Surname), as documented in `.planning/quick/260521-t6m-.../260521-t6m-PLAN.md` line 80. With the current logic, `'Milan Mozolak'` → `tokens[1]='Mozolak'`, which is the surname, not the first name. Both tests assert the standard convention (token[0] = first name).

**Fix strategy:** Source code. In `src/routes/dashboard/index.tsx`, change the first-name selector to use `tokens[0]` (with a defensive trailing-bracket strip in case a future `[Status]` suffix appears). Tests are correct; tests are the contract.

### C2 — Dashboard hero SVG placement (Test 6)

**Failing tests:** Test 6 in `src/routes/dashboard/index.test.tsx`.

**Root cause:** `src/routes/dashboard/index.tsx` renders the decorative `<svg aria-hidden="true">` as a sibling of `<section>` (both children of the outer wrapper `<div>`). The test asserts the SVG lives **inside** the hero `<section>` (via `document.querySelector('section svg')`). Test 6 was added in commit `46db80bf` as part of the same redesign, encoding the intended DOM structure.

**Fix strategy:** Source code. Move the decorative `<svg>` inside the `<section>` element. Keep `aria-hidden="true"` and `pointer-events-none` so it remains decorative. The visual result is unchanged (SVG was already absolutely-positioned to fill the area).

## Notes

- Stderr emits "An update to Dashboard inside a test was not wrapped in act(...)" warnings due to the async `readSecret('jira-pat')` effect resolving after render. This is a noise warning, not a failure — leaving as-is to avoid scope creep.
- No `.skip`, `.only`, or assertion weakening will be used.
- Both clusters touch the same file (`src/routes/dashboard/index.tsx`) but have distinct root causes — one commit per cluster.

## Final Result

**Status: GREEN**

- **Test Files:** 114 passed | 5 skipped (119)
- **Tests:** 1334 passed | 2 skipped | 39 todo (1375)
- **Duration:** 7.88s

Skips and todos are identical to the initial run (5 file-skips, 2 test-skips, 39 todos) — they are pre-existing and were not introduced by this task. No tests were muted, skipped, or weakened to fake a pass.

### Cluster outcomes

| Cluster | Status | Commit | Root cause |
| --- | --- | --- | --- |
| C1 — Dashboard hero name parsing inverted | FIXED | `55ab38c8` | Source used `tokens[1]` based on a wrong assumption about Jira `displayName` format; live Jira returns `"Firstname Surname"` (2 tokens), so `tokens[0]` is the correct first name. |
| C2 — Dashboard hero SVG placement | FIXED | `29dac3e7` | Decorative ambient SVG was a sibling of `<section>`; Test 6 contract requires it be a descendant. Moved SVG inside the section with `overflow-hidden` to keep it bounded and `relative` on text children to keep them above the SVG. |

### Biome (`npm run check`) status on touched files

`taskflow/src/routes/dashboard/index.tsx` reports 2 errors + 1 warning. These are **pre-existing formatting issues** (JSX one-liners on `<h1>` and `<path>`) verified to exist at HEAD before any edit. Not introduced by this task; out of scope per the project memory rule that `--no-verify` is acceptable for pre-existing unrelated lint warnings. Both commits used `--no-verify` and documented this rationale in their messages.

### Follow-up work (out of scope for this task)

- The Dashboard `index.tsx` file has pre-existing Biome formatting errors on the `<h1>` and `<path>` JSX elements. A dedicated lint-cleanup pass should run `biome check --write` across the codebase (1284 reports overall at repo level — far beyond a single-test fix).
- Stderr "act(...)" warnings emitted by `Dashboard` tests are caused by the unawaited `readSecret('jira-pat')` promise resolving after render. A follow-up could wrap the assertions in `await act(...)` or `waitFor(...)`, but tests pass and the warnings are noise.
