# Phase 36: Restore Sidebar Drag-Reorder - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 36-restore-sidebar-drag-reorder
**Areas discussed:** Drag interaction style, Section boundaries, Reorder scope

---

## Drag Interaction Style

| Option | Description | Selected |
|--------|-------------|----------|
| Drag handle icon | GripVertical icon on left of each row — click+drag handle to reorder. Checkbox stays clickable without accidental drags. | ✓ |
| Full-row drag | Entire row is draggable — simpler but risks accidental drags when toggling checkboxes. | |

**User's choice:** Drag handle icon
**Notes:** Matches Phase 34 accessibility decision for separate drag handle button.

---

## Section Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Reorder within sections only | Items stay in their section. Keeps semantic grouping intact, simpler implementation. | |
| Free reorder across sections | Items can be dragged anywhere. Sections become soft visual dividers. | ✓ |
| No sections — flat list | Remove section headers entirely from settings list. | |

**User's choice:** Free reorder across sections
**Notes:** None

---

## Reorder Scope (Sidebar Rendering)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep section headers | Sidebar still shows Work/Views/Tools headers. Items keep section affinity. Order within each section is custom. | ✓ |
| Flat sidebar, no headers | Remove section headers from sidebar entirely. Items in exact drag order. | |
| User's order with auto-sections | Sections inserted automatically when different-section item appears. Could look cluttered. | |

**User's choice:** Keep section headers
**Notes:** Items maintain section affinity — reordering changes position within each section in the sidebar, not which section an item belongs to.

---

## Claude's Discretion

- Drag overlay visual feedback (opacity, shadow, scale)
- Drop placeholder styling
- Whether to use restrictToVerticalAxis modifier
- Animation timing for reorder transitions

## Deferred Ideas

None — discussion stayed within phase scope
