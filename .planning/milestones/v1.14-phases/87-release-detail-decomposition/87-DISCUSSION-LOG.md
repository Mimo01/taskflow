# Phase 87: Release Detail Decomposition - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 87-Release Detail Decomposition
**Areas discussed:** Split granularity, Data & derived logic, Local helpers & dupes, Refactor safety net, Forward fit

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Split granularity | How fine to cut the 1518-LOC file | ✓ |
| Data & derived logic | Where 6 useQuery calls + 7 derived computations land | ✓ |
| Local helpers & dupes | Inline Jira REST fetchers, duplicated MetaRow | ✓ |
| Refactor safety net | No test covers ReleaseDetailPage today | ✓ |

**User's choice:** all four areas.

---

## Forward Fit

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror today only (Recommended) | Split exactly what exists, zero speculative files; 88-91 add their own | ✓ |
| Pre-shape known seams | Carve MR-list and release-status areas now, sized for 88-90 additions | |
| Discuss it | Add as a fifth discussion area | |

**User's choice:** Mirror today only.
**Notes:** Chosen with full awareness that Phases 88–91 will grow these files — reviewability of this diff was prioritized over convenience for later ones. Recorded as D-16 (hard constraint).

---

## Split Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per-section (~8 files) (Recommended) | ReleaseHeader, Descriptions, LabelSummary, Issues, UnmatchedMRs, Sidebar, EditModal, Skeleton; matches issue-detail/ | ✓ |
| Coarse (~3 files) | LeftColumn / Sidebar / EditModal; smaller diff but Issues+UnmatchedMRs stay ~400 LOC together | |
| Per-section + split IssuesSection | ~11 files; most reviewable for 89/90, largest mechanical diff now | |

**User's choice:** Per-section (~8 files).

### Follow-ups (all delegated)

| Question | Options | Outcome |
|----------|---------|---------|
| Where does the page shell live? | Stays at `dashboard/ReleaseDetailPage.tsx` (rec.) / Moves into `release-detail/` | "you decide" → stays at `dashboard/` (D-04) |
| Barrel or direct imports? | Direct + thin barrel (rec.) / Full barrel index.ts | "you decide" → direct imports (D-05) |
| Local MetaRow + Skeleton? | Own files in `release-detail/` (rec.) / MetaRow inlined in sidebar | "you decide" → own files (D-01) |

---

## Data & Derived Logic

| Question | Options | Outcome |
|----------|---------|---------|
| Where do the 6 useQuery calls go? | One `useReleaseDetail()` hook (rec.) / Per-concern hooks / Stay in the page | "you decide" → single hook (D-07) |
| Where do the 7 derived computations land? | Pure fns module (rec.) / Inside the data hook / Inside consuming sections | "you decide" → pure `releaseSummaries.ts` (D-09) |
| Hook file placement? | Co-locate in `release-detail/` (rec.) / `src/hooks/` | "you decide" → co-located (D-10) |

**Notes:** The per-concern-hooks alternative was weakened by real coupling — the milestone query window derives from the version release date, so splitting would push coordination back into the page. Query-key preservation was flagged during discussion and recorded as D-11.

---

## Local Helpers & Duplicates

| Question | Options | Outcome |
|----------|---------|---------|
| `fetchVersionIssueCounts` / `fetchFixVersionIssues` (raw Jira REST inline in a route file) | Move to `services/jira.ts` (rec.) / Keep local to `release-detail/` / Leave in the page | "you decide" → move to `services/jira.ts`, legacy file not `services/jira/` (D-12) |
| Local `MetaRow` duplicates `issue-detail/MetaRow.tsx` | Keep private copy (rec.) / Share one component / Share only if byte-identical | "you decide" → keep private copy, dedupe deferred (D-13) |

**Notes:** Sharing MetaRow was declined because any implementation delta between the two copies would change rendered output in one of the two pages, breaking the zero-user-visible-change constraint.

---

## Refactor Safety Net

| Option | Description | Selected |
|--------|-------------|----------|
| Unit-test extracted pure fns + manual UAT (Recommended) | Real tests on `releaseSummaries.ts`; page verified by `npm run check` + click-through | ✓ (delegated) |
| Characterization test first | Full-page test against mocked queries before splitting; strongest guarantee, 6 queries to mock | |
| Typecheck + manual UAT only | No new tests; leaves derived-logic edge cases uncovered going into 89/90 | |

**User's choice:** "you decide" → recommended option (D-14).
**Notes:** Chosen because the derived logic is precisely what Phases 89/90 build on, so test value concentrates there rather than in page rendering.

---

## Claude's Discretion

The user delegated 9 of 10 implementation questions with "you decide". Only the Forward Fit question was answered directly. All delegated calls are recorded as locked decisions D-01 through D-15 in CONTEXT.md — downstream agents should not re-ask them.

## Deferred Ideas

- Dedupe `MetaRow` across `issue-detail/` and `release-detail/` — standalone cleanup once both call sites are stable
- Full characterization test for `ReleaseDetailPage` — revisit if Phase 89/90 make the page significantly more stateful
- Further splitting `IssuesSection` into IssuesTable / IssueRow / ReleaseProgressBar / MilestoneWarning — deferred to whichever of 89/90 needs the seam
- `priority-stripe-rest-rank.md` todo — reviewed via todo cross-reference (score 0.4, keyword-only match), not folded; unrelated to this phase
