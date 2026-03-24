# Phase 33: Board, Sprint & Filters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 33-Board, Sprint & Filters
**Areas discussed:** Sprint goal banner, Quick filters & labels, Bulk operations UX, Saved filters (Jira sync)

---

## Sprint Goal Banner

| Option | Description | Selected |
|--------|-------------|----------|
| Accent banner | Colored strip below sprint name, always visible | ✓ |
| Inline subtitle | Muted text under sprint name, minimal weight | |
| Collapsible banner | Accent banner with toggle to collapse/expand | |

**User's choice:** Accent banner
**Notes:** None

### No goal behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hide banner entirely | No visual artifact when no goal set | ✓ |
| Show placeholder | Muted "No sprint goal set" text | |

**User's choice:** Hide banner entirely

### Long goal text

| Option | Description | Selected |
|--------|-------------|----------|
| Truncate with expand | One line with ellipsis, click to expand | |
| Always show full text | Banner grows to fit all text | ✓ |
| Tooltip on hover | Truncate to one line, tooltip on hover | |

**User's choice:** Always show full text

---

## Quick Filters & Labels

### Jira QF integration

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated chip row | Separate row above existing filter bar | ✓ |
| Merged into filter bar | Additional chips inside existing filter bar | |
| You decide | Claude picks best approach | |

**User's choice:** Dedicated chip row

### QF stacking behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Additive / AND | QF narrows results on top of existing filters | ✓ |
| Replaces existing filters | Activating QF clears existing filter bar | |
| You decide | Claude picks based on API behavior | |

**User's choice:** Additive / AND

### Label chips placement

| Option | Description | Selected |
|--------|-------------|----------|
| Same row as Jira QFs | Labels as toggle chips alongside Jira QFs | ✓ |
| Use existing Label dropdown | Label filtering stays in existing dropdown | |
| You decide | Claude picks best approach | |

**User's choice:** Same row as Jira QFs

---

## Bulk Operations UX

### Multi-select mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox on cards | Checkboxes on hover, shift+click for range | ✓ |
| Click-to-select mode | Enter selection mode via toolbar button | |
| Cmd/Ctrl+click | Hold modifier key to multi-select | |

**User's choice:** Checkbox on cards

### Bulk action toolbar placement

| Option | Description | Selected |
|--------|-------------|----------|
| Floating bottom bar | Fixed bar at bottom, appears when >=1 selected | ✓ |
| Inline above columns | Replaces filter bar area temporarily | |
| You decide | Claude picks best placement | |

**User's choice:** Floating bottom bar

### Progress/results display

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with progress | Toast notification with progress bar and results | ✓ |
| Inline in toolbar | Toolbar shows spinner + counter | |
| You decide | Claude picks best progress UX | |

**User's choice:** Toast with progress

---

## Saved Filters (Jira Sync)

### Local vs Jira relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Replace local with Jira | Server-side only, migrate local presets | |
| Both coexist | Local quickfilters + Jira saved filters as separate systems | ✓ |
| You decide | Claude picks best approach | |

**User's choice:** Both coexist

### Sidebar access

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar section with filter list | "Saved Filters" section lists favourite Jira filters | ✓ |
| Sidebar link to filter page | Single "Filters" link opens dedicated page | |
| You decide | Claude picks best sidebar integration | |

**User's choice:** Sidebar section with filter list

### Filter click action

| Option | Description | Selected |
|--------|-------------|----------|
| Opens filtered issue list view | Navigates to dedicated filter results page | |
| Applies to sprint board | Stays on board, applies filter as constraint | ✓ |
| You decide | Claude picks based on API behavior | |

**User's choice:** Applies to sprint board

### Save flow

| Option | Description | Selected |
|--------|-------------|----------|
| Save button in filter bar | "Save as filter" button when any filter active | ✓ |
| From command palette only | Save via Cmd+K only, no visible button | |
| You decide | Claude picks best save flow | |

**User's choice:** Save button in filter bar

---

## Claude's Discretion

- Quick filter chip styling and active state indicators
- Exact Jira Agile API endpoints for board configuration / quick filter discovery
- Bulk operation concurrency limit
- Toast component reuse vs new implementation
- JQL translation from local filter state
- Checkbox visibility behavior (always vs hover-only)

## Deferred Ideas

None — discussion stayed within phase scope
