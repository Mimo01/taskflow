# Phase 70: Standup Notes — Today Section - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 70-standup-notes-today-section
**Areas discussed:** Section makeup & labels, Worklog targets source, My sprint tasks scope, Pinned & targets display

---

## Section makeup & labels

| Option | Description | Selected |
|--------|-------------|----------|
| Three required sections only | Today = exactly STAND-07/08/09: sprint subtasks, pinned issues, worklog targets; drop MRs awaiting you | |
| Add MRs awaiting you | Keep 3 required + a 4th MRs-awaiting section (scope expansion) | |
| Map mockup labels to reqs | Keep mockup structure, reconcile naming | |
| Other (you decide) | — | ✓ |

**User's choice:** "you decide, i want most info possible"
**Notes:** Delegated the structural call with a directive to maximize useful info. Resolved to: In Progress + Up Next (STAND-07 split by status) + MRs Awaiting You (mockup addition, flagged beyond locked reqs) + Pinned (STAND-08). Worklog targets folded into per-row action rather than a separate section. Verified `fetchReviewerMRs` exists, making MRs Awaiting You cheap.

---

## Worklog targets source

| Option | Description | Selected |
|--------|-------------|----------|
| Auto: my in-progress sprint work | Targets = in-progress sprint subtasks (reuse STAND-07 query) | |
| Auto: in-progress + pinned | Union of in-progress sprint issues and pinned issues | |
| Manual curated list | Separate persisted add/remove list | |

**User's choice:** Auto: my in-progress sprint work
**Notes:** Follow-up — since targets equal the In Progress issue set, asked how to present without duplication. User chose **Targets = In Progress + Up Next** (per-row Log Work button on all my open sprint work, no separate section).

### Follow-up: Worklog targets UX

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row Log button on In Progress | Log Work action on in-progress rows only | |
| Separate Worklog Targets section | Distinct 5th section repeating in-progress issues | |
| Targets = In Progress + Up Next | Per-row Log button on both In Progress and Up Next rows | ✓ |

**User's choice:** Targets = In Progress + Up Next

---

## My sprint tasks scope

| Option | Description | Selected |
|--------|-------------|----------|
| Subtasks + standalone tasks/stories | Leaf-level items assigned to me (subtasks + childless tasks/stories/bugs) | ✓ |
| Subtasks only | Matches existing DashboardInProgressCard filter exactly | |
| All my assigned sprint issues | Every assigned issue including parent stories | |

**User's choice:** Subtasks + standalone tasks/stories
**Notes:** Exclude parent stories that have subtasks. Follow-up on status split + grouping → user said "you decide"; locked to status-category flat list (In Progress = `indeterminate`, Up Next = `new`, Done excluded) per the mockup.

### Follow-up: Split & grouping

| Option | Description | Selected |
|--------|-------------|----------|
| By status category, flat list | indeterminate / new split, flat issue rows (matches mockup) | (you decide) |
| By status, grouped under parent | Same split, nested under parent story | |
| Single open list, no split | One list, no In Progress / Up Next separation | |

**User's choice:** "you decide" → resolved to "By status category, flat list"

---

## Pinned & targets display

| Option | Description | Selected |
|--------|-------------|----------|
| Jira issues only | Filter out AIO cycle pins; pinned Jira issues only | |
| Issues + cycles | Show all pins; cycles link to cycle detail | ✓ |

**User's choice:** Issues + cycles
**Notes:** Pinned section read-only (no pin/unpin). Jira issues → issue detail; AIO cycles (in `pinnedCycleMeta`) → cycle detail page.

### Follow-up: Empty states & ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Hide empty, keep fixed order | Empty sections disappear; fixed order | |
| Always show with empty states | All sections always render with empty-state text | |
| Hide empty, but errors visible | Hide empty sections; show inline error + retry on fetch failure | ✓ |

**User's choice:** Hide empty, but errors visible
**Notes:** Fixed order In Progress → Up Next → MRs Awaiting You → Pinned. Overall empty state when all sections empty.

---

## Claude's Discretion

- Status-split + grouping layout details (resolved to flat status-category list per mockup; row layout refinements left open).
- Sprint-work query strategy: `fetchSprintIssues(assignedToMe=true)` vs shared sprint-board fetch + client filter — planner picks for cache reuse.
- `LogWorkPopover` trigger styling/placement per row.
- MR review-state badge derivation (existing util vs inline).
- Whether to extend page "Copy markdown" to include Today (not required by STAND-07/08/09).
- Story-points field key resolution plumbing.

## Deferred Ideas

- Manual curated worklog-targets list (rejected in favor of auto-derive from sprint work).
- Extending Copy markdown to cover the Today section (future enhancement).
- Grouping sprint subtasks under parent story in the Today column (rejected in favor of mockup's flat list).
