# Phase 44: Loading UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 44-loading-ux
**Areas discussed:** Skeleton design approach, Progressive loading strategy, Flicker prevention, Scope of coverage, Refresh button behavior

---

## Skeleton Design Approach

### Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Per-view skeleton components | Dedicated SprintBoardSkeleton, BacklogSkeleton, etc. that match each view's actual layout | ✓ |
| Shared skeleton building blocks | Small library of skeleton primitives (SkeletonCard, SkeletonTable, SkeletonColumn) composed per view | |
| Inline skeleton markup | Keep current pattern — skeleton divs inline in each view's loading branch | |

**User's choice:** Per-view skeleton components
**Notes:** Matches the "layout-matched" requirement from LOAD-01

### Location

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located with each view | SprintBoardSkeleton.tsx next to SprintBoardTab.tsx | ✓ |
| Centralized skeletons folder | src/components/skeletons/ with all skeleton components together | |
| You decide | Claude picks the best location | |

**User's choice:** Co-located with each view

### Primitive

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn Skeleton primitive | Use existing Skeleton component from skeleton.tsx | ✓ |
| Raw divs like current SprintBoardTab | Keep using raw divs with bg-muted animate-pulse | |
| You decide | Claude picks whichever makes sense per view | |

**User's choice:** shadcn Skeleton primitive

---

## Progressive Loading Strategy

### Sprint Board

| Option | Description | Selected |
|--------|-------------|----------|
| Two-stage query | Sprint issues load first, subtask queries fire after — subtasks appear progressively | ✓ |
| Single query with streaming render | Fetch everything in one query but render parents first | |
| Suspense boundaries per swimlane | Each story swimlane has its own Suspense boundary | |

**User's choice:** Two-stage query
**Notes:** Matches existing two-query subtask strategy

### Backlog

| Option | Description | Selected |
|--------|-------------|----------|
| Parallel queries, render as each resolves | Main issues query renders table immediately, epic metadata fills in alongside | ✓ |
| Staggered render with placeholders | Issue rows render with placeholder badges for epic metadata | |
| You decide | Claude picks based on existing backlog data flow | |

**User's choice:** Parallel queries, render as each resolves

---

## Flicker Prevention

### Delay Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Custom useDelayedLoading hook | Hook takes isPending, returns showSkeleton — false for first 200ms | ✓ |
| useTransition with startTransition | React 18's useTransition to keep showing old content | |
| CSS animation-delay | Skeleton renders but CSS animation-delay: 200ms keeps it invisible | |

**User's choice:** Custom useDelayedLoading hook

### Delay Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform 200ms everywhere | Same delay for all views | ✓ |
| Configurable per view | Hook accepts custom delay per view | |
| You decide | Claude picks the right granularity | |

**User's choice:** Uniform 200ms everywhere

---

## Scope of Coverage

### View Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| All 8 views in this phase | Sprint board, backlog, my tasks, workload, epics, releases, notifications, dashboard widgets | ✓ |
| Priority first, rest later | Sprint board + backlog first, then other 6 views | |
| Core views only | Sprint board, backlog, my tasks, workload only | |

**User's choice:** All 8 views in this phase

### Existing Markup

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with new components | Migrate existing inline skeleton divs to new per-view components | ✓ |
| Leave existing, add new only | Keep inline skeletons in SprintBoardTab/BacklogPage as-is | |

**User's choice:** Replace with new components

---

## Refresh Button Behavior

**User-initiated addition:** Refresh buttons on each page should invalidate caches, show skeleton, and reload all data.

### Refresh Skeleton Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Show skeleton immediately on refresh | Skip 200ms delay — user expects visible feedback | |
| Same 200ms delay as initial load | Consistent behavior | |
| You decide | Claude picks based on UX best practices | ✓ |

**User's choice:** You decide (Claude's discretion)

---

## Claude's Discretion

- Exact layout dimensions and proportions for each skeleton component
- Refresh button skeleton timing (immediate vs 200ms delayed)
- Cache invalidation mechanism on refresh (invalidateQueries vs removeQueries)
- Dashboard widget skeleton granularity

## Deferred Ideas

None — discussion stayed within phase scope
