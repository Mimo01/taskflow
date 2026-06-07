# Quick Task 260607-ixt: v1.12 debt: reconcile VISUAL-04/05 text, remove dead stripe/rank exports - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Task Boundary

Resolve three tech-debt items surfaced by the v1.12 milestone audit (`.planning/v1.12-MILESTONE-AUDIT.md`):

1. **VISUAL-04/05 text divergence** — requirement text describes a priority-driven left-edge stripe, but the shipped UI (quick-260606-oyy, commit 780454e0) uses an issue-TYPE stripe plus a priority footer icon (`PriorityIcon`). Reconcile the requirement text with reality.
2. **Dead export `priorityStripeClass`** — `taskflow/src/lib/issueDisplayUtils.ts:131`, superseded by `issueTypeStripeClass`. 0 production callers.
3. **Dead export `rankIssue`** — `taskflow/src/services/jira/rank.ts:21`, known-broken LexoRank calc; Phase 78 used server-side neighbor-key ranking instead. 0 production callers.

</domain>

<decisions>
## Implementation Decisions

### VISUAL-04/05 reconciliation
- **Rewrite requirement text to match the shipped implementation.** Update `.planning/REQUIREMENTS.md` (lines 15-16) so VISUAL-04 describes the left-edge stripe encoding issue TYPE, and VISUAL-05 covers priority being signaled via the `PriorityIcon` footer image. Note that the original intent (at-a-glance priority visibility) is preserved via the approved UX change.
- Also align any other places where VISUAL-04/05 text is quoted as the canonical requirement (ROADMAP.md success criteria) so the milestone record is internally consistent. Verification docs (76-VERIFICATION.md) are historical override records — leave their wording but they should not contradict the reconciled requirement.

### rank.ts disposition
- **Delete `taskflow/src/services/jira/rank.ts` and `taskflow/src/services/jira/rank.test.ts` entirely** (12 tests). Known-broken client-side LexoRank calc with zero callers; recoverable from git if ever needed.
- `taskflow/src/services/jira/rank-api.ts` (`rankIssueApi`, server-side ranking used by Phase 78) is SEPARATE and MUST stay.

### priorityStripeClass disposition
- **Remove `priorityStripeClass` and its supporting constants** (`PRIORITY_STRIPE`, `ICON_SEVERITY_STRIPE`, `DEFAULT_STRIPE` — only if they are not also used by retained code) from `taskflow/src/lib/issueDisplayUtils.ts`, plus the ~25 associated tests in `issueDisplayUtils.test.ts`.
- `issueTypeStripeClass` (same file, wired into `TaskCard.tsx`) MUST stay, along with its tests.

### Claude's Discretion
- Exact wording of the reconciled VISUAL-04/05 requirement text.
- Whether any shared constant in issueDisplayUtils.ts is still referenced by `issueTypeStripeClass` or other retained code — verify before deleting each constant.

</decisions>

<specifics>
## Specific Ideas

- Live/keep references: `issueTypeStripeClass` (issueDisplayUtils.ts:158, used by TaskCard.tsx:44,351), `rankIssueApi` (rank-api.ts:25, used by BacklogPage).
- After removal, `npm run check` (biome check + tsc) must stay GREEN, and `npm test` must pass with the stranded test suites removed.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/v1.12-MILESTONE-AUDIT.md` — source of all three debt items (lines 15-33).
- `.planning/REQUIREMENTS.md` lines 15-16 — VISUAL-04/05 definitions.
- `.planning/quick/260606-oyy-on-sprint-board-i-want-to-change-how-pri/260606-oyy-SUMMARY.md` — the stripe redesign that orphaned priorityStripeClass.

</canonical_refs>
