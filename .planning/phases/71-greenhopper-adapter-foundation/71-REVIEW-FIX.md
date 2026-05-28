---
phase: 71-greenhopper-adapter-foundation
fixed_at: 2026-05-28T22:32:00Z
review_path: .planning/phases/71-greenhopper-adapter-foundation/71-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 71: Code Review Fix Report

**Fixed at:** 2026-05-28
**Source review:** `.planning/phases/71-greenhopper-adapter-foundation/71-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (BLOCKER + WARNING): 7
- Fixed: 7
- Skipped: 0
- Info findings (IN-01 through IN-04): out of scope for this fix run

**Verification matrix (run inside isolated worktree with node_modules symlinked
from main repo):**
- `npx tsc --noEmit` clean on all touched files.
- `npx vitest run src/services/jira/greenhopper/` — 7 test files, 65 tests pass
  (was 64 before, +1 new WR-06 assertion).
- `npx biome check` clean on all touched source and the capture script.

## Fixed Issues

### CR-01 (BLOCKER): Adapter synthesised `parent.key = ''` when `gh.parentKey` was undefined

**Files modified:** `taskflow/src/services/jira/greenhopper/adapter.ts`
**Commit:** `bbada26b` (combined with WR-01 — both touch contiguous lines)
**Applied fix:** Synthesize `fields.parent` only when BOTH `parentId` AND
`parentKey` are present (matching the contract enforced by `resolveParent()`
in `entityMaps.ts`). Also derive `issuetype.subtask` from `parent !==
undefined` rather than `gh.parentId !== undefined`, so an issue with
`parentId` but no `parentKey` is no longer marked subtask with an
unsynthesisable parent. Note: requires human verification — the
test at adapter.test.ts:162-171 still asserts the previous semantic for the
happy path (parentId + parentKey both present); the divergent case
(parentId present, parentKey absent) is not yet covered by a test. Logic
change is straightforward but a behavioural test would lock the invariant.

### WR-01: Dead `void resolveEpic / resolvePriority / resolveParent` calls

**Files modified:** `taskflow/src/services/jira/greenhopper/adapter.ts`
**Commit:** `bbada26b` (combined with CR-01)
**Applied fix:** Removed the three `void` calls and dropped the now-unused
imports. The resolvers are still surface-exercised by entityMaps tests and
remain reachable from the package barrel via `export * from './entityMaps'`
in `index.ts`, so Phase 73 wiring can import them directly. This also
eliminates the spurious per-issue `warnOnce('priority','unknown')` that
contradicted D-08 by proxy.

### WR-02: GH fetchers swallowed `ApiError` in bare catch blocks

**Files modified:** `taskflow/src/services/jira/greenhopper/allData.ts`,
`taskflow/src/services/jira/greenhopper/data.ts`,
`taskflow/src/services/jira/greenhopper/details.ts`,
`taskflow/src/services/jira/greenhopper/transitions.ts`
**Commits:** `4cb6e49f` (initial fix) + `ac203073` (ES2020-compat follow-up)
**Applied fix:** Changed `catch {}` to `catch (err)`; re-throw `ApiError`
unchanged so auth-failure semantics (`setJiraConnected(false)` per D-04) are
preserved; only collapse the remaining (network-class) errors to the "Cannot
reach" envelope. Attach the original error as `cause` for devtools. The
ES2022 `new Error(msg, { cause })` constructor was not available under the
project's `target: ES2020`, so the cause is assigned post-construction via
a typed cast — the follow-up commit handles that without behavioural change.

### WR-03: `adapter.test.ts` Group G hand-rolled enumeration of `GhIssue` fields

**Files modified:** `taskflow/src/services/jira/greenhopper/adapter.test.ts`
**Commit:** `ce64e883`
**Applied fix:** Replaced the 14-field manual enumeration with an
object-rest destructure: `const { timeInColumn: _drop, ...ghIssue } = edge({});`.
The test now stays exhaustive when `GhIssue` evolves in `types.ts` instead
of silently dropping any newly-added field.

### WR-04: `redactTransitions` rewrote any `key` field matching `<ALLCAPS>-<digits>`

**Files modified:** `taskflow/scripts/capture-greenhopper.mjs`
**Commit:** `668c26e6`
**Applied fix:** Removed the catch-all `key` matcher; kept only the explicit
`issueKey` carrier. Future GH builds adding `STEP-1`/`REL-12`-style values
will no longer be silently rewritten to `PROJ-{n}` in the committed
fixture. Trust-boundary rationale for keeping workflow/transition names
un-redacted left in-code as a comment.

### WR-05: Details capture script does not redact plain-text PII surfaces

**Files modified:** `taskflow/scripts/capture-greenhopper.mjs`
**Commit:** `a3fc69db`
**Applied fix:** Added three defence-in-depth layers to `redactDetails`:
1. Explicit redaction of `description`, `comments[].body`, `comments[].author`,
   `comments[].authorFullName`.
2. A `redactStringLeavesDenyByDefault` walker with a small structural-key
   allowlist (`tabId`, `id`, `type`, `iconUrl`, `iconClass`, `href`, `url`,
   `key`, `projectKey`, `styleClass`, `cssClass`, `fieldType`, `fieldName`,
   `name`, `label`, `mimeType`) — anything else gets replaced with
   `'<<redacted by capture script>>'`.
3. Applied the walker to `obj.defaultTabs` (the `[key: string]: unknown`
   surface called out in the review). Human review of the committed
   `details.real.json` is still required — this is defence-in-depth, not a
   substitute.

### WR-06: Document `flagged: undefined → false` collapse and add explicit test

**Files modified:** `taskflow/src/services/jira/greenhopper/adapter.ts`,
`taskflow/src/services/jira/greenhopper/adapter.test.ts`
**Commit:** `9d99d7f0`
**Applied fix:** Extended the adapter header (D-01 block) to spell out the
`flagged: undefined → false` collapse and its implication ("show flagged
badge if flagged" UI is fine; ever-been-flagged telemetry must read raw
GhIssue). Added a Group F test that asserts `gh.flagged === false` and
`gh.flagged === undefined` produce observationally-identical
`AdaptedIssue.flagged` values, locking the invariant.

## Skipped Issues

None — all 7 in-scope findings were applied.

## Out-of-scope (Info — not part of this fix run)

The four Info-tier findings were not in scope per the `fix_scope:
critical_warning` setting:

- **IN-01:** `entityMaps.seenMissing` is a module-level Set — recommend
  hoisting `__resetWarnOnce` into a vitest `setupFiles` entry.
- **IN-02:** Five identical fetcher error-envelope blocks could be lifted
  into a single helper. Note: now that WR-02 has hardened the envelope, this
  DRY refactor becomes a single-point-of-evolution win.
- **IN-03:** `gh.estimateStatistic` is typed required but the real-capture
  fixture shows 103/156 issues with it absent. Recommend making the field
  optional in `types.ts` and dropping the cast in `adapter.ts:83`.
- **IN-04:** `index.ts` `export *` leaks `__resetWarnOnce` through the
  barrel. Recommend switching to explicit named re-exports.

These should be addressed in a follow-up phase or rolled into the Phase 73
wiring work.

---

_Fixed: 2026-05-28_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
