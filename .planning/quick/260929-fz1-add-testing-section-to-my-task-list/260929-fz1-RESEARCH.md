# Quick Task 260929-fz1: Testing band + decoupled display order - Research

**Researched:** 2026-09-29
**Domain:** Pure TS sort/classify (`src/lib/my-tasks-sort.ts`) + one React consumer
**Confidence:** HIGH (all findings are from a codebase grep; no external libraries involved)

<user_constraints>
## User Constraints (from CONTEXT.md, summarized. The planner should read 260929-fz1-CONTEXT.md for the verbatim text)

- **Statuses:** name contains "test" (case-insensitive substring). Flagged/blocked, done, overdue and in-review-my-MR still win.
- **Ownership:** status only, through the existing subtree-min rule. No foreign-parent special case.
- **Precedence (locked):** flagged-blocked → overdue → in-review-my-mr → in-review-my-subtasks → **testing** → in-progress → to-do → done. The 260929-fnq behavior must be preserved.
- **Display order (locked):** Flagged / Blocked → Overdue → In Progress → In Review with my MR → In Review — my subtasks → Testing → To Do → Done. This is a separate display-order list that re-sorts `groupByMyDay`'s output. Server rank order is kept within a band, and there is exactly one group per band.
- **Label** "Testing". **Dot:** a distinct color (Claude's discretion). **Band id:** `testing`.
- Pre-commit hook runs the full vitest suite, so RED and GREEN go in one commit per task. Don't add new Biome diagnostics.
- No deferred ideas.
</user_constraints>

## Project Constraints
There is no CLAUDE.md in the repo root or in `taskflow/`. Constraints come from CONTEXT.md and memory: one commit per TDD task because of the pre-commit vitest hook, and "no NEW biome diagnostics" as the gate, not an absolute count.

## 1. Consumer inventory (complete; grep of `src/` for MY_DAY_BAND*, DONE_BAND, IN_REVIEW_MY_SUBTASKS_BAND, groupByMyDay, classifyBand, subtreeBand, MyDayBand, my-tasks-sort) [VERIFIED: codebase grep]

| File:line | What | Effect of the +1 shift at index 4 | Effect of display ≠ precedence |
|---|---|---|---|
| `src/lib/my-tasks-sort.ts:21-29` `MY_DAY_BANDS` + comments "0..6" | Precedence array | Insert `'testing'` at index 4. Update the index comments. | none |
| `my-tasks-sort.ts:33-34` `IN_REVIEW_MY_SUBTASKS_BAND`, `DONE_BAND` | Derived via `indexOf`, so they auto-correct | Safe. DONE becomes 7. | none |
| `my-tasks-sort.ts:37-75` `classifyBand` | **Hardcoded literals** `return 0/1/2/4/5`, docblock "(0–6)" and "Band 4/5/6" comments | **BREAKS.** `return 4` would now mean *testing* and `return 5` would mean *in-progress*. Replace every literal with named `indexOf` constants (`FLAGGED_BAND`, `OVERDUE_BAND`, `IN_REVIEW_MY_MR_BAND`, `TESTING_BAND`, `IN_PROGRESS_BAND`, `TO_DO_BAND`). | none |
| `my-tasks-sort.ts:83-97` `subtreeBand` | `Math.min(..., DONE_BAND)` | Safe, because it uses the constant | none |
| `my-tasks-sort.ts:150-160` fnq lift in `groupByMyDay` | `parentBand > IN_REVIEW_MY_SUBTASKS_BAND && parentBand !== DONE_BAND` | Still correct: testing (4), in-progress (5) and to-do (6) all get lifted to 3. The comment "bands 0-2 win via min" is still accurate. | none |
| `my-tasks-sort.ts:170-171` `bandedParents.sort((a,b)=>a.bandIndex-b.bandIndex)` | Output ordering | — | **This is the sort to change** (see §3) |
| `my-tasks-sort.ts:173-187` Pass 4 "consecutive" merge | Groups adjacent same-band entries | — | Still correct once the sort key is a 1:1 function of the band. Update the docblock at L100-106 ("sorted by urgency" becomes "sorted by display order"). |
| `src/routes/my-tasks/MyTasksPage.tsx:50-58` `MY_DAY_BAND_LABELS: Record<MyDayBand,string>` | Label map | tsc fails until a `testing` key is added (useful as a completeness guard) | none |
| `MyTasksPage.tsx:70-78` `MY_DAY_BAND_DOT` | Dot map | Same: tsc forces the new key. Colors in use: red-500, destructive, purple-500, indigo-500, blue-500, muted-foreground/60, green-500. **Use `bg-amber-500`** (warm, "awaiting verification"; teal is too close to blue-500 at dot size). | none |
| `MyTasksPage.tsx:566-613` `renderMyDayList` | Iterates `groupByMyDay` output in array order, `key={band}` | Uses string ids only, so it is safe | Renders whatever order groupByMyDay returns. No change needed. |

**Not affected (verified):**
- The stat tiles, summary counts and bucket filter (`MyTasksPage.tsx:194 matchesBucket`, `:414-455`, `:478 applyBucketFilter`) are keyed on `statusCategory`, not on bands.
- There is no persisted state (settings store, localStorage, collapse keys) keyed by band id or index. Scope and filter are transient.
- There are no other importers of `my-tasks-sort` anywhere in `src/`.
- `MyTasksPage.test.tsx` mentions `groupByMyDay` only in comments (L162, L224) and asserts no band order.

UX side effect to mention in the summary: "Ready to test" is `indeterminate`, so testing issues still count toward the **In Progress** stat tile. Clicking that tile shows both the In Progress and Testing bands. That is acceptable and needs no change.

## 2. Tests that must change (`src/lib/my-tasks-sort.test.ts`) [VERIFIED: file read]

| Line | Current | Update |
|---|---|---|
| 52-61 | "7 band labels", toEqual list | "8 band labels". Insert `'testing'` after `'in-review-my-subtasks'`. |
| 68-70 | done `toBe(6)` | `7` (better: `toBe(MY_DAY_BANDS.indexOf('done'))`) |
| 93-96 | to-do future due `toBe(5)` | `6` |
| 109-115 | review without MR `toBe(4)` | `5` |
| 118-120 | indeterminate `toBe(4)` | `5` |
| 123-125 | new `toBe(5)` | `6` |
| 155-166 | subtree done parent + in-progress subtask `toBe(4)` | `5` |
| 189-191 | no subtasks `toBe(5)` | `6` |
| 193-208 | all subtasks done `toBe(4)` | `5` |
| 437-459 | `'emits my-mr, my-subtasks, in-progress in order'` expects `[in-review-my-mr, in-review-my-subtasks, in-progress]` | **Display order changes.** Expected becomes `['in-progress','in-review-my-mr','in-review-my-subtasks']`. Rename the test. |

Recommendation: switch the literal-index assertions to `MY_DAY_BANDS.indexOf('<id>')`, so the next insertion won't break a dozen assertions again. Keep the assertions semantic.

**New tests to add:**
- classifyBand: "Ready to test" (indeterminate) and "Testing" return testing. "TESTING" (uppercase) returns testing. A flagged testing issue returns 0. A "Blocked in test" status returns 0. An overdue testing issue returns overdue. A done-category status containing "test" (e.g. "Tested", done) returns done. A testing status with `statusCategory:'new'` still returns testing.
- subtreeBand: an in-progress parent with a testing subtask returns testing (the subtree min).
- groupByMyDay fnq regression: a foreign review parent plus my subtask in "Testing" gives `in-review-my-subtasks` (3 < 4 wins).
- Display order: one parent per band (all 8) fed in scrambled order returns bands exactly in `MY_DAY_BAND_DISPLAY_ORDER`. Also check that two same-band parents keep their input order and produce one group.
- Guard: `[...MY_DAY_BAND_DISPLAY_ORDER].sort()` equals `[...MY_DAY_BANDS].sort()` (a permutation, with no band missing).
- Existing tests "sorts overdue parent before to-do" and "merges consecutive same-band" stay valid.

`MyTasksPage.test.tsx`: no changes needed. Optionally add a render assertion that a "Ready to test" issue shows a "Testing" header, but the unit tests cover the logic.

## 3. Recommended mechanism [VERIFIED: code read; stable sort is ES2019 spec]

```ts
// my-tasks-sort.ts
export const MY_DAY_BANDS = [
  'flagged-blocked', 'overdue', 'in-review-my-mr', 'in-review-my-subtasks',
  'testing', 'in-progress', 'to-do', 'done',
] as const; // PRECEDENCE — lowest index wins in subtree-min

const band = (b: MyDayBand) => MY_DAY_BANDS.indexOf(b);
const FLAGGED_BAND = band('flagged-blocked'); /* ...OVERDUE, IN_REVIEW_MY_MR, TESTING, IN_PROGRESS, TO_DO */

/** Render order (real workflow) — decoupled from precedence. Must be a permutation of MY_DAY_BANDS. */
export const MY_DAY_BAND_DISPLAY_ORDER: readonly MyDayBand[] = [
  'flagged-blocked', 'overdue', 'in-progress', 'in-review-my-mr',
  'in-review-my-subtasks', 'testing', 'to-do', 'done',
];
const DISPLAY_RANK = new Map(MY_DAY_BAND_DISPLAY_ORDER.map((b, i) => [b, i]));

// classifyBand — insert AFTER the review+MR check, BEFORE the indeterminate check:
if (statusName.includes('review') && myOpenMRIssueKeys.has(issue.key)) return IN_REVIEW_MY_MR_BAND;
if (statusName.includes('test')) return TESTING_BAND;
if (category === 'indeterminate') return IN_PROGRESS_BAND;
return TO_DO_BAND;

// groupByMyDay Pass 3 sort — replace the bandIndex comparator:
const rank = (i: number) => DISPLAY_RANK.get(MY_DAY_BANDS[i]) ?? i;
bandedParents.sort((a, b) => rank(a.bandIndex) - rank(b.bandIndex));
```

**Why groups stay one per band:** the display rank is a bijection over bands, so sorting by rank puts every entry of a band next to the others. The existing consecutive-merge in Pass 4 therefore yields exactly one group per band. `Array.prototype.sort` is stable (ES2019+, which WebKit/Tauri and Node/vitest guarantee), so server rank order within a band is kept. bandIndex, and with it the precedence and fnq lift, is computed before the sort and is unchanged.

Keep the display order in the lib, not the page. That keeps the logic unit-testable and matches CONTEXT ("used to sort the grouped output of groupByMyDay").

## 4. Pitfalls

1. **Hardcoded literals in classifyBand.** This is the main breakage risk. A missed `return 4` would silently file every in-progress issue under Testing. Replace all literals with named constants. Verify with `grep -nE "return [0-9]" src/lib/my-tasks-sort.ts`, which should return 0 hits.
2. **Where the testing check goes in classifyBand.** It must come **after** flagged/blocked (so "Blocked in test" is blocked), done (so a done "Tested" status is done), overdue, and review+MR. It must come **before** `category === 'indeterminate'` and the to-do fallback. Otherwise "Ready to test" (indeterminate) lands in In Progress, and a new-category test status lands in To Do.
3. **statusCategory of "Ready to test".** It is `indeterminate`: `allData.real.json`/`data.real.json` have status 11503 `{key:'indeterminate', colorName:'inprogress'}` [VERIFIED: fixture]. The category of "Testing" (id 10704) is **not present in any fixture** [VERIFIED: grep]. It could be `indeterminate` or `new`. The name-based check handles both, so don't gate on category.
4. **"test" substring false positives.** Fixture status names in the repo are Backlog, To Do, In Progress, Code Review, Ready to test, Testing, Fixed, Reopened, Done, Blocked, Rejected, plus test stubs (Verified, Reviewed) [VERIFIED: fixture scan]. None of them hit "test" falsely. Hypothetical hits like "Latest", "Contest" or "Attestation" aren't statuses in this workflow. Done-category hits ("Tested", "Test passed") are caught earlier by the done check. The residual risk is low and was accepted by the locked decision.
5. **Review/test overlap.** A status containing both "review" and "test" with no MR would become testing, not in-progress. With a foreign parent, the fnq lift still applies because testing (4) > 3 and is not done. This is consistent with precedence, and no such status exists in the workflow.
6. **fnq preservation.** A foreign review parent (classifies as in-progress, 5) plus my subtask in Testing (4) gives min=4, and the lift takes it to 3 = in-review-my-subtasks. This is correct, and the planner should add it as a regression test.
7. **Docblocks going stale.** Update the header comment (L15-19, "D-04 band order"), the classifyBand docblock ("0–6", "band 3 ... never returned"), and the groupByMyDay docblock ("sorted by urgency"). Say explicitly that MY_DAY_BANDS = precedence and MY_DAY_BAND_DISPLAY_ORDER = render order.

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest (existing) |
| Quick run | `cd taskflow && npx vitest run src/lib/my-tasks-sort.test.ts src/routes/my-tasks` |
| Full suite | runs automatically in the pre-commit hook |
| Type check | `cd taskflow && npx tsc --noEmit` (catches missing `testing` keys in the `Record<MyDayBand,…>` maps) |
| Lint | `npx biome check src/lib/my-tasks-sort.ts src/lib/my-tasks-sort.test.ts src/routes/my-tasks/MyTasksPage.tsx`, with no new diagnostics |

Wave 0 gaps: none. The existing test file and helpers (`makeIssue`, `foreignReview`, `mySub`, `run`) cover everything needed.

## Security Domain
Not applicable. This is a pure client-side presentation sort with no input, auth or network changes.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The "Testing" status (10704) category is unknown (possibly `new`). The name check handles it either way. | None for classification. The stat-tile bucket for Testing issues may differ from Ready to test. |
| A2 | `bg-amber-500` is visually distinct in both themes. | Cosmetic only. Swap the color at UAT if needed. |

## Sources
- `taskflow/src/lib/my-tasks-sort.ts`, `my-tasks-sort.test.ts`, `src/routes/my-tasks/MyTasksPage.tsx`, `MyTasksPage.test.tsx` (read in full or in the relevant ranges)
- `src/services/jira/greenhopper/__fixtures__/{transitions,allData,data}.real.json` (status names and categories)
