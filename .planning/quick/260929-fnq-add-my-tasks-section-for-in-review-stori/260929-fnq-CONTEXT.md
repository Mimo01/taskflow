# Quick Task 260929-fnq: Add My Tasks section for in-review stories I don't own but have a subtask in - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Task Boundary

On the My Tasks page (My Day banded view, `taskflow/src/routes/my-tasks/MyTasksPage.tsx` + `taskflow/src/lib/my-tasks-sort.ts`), there is already an "In Review with my MR" band. Add a new band for stories that are in review, are NOT assigned to me, but where I have a subtask.

Today such a parent falls into "In Progress" (or wherever its subtree-min band lands) because `classifyBand` band 2 requires `myOpenMRIssueKeys.has(issue.key)`, which never matches a story I don't own.

</domain>

<decisions>
## Implementation Decisions

### Band position & precedence
- New band sits immediately AFTER `in-review-my-mr` and BEFORE `in-progress`:
  flagged-blocked → overdue → in-review-my-mr → **NEW** → in-progress → to-do → done
- It participates in the existing subtree-min logic: a qualifying parent is classified into the new band even if my subtask on it is still In Progress / To Do / Done (new band index is lower, so it wins). Flagged/overdue/my-MR on parent or subtasks still win over it (lower index).
- Qualification is PARENT-level: parent (non-subtask) status name contains "review" (case-insensitive, same test as band 2), parent key NOT in `myIssueKeys`, and at least one of its subtasks IS in `myIssueKeys`. The parent must not already qualify for a higher band itself (flagged/blocked, done, overdue, my-MR).

### Label
- "In Review — my subtasks" (em dash). Pick a distinct dot color (not purple, which is my-MR; e.g. violet/indigo or amber — Claude's discretion, must differ from existing band dots).

### Own stories in review without my MR
- Out of scope — unchanged. Own stories in review without my open MR keep going to In Progress. The new band is strictly for stories assigned to someone else.

### Claude's Discretion
- Band id string (e.g. `in-review-my-subtasks`), dot color, whether classification lives in `subtreeBand`/`groupByMyDay` vs a new param on `classifyBand` — pick whatever keeps `classifyBand` pure and tests clean.
- Any code that hardcodes band indices (e.g. "cap at 5 (done)") must be updated for the shifted indices (done becomes 6).

</decisions>

<specifics>
## Specific Ideas

- Update `MY_DAY_BANDS`, `MY_DAY_BAND_LABELS`, `MY_DAY_BAND_DOT` together.
- Update / extend `my-tasks-sort.test.ts` (and MyTasksPage tests if they assert band order/indices).
- Pre-commit hook runs full vitest — RED/GREEN must be one commit.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
