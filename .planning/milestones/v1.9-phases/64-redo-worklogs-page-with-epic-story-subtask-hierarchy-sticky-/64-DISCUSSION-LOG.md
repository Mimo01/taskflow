# Phase 64: Redo worklogs page with epic/story/subtask hierarchy, sticky headers and columns, clickable tasks with breadcrumbs, and log entry editing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 64-redo-worklogs-page-with-epic-story-subtask-hierarchy-sticky
**Areas discussed:** Row organization, Jira enrichment, Breadcrumb behavior, Editing scope

---

## Row Organization

### Primary row dimension

| Option | Description | Selected |
|--------|-------------|----------|
| Tasks-first | Rows are Jira issues (Epic → Story → Subtask). Person filter still used for hours filtering. | |
| Person-first | Top-level rows are people, expandable to show their logged tasks in a hierarchy. | |
| Tasks-only, no person column | Rows are issues only. Person is not shown — just the hours for the selected person (or all). | ✓ |

**User's choice:** Tasks-only, no person column

---

### Collapse/expand behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always expanded | All levels always visible. Simpler to implement, no expand state needed. | ✓ |
| Collapsible | Epics can be collapsed to hide their stories/subtasks. | |

**User's choice:** Always expanded (recommended)

---

### Cell content for multiple entries

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregate (sum) | Multiple entries are summed into one number. | ✓ |
| Show count indicator | Total hours + subtle badge with entry count. | |

**User's choice:** Aggregate (sum — recommended)

---

### Person filter scope

| Option | Description | Selected |
|--------|-------------|----------|
| Filter still applies | Show hours for selected person only; aggregate all when no selection. | ✓ |
| Filter removed | Always show all people aggregated. | |

**User's choice:** Filter still applies (recommended)

---

## Jira Enrichment

### Fetch strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Batch JQL after worklogs load | One Jira search with all unique issueKeys. | ✓ |
| Per-key fetch (N+1) | Individual request per issue key. | |
| Lazy on expand | N/A since rows are always expanded. | |

**User's choice:** Batch JQL after worklogs load (recommended)

---

### Hierarchy depth

| Option | Description | Selected |
|--------|-------------|----------|
| 3 levels: Epic → Story → Subtask | Standard Jira hierarchy. | ✓ |
| 2 levels only: Story → Subtask | Skip epic grouping. | |
| Flat with issue type indicator | No nesting, just type badges. | |

**User's choice:** 3 levels: Epic → Story → Subtask (recommended)

---

### Unresolvable issue handling

| Option | Description | Selected |
|--------|-------------|----------|
| Show with fallback label | Show issueKey as label with muted/strikethrough style. | ✓ |
| Skip silently | Omit from hierarchy, hours lost from view. | |

**User's choice:** Show with fallback label (recommended)

---

## Breadcrumb Behavior

### Click action

| Option | Description | Selected |
|--------|-------------|----------|
| Navigate in-app to /issue/:key | Uses existing handleIssueClick. Trail shows "Worklogs > KEY". | ✓ |
| Open in browser | Opens Jira URL via openUrl(). | |

**User's choice:** Navigate in-app to /issue/:key (recommended)

---

### What "breadcrumbs" means

| Option | Description | Selected |
|--------|-------------|----------|
| The hierarchy indentation IS the breadcrumb | No explicit breadcrumb UI. Visual nesting communicates hierarchy. | |
| Each row shows a text breadcrumb trail | "PROJ-1 / PROJ-12 / PROJ-123" beside the task summary. | |
| App nav breadcrumb in top bar | Trail "Worklogs > ISSUE-123" handled by handleIssueClick automatically. | ✓ |

**User's choice:** App nav breadcrumb in top bar

---

### How WorklogsPage receives handleIssueClick

| Option | Description | Selected |
|--------|-------------|----------|
| Prop from main.tsx | Pass onIssueClick as prop, same as BacklogPage/SprintBoardPage. | ✓ |
| useNavigate + construct path | Navigate directly, bypasses trail system. | |

**User's choice:** Prop from main.tsx (recommended)

---

## Editing Scope

### How editing is triggered

| Option | Description | Selected |
|--------|-------------|----------|
| Click a non-zero cell to open a popover | Popover shows individual entries with edit/delete/add. | ✓ |
| Right-click context menu on cell | Context menu with Edit/Delete per entry. | |
| Inline edit on click | Cell becomes an input to change hours. | |

**User's choice:** Click a non-zero cell to open a popover

---

### Can new entries be added from the table?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add entry button in cell popover | Reuses createWorklog + LogWorkPopover pattern. | ✓ |
| No — edit/delete only | Adding requires navigating to issue detail. | |

**User's choice:** Yes — add entry button in cell popover

---

### Table refresh after mutation

| Option | Description | Selected |
|--------|-------------|----------|
| Invalidate TanStack Query cache | queryClient.invalidateQueries(['tempo','worklogs',...]). | ✓ |
| Manual refetch | Call refetch() directly. | |

**User's choice:** Invalidate TanStack Query cache (recommended)

---

## Claude's Discretion

- **Sticky CSS specifics** (D-15): z-index layering, `bg-background` on sticky cells, container `overflow-auto` — implementation details left to Claude.
- **Epic/Story/Subtask visual styling**: indentation levels (`pl-4`, `pl-8`), font weight, row background — left to Claude within the existing design system.
- **D-10**: Whether Epic/Story header rows (without direct worklogs) are also clickable — left to Claude.
- **Synthetic group for orphans**: Issues with unknown parent chain grouped under "No Epic" — Claude's discretion on label/style.

## Deferred Ideas

None — discussion stayed within phase scope.
