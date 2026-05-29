# Phase 73: Sprint Board on `allData.json` - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 73-sprint-board-on-alldata-json
**Areas discussed:** Columns shift (3→N from columnsData), Subtasks & orphan parents, timeInColumn surfacing, Refresh + legacy cleanup

---

## Columns shift (3→N from columnsData)

### Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Equal-width, horizontal scroll if >3 | Min-width per column; scroll past viewport | |
| Equal-width, flex-shrink to fit viewport | All N columns always fit; cramped past ~5 | |
| Equal-width capped at viewport, scroll only when needed | Hybrid: flex when fits, scroll when many | |
| Keep 3 columns (TODO/INPROGRESS/DONE); bucket additional GH states | User's free-text answer | ✓ |

**User's choice:** "3 columns: TODO, INPROGRESS, DONE; The additional states belong to one of these"
**Notes:** Triggered a follow-up bucket-mapping question. Captured as D-03/D-03a in CONTEXT.md with explicit interpretation of GH-BOARD-03 — `columnsData` is consumed via `entityData.statuses` for statusCategory, but visual layout stays 3-bucket.

### Drag target (single drop column → which statusId?)

| Option | Description | Selected |
|--------|-------------|----------|
| First legal statusId in column.statusIds | Deterministic walk through column list | |
| If 1 → use it; if multiple → prompt picker | Popover when ambiguous | ✓ |
| Allow drop only if exactly one legal transition | Strictest; reject ambiguous | |

**User's choice:** Prompt picker on ambiguous
**Notes:** Picker UX follow-up locked: reuse existing StatusPopover anchored to the dropped card.

### Done-detection (allDoneFingerprint at line 890)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep statusCategory via entity-map | Existing fingerprint logic keeps working | |
| Switch to columnsData last-column = done | Rewrite fingerprint | |
| Hybrid: prefer columnsData, fall back to statusCategory | Cleaner long-term, more paths | |
| Claude's discretion | "you decide" | ✓ |

**User's choice:** Claude's discretion → Keep `statusCategory.key === 'done'` (consistent with the bucket-mapping decision above).
**Notes:** Captured under "Claude's Discretion" in CONTEXT.md.

### Bucket mapping (5 GH columns → 3 buckets)

| Option | Description | Selected |
|--------|-------------|----------|
| Position-based (first→TODO, last→DONE, middle→INPROGRESS) | Pure positional from columnsData order | |
| Per-statusId statusCategory | Each status inherits its own category | ✓ |
| Hybrid (positional + statusCategory='done' override) | Positional with safety net | |

**User's choice:** Per-statusId statusCategory.
**Notes:** Locked as D-03.

### Drop picker UX

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing StatusPopover anchored to dropped card | Pre-filtered to bucket's legal transitions | ✓ |
| Inline menu at drop position | New popover; less consistent | |
| Auto-pick most-recently-used target per bucket (persisted) | No picker; localStorage memory | |

**User's choice:** Reuse StatusPopover.
**Notes:** Captured in `<specifics>`.

---

## Subtasks & orphan parents

### Subtask scope (allData only returns sprint issues)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — allData-only behavior | Subtasks of in-sprint stories that aren't in the sprint disappear | ✓ |
| No — supplementary call to preserve current behavior | Defeats single-call goal | |
| Yes with console.warn on delta | Ship + instrument | |

**User's choice:** Yes — allData-only behavior.
**Notes:** Locked as D-04a; matches Jira's own sprint-board behavior.

### Orphan subtasks (subtask in sprint, parent not)

| Option | Description | Selected |
|--------|-------------|----------|
| Promote to top-level standalone cards | Render in their statusCategory bucket | |
| Hide entirely | Risky | |
| Group under synthetic "Other subtasks" parent | Adds UI | |
| Claude's discretion | "you decide. is it a problem? What does the alldata return?" | ✓ |

**User's choice:** Claude's discretion (after Claude clarified allData semantics).
**Notes:** Decision: standalone-card rendering + `warnOnce` per orphan parentId. Captured as D-04b + under "Claude's Discretion".

---

## timeInColumn surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Small badge "3d in In Progress" on each card | Always visible | |
| Hover/title tooltip only | No visible badge | |
| Stale-indicator only (badge when > N days) | Threshold-based; needs config | |
| Just expose on adapted Issue; UI in a follow-up | Loophole reading of criterion | |
| Claude's discretion | "you decide" | ✓ |

**User's choice:** Claude's discretion.
**Notes:** Decision: small unobtrusive badge using `formatDistanceToNowStrict` (e.g. "3d"), with native `title` attribute. Captured as D-05/D-05a + under "Claude's Discretion". Stale-warning thresholds deferred.

---

## Refresh + legacy cleanup

### Poll interval for allData

| Option | Description | Selected |
|--------|-------------|----------|
| Keep POLL_INTERVAL_MS = 60s (Recommended) | Net request count drops 6→1; cadence stays | ✓ |
| Slow to 2–3 min for heavier payload | Less traffic; staler cards | |
| Drop polling — manual refresh only | Behavioral change | |

**User's choice:** Keep 60s.
**Notes:** Locked as D-06.

### Bundled "Reload board" toolbar action

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — replace Phase 72's "Reload workflow transitions" with single "Reload board" (Recommended) | Single discoverable refresh; subsumes Phase 72 deferral | ✓ |
| Yes — add alongside Phase 72 item (keep both) | Two buttons; redundant | |
| No — leave Phase 72 item as-is | Punt | |

**User's choice:** Replace with single "Reload board".
**Notes:** Locked as D-07/D-07a; fulfills Phase 72's explicit deferral.

### Sidebar prefetch swap

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — swap Sidebar prefetch to fetchGhAllData (Recommended) | Warm cache matches the cache the board reads | ✓ |
| No — leave Sidebar prefetching the old fetcher | Wastes a network call | |
| Remove Sidebar prefetch entirely | UX regression on cold open | |

**User's choice:** Swap Sidebar prefetch.
**Notes:** Locked as D-08/D-08a.

---

## Claude's Discretion

- Done-detection refactor (`allDoneFingerprint` at SprintBoardTab.tsx:890) → keep `statusCategory.key === 'done'`.
- Orphan subtask UX (D-04b) → standalone-card rendering + `warnOnce`.
- timeInColumn UX level (D-05) → small always-visible badge.

## Deferred Ideas

- N-column board layout (full GH columnsData rendering)
- Stale-card warning thresholds for `timeInColumn`
- Board-wide aging dashboards/reports over `timeInColumn`
- Persisted "last status picked" per bucket for drag-drop
- `postTransition` migration to GH (still REST)
- Performance verification with before/after request counts → lands in Phase 75 per GH-CUT-02
- Deleting `fetchEpicsBasic` / `fetchActiveSprint` / `fetchProjectStatuses` (still used by Sidebar/BacklogPage/EpicsPage/DashboardSprintCard)
- Synthetic "Other subtasks" parent for orphan subtasks
- Slower polling cadence for the heavier allData payload
