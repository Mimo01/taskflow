# Phase 47: Optimize Backlog View Performance with Progressive Loading - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 47-optimize-backlog-view-performance-with-progressive-loading
**Areas discussed:** Loading strategy, Virtualization fix, Pagination approach, LOAD-04 completion

---

## Loading Strategy

### Q1: How should the backlog load data progressively?

| Option | Description | Selected |
|--------|-------------|----------|
| Split into per-section queries | Break fetchBacklogView into separate queries: active sprint, future sprint, backlog. Each section renders as its query resolves. | ✓ |
| Keep single query, render sections progressively | Keep fetchBacklogView as-is but render sprint sections from sprint stories cache first. | |
| Streaming approach | Fetch first page of each section quickly, render immediately, then fetch remaining in background. | |

**User's choice:** Split into per-section queries (Recommended)

### Q2: Should sprint sections reuse SprintBoardTab's cached sprint stories query?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse sprint stories cache | Sprint sections read from same jira-sprint-stories query key. Instant render if sprint board was visited. | ✓ |
| Dedicated backlog queries | Backlog gets its own query keys for sprint issues. Independent cache. | |

**User's choice:** Reuse sprint stories cache (Recommended)

### Q3: What should the backlog-only query fetch?

| Option | Description | Selected |
|--------|-------------|----------|
| JQL query for unsprinted issues | Simple JQL: project = X AND sprint is EMPTY. No board dependency for backlog section. | |
| Keep Agile board API for backlog section | Use /rest/agile/1.0/board/{id}/backlog endpoint. Preserves board-level JQL filtering. | |

**User's choice:** "you decide" — delegated to Claude's discretion
**Notes:** User explicitly deferred this decision to Claude.

---

## Virtualization Fix

### Q4: How should virtualization be fixed?

| Option | Description | Selected |
|--------|-------------|----------|
| Div-based rows with table styling | Replace table/tr with divs using CSS grid/flex. TanStack Virtual works correctly with divs. | ✓ |
| Window-based virtualizer | Single scroll container virtualizer across all sections. One virtualizer for entire page. | |
| Keep virtualization disabled | If sections are small enough after splitting, virtualization may not be needed. | |

**User's choice:** Div-based rows with table styling (Recommended)

### Q5: Should virtualization apply to all sections or only above a threshold?

| Option | Description | Selected |
|--------|-------------|----------|
| All sections virtualized | Consistent behavior. Every section uses same div-based virtualized component. | ✓ |
| Threshold-based (50+ issues) | Only virtualize sections with 50+ issues. Sprint sections render normally. | |
| You decide | Claude picks based on implementation trade-offs. | |

**User's choice:** All sections virtualized (Recommended)

---

## Pagination Approach

### Q6: Should the backlog section add pagination or load all at once?

| Option | Description | Selected |
|--------|-------------|----------|
| Load all, virtualize rendering | Fetch all backlog issues upfront, virtualize so only visible rows in DOM. Works up to ~500-1000 issues. | ✓ |
| Paginated with load-more | Fetch first 50 issues, show Load more button. Faster initial for very large backlogs. | |
| Infinite scroll | Fetch pages automatically as user scrolls. Would close ADVN-02 from future requirements. | |

**User's choice:** Load all, virtualize rendering (Recommended)

---

## LOAD-04 Completion

### Q7: Should this phase enhance per-row progressive epic loading?

| Option | Description | Selected |
|--------|-------------|----------|
| Header-level is sufficient | LOAD-04 effectively complete. Split-query approach will naturally improve further. | |
| Add per-row epic badge skeletons | Show Skeleton placeholders in each row's epic column until allEpics resolves. | ✓ |
| You decide | Claude assesses whether split-query refactor naturally closes the gap. | |

**User's choice:** Add per-row epic badge skeletons

---

## Claude's Discretion

- Backlog-only query approach (JQL REST vs Agile board backlog endpoint)
- CSS grid/flex column widths for div-based table
- Virtualizer configuration details
- Component naming for div-based table replacement
- Future sprint section query strategy
