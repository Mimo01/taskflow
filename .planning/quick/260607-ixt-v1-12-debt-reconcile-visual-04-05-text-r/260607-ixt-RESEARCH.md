# Research — 260607-ixt: reconcile VISUAL-04/05, remove dead stripe/rank exports

**Mode:** quick-task
**Date:** 2026-06-07
**Scope:** Tech-debt cleanup. No new libraries — deletion + doc reconciliation. Findings below are verified against the live tree.

## 1. Dead-code map (verified by grep, src/ excluding def + test files)

| Symbol | Location | Production callers | Disposition |
|--------|----------|--------------------|-------------|
| `priorityStripeClass` | `src/lib/issueDisplayUtils.ts:131` | **0** | Remove |
| `prioritySeverityFromIcon` | `src/lib/issueDisplayUtils.ts:110` | **0** (only consumed by `priorityStripeClass` + its own tests) | Remove (dead once `priorityStripeClass` goes) |
| `PRIORITY_STRIPE` const | `src/lib/issueDisplayUtils.ts` (~before :131) | **0** outside the two dead fns | Remove |
| `ICON_SEVERITY_STRIPE` const | `src/lib/issueDisplayUtils.ts` | **0** outside the two dead fns | Remove |
| `DEFAULT_STRIPE` const (`:101`) | `src/lib/issueDisplayUtils.ts:101` | **0** outside the two dead fns | Remove |
| `rankIssue` | `src/services/jira/rank.ts:21` | **0** | Delete whole file |
| `issueTypeStripeClass` | `src/lib/issueDisplayUtils.ts:158` | **1** (`TaskCard.tsx:44,351`) | **KEEP** |
| `rankIssueApi` | `src/services/jira/rank-api.ts:25` | used by BacklogPage | **KEEP** |

`issueTypeStripeClass` does NOT reference any of the `*_STRIPE` constants (it inlines its own Tailwind strings), so removing the constants cannot break it.

## 2. Files to touch

**Source:**
- `src/lib/issueDisplayUtils.ts` — remove `priorityStripeClass`, `prioritySeverityFromIcon`, `PRIORITY_STRIPE`, `ICON_SEVERITY_STRIPE`, `DEFAULT_STRIPE`, and their JSDoc. Keep `issueTypeStripeClass` + everything else.
- `src/lib/issueDisplayUtils.test.ts` — remove `describe('priorityStripeClass', …)`, `describe('priorityStripeClass — icon-severity ramp …')`, and `describe('prioritySeverityFromIcon', …)`. Drop the now-unused imports (`priorityStripeClass`, `prioritySeverityFromIcon`). Keep `issueTypeStripeClass` tests.
- `src/services/jira/rank.ts` — **delete file.**
- `src/services/jira/rank.test.ts` — **delete file** (12 tests, E1–E12).

**Docs (requirement reconciliation):**
- `.planning/REQUIREMENTS.md` lines 15-16 — rewrite VISUAL-04/05 to describe the shipped design (issue-TYPE stripe + priority footer icon).
- `.planning/ROADMAP.md` — Phase 76 success criteria currently quotes the priority-stripe wording; align it so the milestone record is internally consistent.
- Leave `76-VERIFICATION.md` override wording as a historical record (do not rewrite history), but ensure it does not contradict the reconciled requirement.

## 3. Pitfalls

1. **Don't touch `rank-api.ts`.** `rankIssue` (dead, client-side LexoRank calc) is a different file from `rankIssueApi` (live, server-side rank PUT). Phase 78 ships on `rankIssueApi`. Deleting `rank.ts` must not touch `rank-api.ts`.
2. **Barrel/index re-exports.** Before deleting `rank.ts`, grep for any `export … from './rank'` (e.g. a `services/jira/index.ts`) that would break. (Investigation found imports go directly to `rank-api`, but the planner/executor must re-confirm there is no barrel re-export of `rank.ts`.)
3. **Test imports.** Removing functions strands their imports at the top of `issueDisplayUtils.test.ts` — biome will flag unused imports. Drop the import names in the same edit.
4. **Tailwind JIT safety.** Not applicable to removal — we are only deleting full-literal class strings, not adding interpolated ones.
5. **Green gates.** `npm run check` (biome check + tsc) and `npm test` must both pass after the change. Per project memory, `biome check` (not bare `biome lint`) is the canonical gate.

## 4. VISUAL-04/05 reconciliation (decision: rewrite to match ship)

Current text:
- VISUAL-04: "Sprint board cards show a left-edge color stripe driven by issue priority"
- VISUAL-05: "The card color stripe is legible in both light and dark themes (WCAG ≥ 3:1 against the card surface)"

Shipped reality (quick-260606-oyy, commit 780454e0): stripe encodes issue **type** (Bug/Story/Subtask/Epic); **priority** is shown via the `PriorityIcon` footer image. Rewrite should: (a) make VISUAL-04 describe the type-stripe, (b) make VISUAL-05 cover priority-via-icon, (c) note the original intent (at-a-glance priority visibility) is preserved by the approved UX change. Exact wording is Claude's discretion.

## RESEARCH COMPLETE
File: `.planning/quick/260607-ixt-v1-12-debt-reconcile-visual-04-05-text-r/260607-ixt-RESEARCH.md`
