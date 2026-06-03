# Phase 77: Universal Peek Slideover and Issue-Detail Refinements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 77-Universal Peek Slideover and Issue-Detail Refinements
**Areas discussed:** Panel size & non-blocking feel, Peek content fidelity, Lifecycle & dismissal, Key affordance & detail refinements

---

## Panel size & non-blocking feel

### Panel layout & underlying reaction

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow overlay, content stays put (~440px) | Panel slides over right edge; underlying layout unchanged | |
| Medium overlay (~600px) | Roomier, covers more of underlying view | |
| Push content (squeeze layout) | Main content shrinks to make room; no overlap | ✓ |

**User's choice:** Push content (squeeze layout)
**Notes:** Cleanly sidesteps the `modal={false}`/backdrop tension — peek becomes a layout sibling, not a floating Dialog.

### Panel width / small-window behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed ~480px, content flexes | Predictable width; overlay on narrow windows | |
| ~40% of width | Proportional; can get very wide on big monitors | |
| Resizable by user (drag divider) | User drags divider; persists | ✓ |

**User's choice:** Resizable by user (drag divider)

### Visual separation

| Option | Description | Selected |
|--------|-------------|----------|
| Border + subtle shadow, no dimming | Left border + soft shadow; full underlying brightness | ✓ |
| Just a border divider | Flat single border line | |
| Dim the underlying content slightly | Lower opacity on main content | |

**User's choice:** Border + subtle shadow, no dimming

### Resize defaults & persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Default 480px, min 360 / max 720, persisted | Clamped + remembered across sessions | ✓ |
| Default 480px, clamped, NOT persisted | Resets each launch | |
| Wider default 600px, persisted | Roomier start | |

**User's choice:** Default ~480px, min 360 / max 720, persisted

---

## Peek content fidelity

### Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Full interactive detail | Reuse IssueDetailContent + Sidebar, fully editable | ✓ |
| Read-only preview | Summary/desc/fields only; edit via Open full page | |

**User's choice:** Full interactive detail
**Notes:** Maximum reuse, no second codepath. "Open full page" is for room / shareable URL, not for unlocking editing.

### Narrow-panel layout

| Option | Description | Selected |
|--------|-------------|----------|
| Single column, fields on top | Meta/fields, then description, then comments | ✓ |
| Single column, description first | Description/comments top, fields below | |
| Keep two columns when wide enough | Switch to two-col past ~640px | |

**User's choice:** Single column, sidebar fields on top
**Notes:** Two-column (content 60% + sidebar 42%) doesn't fit ~480px; peek uses a stacked variant. Full-page detail keeps its own layout.

---

## Lifecycle & dismissal

### Route-change behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Close on navigation to a different route | Section switch closes peek; swap within view keeps it | ✓ |
| Persist across all navigation | Global companion panel until explicitly dismissed | |

**User's choice:** Close on navigation to a different route

### Click-away dismissal

| Option | Description | Selected |
|--------|-------------|----------|
| No click-away dismiss | Only Esc / X / Open-full-page close it | ✓ |
| Click empty/background area dismisses | Empty-space click closes; card click swaps | |

**User's choice:** No click-away dismiss

### Peek header controls

| Option | Description | Selected |
|--------|-------------|----------|
| Header bar: key/breadcrumb left, Open-full-page + X right | Labeled Open-full-page button + X | ✓ |
| Icon-only controls | Expand icon + X, no text | |

**User's choice:** Header bar with labeled Open full page + X
**Notes:** Navigating to /issue/:key is a different route, so Open-full-page closes the peek via the route-change rule — single mechanism.

---

## Key affordance & detail refinements

### Issue key behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Key = link, hover underline + pointer; body = peek | Distinct inner clickable, stopPropagation → full page | ✓ |
| Key link, no special hover styling | Navigates but looks the same; cursor only | |
| Modifier-click alternative too | Key + cmd/ctrl-click both go full page | |

**User's choice:** Key = link, hover underline + pointer; body = peek
**Notes:** Uniform rule across all surfaces; TaskCard's single big button must split the key out.

### DETAIL-01 parent link placement

| Option | Description | Selected |
|--------|-------------|----------|
| Breadcrumb-style above the title | `↗ PARENT-KEY summary` at top of main content | ✓ |
| Labeled 'Parent' block above description | 'Parent:' row below title | |

**User's choice:** Breadcrumb-style link above the summary/title
**Notes:** Removed from sidebar; mirrors subtask-under-story model.

### DETAIL-02 cursor sweep scope

| Option | Description | Selected |
|--------|-------------|----------|
| All clickable areas in issue detail | Full audit of content/sidebar/fields/linked/subtasks | ✓ |
| Only named items (parent, subtasks, linked) | Narrower fix | |

**User's choice:** All clickable areas in issue detail

### In-peek link navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Swap the peek to that issue | In peek, parent/subtask/linked clicks swap preview | ✓ |
| Always navigate full-page | In-detail links always go full-page | |

**User's choice:** Swap the peek to that issue
**Notes:** In full-page detail, same links navigate full-page as today — `onOpenIssue` is the context-sensitive seam.

---

## Claude's Discretion

- Technical seam for context-sensitive `onOpenIssue` (swap vs navigate)
- Drag-divider implementation details (resize handle, pointer math, persistence key naming)
- Peek loading/skeleton state (follows existing `IssueDetailSkeleton`)

## Deferred Ideas

- Deep-link / URL sync for the open peek (`?peek=PROJ-123`)
- Modifier-click (cmd/ctrl-click → full page) as an alternative affordance
- Keyboard navigation (j/k) between issues while peek is open
