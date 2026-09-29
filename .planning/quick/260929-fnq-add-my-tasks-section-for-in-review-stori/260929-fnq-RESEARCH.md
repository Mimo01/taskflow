# Quick 260929-fnq: "In Review — my subtasks" band - Research

**Researched:** 2026-09-29
**Domain:** Pure band classification in `taskflow/src/lib/my-tasks-sort.ts` + labels in `MyTasksPage.tsx`
**Confidence:** HIGH (all findings from direct codebase reads/grep; no external packages)

<user_constraints>
Locked (from CONTEXT.md): order flagged-blocked → overdue → in-review-my-mr → **NEW** → in-progress → to-do → done. Qualification is PARENT-level: non-subtask parent, status name contains "review" (case-insensitive), parent key NOT in `myIssueKeys`, ≥1 subtask IS in `myIssueKeys`, and parent does not itself qualify for flagged/blocked, done, overdue, or my-MR. Participates in subtree-min (wins over my subtask's in-progress/to-do/done; loses to flagged/overdue/my-MR anywhere in the subtree). Label "In Review — my subtasks" (em dash). Own stories in review without my MR: unchanged (stay In Progress). Discretion: band id, dot color, where classification lives (keep `classifyBand` pure). Update any hardcoded indices (done becomes 6).
</user_constraints>

## 1. Every hardcoded band index / id (complete grep of `taskflow/src`)

Consumers of `MY_DAY_BANDS|MyDayBand|in-review-my-mr|groupByMyDay|subtreeBand|classifyBand` are only: `my-tasks-sort.ts`, `my-tasks-sort.test.ts`, `MyTasksPage.tsx`. `MyTasksPage.test.tsx` only mentions `groupByMyDay` in comments. [VERIFIED: grep]

| File | Location | Change |
|------|----------|--------|
| `lib/my-tasks-sort.ts` | `MY_DAY_BANDS` (L19-26) + index comments | Insert `'in-review-my-subtasks'` at index 3; renumber comments: in-progress 4, to-do 5, done 6 |
| `lib/my-tasks-sort.ts` | JSDoc "D-04 band order" (L17), `classifyBand` doc "(0–5)" | Update to 7 bands / 0–6 |
| `lib/my-tasks-sort.ts` | `classifyBand` literals: `return 5` (done, L50), `return 3` (in-progress, L63), `return 4` (to-do, L66) + "Band N" comments | → 6, 4, 5. Bands 0/1/2 unchanged. Classify never returns 3 |
| `lib/my-tasks-sort.ts` | `subtreeBand` `Math.min(parentBand, ...subtaskBands, 5)` + comment "cap at 5 (done)" (L84-85) | → cap at 6. Prefer `MY_DAY_BANDS.length - 1` (or a `DONE_BAND = MY_DAY_BANDS.indexOf('done')` const) so it never drifts again |
| `routes/my-tasks/MyTasksPage.tsx` | `MY_DAY_BAND_LABELS` (L50-57) | Add `'in-review-my-subtasks': 'In Review — my subtasks'` after my-MR entry |
| `routes/my-tasks/MyTasksPage.tsx` | `MY_DAY_BAND_DOT` (L69-76) | Add `'in-review-my-subtasks': 'bg-indigo-500'` |
| `routes/my-tasks/MyTasksPage.tsx` | `groupByMyDay(...)` call (L564-569) | No change needed if new logic uses the already-passed `myIssueKeys` |

Both page maps are `Record<string, string>` (not `Record<MyDayBand,…>`), so TS will NOT flag a missing key — fallback is the raw band id and `undefined` dot. Recommend typing them `Record<MyDayBand, string>` (import the type) so the compiler enforces completeness.

## 2. Where to compute the classification

**Recommendation:** leave `classifyBand` signature untouched (pure, per-issue — it has no subtree/ownership context). Add an exported pure predicate and apply it in `groupByMyDay` Pass 3 (which already has `parent`, full `subtasks`, and `myIssueKeys`):

```ts
export const IN_REVIEW_MY_SUBTASKS_BAND = MY_DAY_BANDS.indexOf('in-review-my-subtasks'); // 3

/** Parent in review, not mine, with ≥1 of my subtasks. Ownership-only; band precedence handled by caller. */
export function isForeignReviewWithMySubtask(
  parent: JiraIssue, subtasks: JiraIssue[], myIssueKeys: Set<string>,
): boolean {
  if (parent.fields.issuetype?.subtask) return false;
  if (myIssueKeys.has(parent.key)) return false;
  if (!parent.fields.status.name.toLowerCase().includes('review')) return false;
  return subtasks.some((s) => myIssueKeys.has(s.key));
}

// groupByMyDay Pass 3
let bandIndex = subtreeBand(parent, subtasks, flaggedFieldKey, myOpenMRIssueKeys, today);
if (isForeignReviewWithMySubtask(parent, subtasks, myIssueKeys)) {
  const parentBand = classifyBand(parent, flaggedFieldKey, myOpenMRIssueKeys, today);
  if (parentBand > IN_REVIEW_MY_SUBTASKS_BAND && parentBand !== DONE_BAND) {
    bandIndex = Math.min(bandIndex, IN_REVIEW_MY_SUBTASKS_BAND);
  }
}
```

Alternative (equally valid): pass `myIssueKeys` as an optional 6th param to `subtreeBand` (after `today`, so existing positional test calls stay valid) and fold the same logic in there — this lets `subtreeBand` tests cover it directly. Pick one; don't do both.

**Interaction with subtree-min (why this is correct):**
- `Math.min(subtree, 3)`: any subtask/parent at 0/1/2 (flagged, overdue, my-MR) keeps winning; subtask at 4/5/6 (my in-progress/to-do/done) is lifted to 3. Matches locked decision.
- Parent flagged or "block" status → `classifyBand` = 0 → guard `parentBand > 3` excludes it (subtree is 0 anyway).
- Parent overdue → 1; parent in `myOpenMRIssueKeys` (possible: an MR of mine can link to the foreign story key, since the page passes `new Set(mrHealthByKey.keys())`) → 2. Both excluded by guard and win via min anyway.
- Parent done (e.g. a "Reviewed" status in done category — "review" substring match) → 6 → explicit `!== DONE_BAND` guard required; otherwise a done "Reviewed" story would be pulled up to band 3. This is the one non-obvious case.
- Parent status "In Review" but category `new` → band 5 → qualifies (lifted to 3). Acceptable per spec (spec only tests status name).
- Ownership check must use the UNFILTERED `subtasks` list (all subtasks of the parent), mirroring Pass 2's `mySubtasks`; don't use the post-filter list since Pass 2 already guarantees eligibility.
- Bucket filter (`applyBucketFilter`) runs before `groupByMyDay` and keeps subtasks of matching parents, so no interaction issue.

## 3. Tests

**Will break from the index shift** (`my-tasks-sort.test.ts`) [VERIFIED: file read]:
- L45-56 `MY_DAY_BANDS` toEqual — add new id, rename test "6 band labels" → 7.
- classifyBand: L63 `toBe(5)` → 6; L89 `toBe(4)` → 5; L108, L113 `toBe(3)` → 4; L118 `toBe(4)` → 5; test titles mentioning "5 (done)", "4 (to-do)", "3 (in-progress)" need renaming.
- subtreeBand: L159 `toBe(3)` → 4; L184 `toBe(4)` → 5; L199 `toBe(3)` → 4 (+ titles "band 5"/"band 3").
- groupByMyDay tests assert band **ids**, not indices → unaffected.
- `MyTasksPage.test.tsx`: no band index/label assertions ("In Progress" at L131 is the stat tile) → unaffected. [VERIFIED: grep]

**New cases** (groupByMyDay, since that's where the logic lives; add predicate unit tests too):
1. Foreign parent "In Review" (indeterminate) + my subtask In Progress → band `'in-review-my-subtasks'`.
2. Same with my subtask To Do and with my subtask Done → still new band.
3. Parent key IN `myIssueKeys` + "In Review", no MR → `'in-progress'` (own-story regression guard, out of scope unchanged).
4. Foreign "In Review" parent whose subtasks are all someone else's → parent excluded entirely (Pass 2). Also: foreign "In Progress" (no "review") parent + my subtask → `'in-progress'`.
5. Precedence: my subtask overdue → `'overdue'`; my subtask flagged → `'flagged-blocked'`; parent key in `myOpenMRIssueKeys` → `'in-review-my-mr'`; parent flagged → `'flagged-blocked'`.
6. Parent status "Reviewed" with category `done` + my subtask done → `'done'` (guard).
7. Ordering: groups emitted in order in-review-my-mr → in-review-my-subtasks → in-progress when all three present.
8. Case-insensitivity: "CODE REVIEW" qualifies.

Pre-commit runs full vitest: renumbering + new tests + impl must land in ONE commit.

## 4. Dot color palette

Existing `MY_DAY_BAND_DOT`: red-500, destructive (red), purple-500 (my-MR), blue-500 (in-progress), muted-foreground/60, green-500. `SPRINT_STATE_DOT` reuses blue/muted/green. `MyTaskRow.tsx` uses **amber-500** (L71 dot, L385 badge) — avoid amber to prevent semantic collision. `violet` is visually too close to purple-500.

**Use `bg-indigo-500`** — distinct from purple and blue, reads as "review family" next to purple. (Alternative: `bg-teal-500`, unused anywhere in my-tasks.)

## Package Legitimacy Audit
No external packages installed — not applicable.

## Assumptions Log
| # | Claim | Risk |
|---|-------|------|
| A1 | Excluding done-category "review" parents (e.g. "Reviewed") is desired — CONTEXT says parent must not qualify for done | Low; matches locked text |
| A2 | indigo-500 is visually distinct enough in both themes | Low; cosmetic, verify at UAT |
