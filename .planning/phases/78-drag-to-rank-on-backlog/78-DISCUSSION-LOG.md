# Phase 78: Drag-to-Rank on Backlog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 78-drag-to-rank-on-backlog
**Areas discussed:** Drag scope, Cross-section moves, Drag handle, Drop feedback, Error surface

---

## Drag Scope (which lists)

| Option | Description | Selected |
|--------|-------------|----------|
| Active sprint only | Only ACTIVE sprint section draggable — matches goal wording | |
| All sprint sections | Active + future sprints draggable; backlog bucket static | |
| Every list | Active, future, and backlog bucket all draggable (intra-list each) | ✓ |

**User's choice:** Every list
**Notes:** Widens beyond the goal's "active-sprint list" wording — user explicit.

---

## Cross-Section Moves

| Option | Description | Selected |
|--------|-------------|----------|
| Intra-list only | Reorder within same section only; no cross-section moves | |
| Allow cross-list | Cross-section moves change sprint membership (extra API call) | |
| (free text) | Intra-list normal, cross-list with confirmation | ✓ |

**User's choice:** "Intra-list normal, cross-list with confirmation"
**Notes:** Follow-up confirmed: confirmation dialog on cross-section drop
(Confirm/Cancel; Cancel rolls back). Confirmed-path API failure rolls back the
same way a failed rank PUT does. Cross-section move fires a sprint-membership
API call in addition to the rank PUT. This is a scope expansion beyond the
original intra-list RANK requirements, accepted by the user.

---

## Drag Handle

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit grip handle | Grip icon is the only draggable target — most discoverable | |
| Whole row draggable | Entire row draggable; 150ms delay + justDragged disambiguate | ✓ |
| Handle + whole row | Both grip handle and whole-row drag | |

**User's choice:** Whole row draggable
**Notes:** Relies on locked PointerSensor `{ delay: 150, tolerance: 5 }` +
`justDragged` guard to separate from click-to-peek.

---

## Drop Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Overlay ghost + insertion line | DragOverlay clone follows cursor + insertion line | ✓ |
| Gap placeholder | Row lifts, list opens a gap; no separate ghost | |
| Overlay ghost only | Ghost follows cursor; no explicit insertion line | |

**User's choice:** Overlay ghost + insertion line

| Option (cross-list cue) | Description | Selected |
|--------|-------------|----------|
| Highlight target section | Hovered section gets subtle highlight while dragging | ✓ |
| Same as intra-list | No special cross-list cue; confirm dialog handles it | |

**User's choice:** Highlight target section

---

## Error Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Inline banner | Dismissible banner at top of list | (Claude default ✓) |
| Transient toast | Auto-dismissing toast | |
| Row highlight + message | Affected row flashes with inline message | |

**User's choice:** "You decide" → Claude defaulted to inline banner (matches
RANK-04 "inline error"; reuses existing `StaleDataBanner` / `alert.tsx`; toasts
easy to miss during the poll window).

---

## Claude's Discretion

- Error surface — user deferred ("you decide"); chose inline banner reusing
  existing primitives.
- Exact confirmation-dialog and banner components — reuse app's existing
  primitives; planner picks.

## Deferred Ideas

- Explicit grip-handle affordance (revisit only if accidental drags surface in UAT).
- Keyboard-accessible drag (dnd-kit `KeyboardSensor`) — not requested.
- Drag-to-transition on the sprint board — Phase 79.
