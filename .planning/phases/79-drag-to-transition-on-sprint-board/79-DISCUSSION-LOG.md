# Phase 79: Drag-to-Transition on Sprint Board - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 79-drag-to-transition-on-sprint-board
**Areas discussed:** Split-column UX, Draggable scope, Invalid-column signalling, Screen/validator transition discoverability

---

## Split-Column UX (TRAN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Split only on hover | Columns stay normal; multi-status column expands into drop boxes only when hovered | |
| Split all at drag start | Every multi-status column with ≥2 valid targets pre-splits at drag start | ✓ |
| Always-on mini-zones | Multi-status columns always show subtle dividers; brighten on hover | |

**User's choice:** Split all at drag start
**Notes:** All options visible upfront before moving the card. Derived: single-target columns stay whole (D-02); drop boxes labelled by transition name, not status name (D-03).

---

## Draggable Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Subtask/task cards only | Only swimlane cards draggable; story header rows not draggable | ✓ |
| Cards + story headers | Both cards and story header rows draggable | |

**User's choice:** Subtask/task cards only
**Notes:** Story headers double as swimlane controls (collapse/expand) — excluding them avoids click/drag conflict and matches the goal's "cards" wording.

---

## Invalid-Column Signalling (TRAN-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Dim + reject drop | Invalid columns dim during drag, reject drop, silent snap-back | (Claude's discretion) |
| Neutral, just no-op | No dimming; invalid columns silently don't register | |
| Dim + tooltip hint | Dim + "No direct transition" hint | |

**User's choice:** You decide → resolved to **Dim + reject drop** (silent snap-back, no error banner — error reserved for failed API calls only). D-06.
**Notes:** Clearest "not here" affordance without noise.

---

## Screen/Validator Transition Discoverability (TRAN-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle 'more in menu' hint | Faint affordance pointing to right-click StatusPopover | |
| Silent — no hint | Omit, no indicator; right-click menu unchanged | (Claude's discretion) |
| You decide | Claude picks least-intrusive satisfying TRAN-03 | |

**User's choice:** You decide → resolved to **Silent — no hint** (D-07). Screen/validator transitions filtered from drop zones, still reachable via right-click StatusPopover. Satisfies "no silent snap-back" because they are never drop targets.
**Notes:** Confirmed via readiness check — "Looks good, write it."

---

## Claude's Discretion

- Invalid-column handling (D-06) — dim + reject drop, silent snap-back, no error.
- Screen/validator transitions (D-07) — silent filter, no hint.
- Drop-box label wording (D-03) — transition name (derived from split-at-start choice).

## Deferred Ideas

- Dragging story header (swimlane parent) rows — out of scope (D-04).
- Intra-column reorder / rank on sprint board — Phase 78 backlog territory.
- Hint/badge for screen-required transitions in drag UI — rejected for now (D-07).
- Keyboard-accessible drag (`KeyboardSensor`) — not requested.
