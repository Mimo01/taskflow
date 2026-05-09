# Phase 50: Draggable Sidebar Resize - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 50-Draggable Sidebar Resize
**Areas discussed:** Main sidebar + collapse interaction, Detail pages scope & shared state, Drag handle visual design, Width bounds & snapping

---

## Main Sidebar + Collapse Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Independent — collapse toggle and resize are separate | Dragging sets expanded width; collapse toggle still collapses to 64px; uncollapsing restores last drag-set width | ✓ |
| Unified — dragging past min threshold auto-collapses | Pull sidebar narrow enough and it snaps to collapsed state | |
| You decide | Pick whatever feels most natural | |

**User's choice:** Independent — collapse toggle and resize are separate

---

| Option | Description | Selected |
|--------|-------------|----------|
| No — drag handle only in expanded mode | Collapsed sidebar is icon-only; resize only makes sense when expanded | ✓ |
| Yes — drag handle always present | Even in collapsed mode the edge is draggable; dragging right expands + resizes in one motion | |

**User's choice:** No — drag handle only in expanded mode

---

## Detail Pages Scope & Shared State

| Option | Description | Selected |
|--------|-------------|----------|
| Shared — one 'detail panel' width for all three | One persisted width shared across Issue, MR, Release detail pages | |
| Per-page — each stores its own width | Three separate localStorage keys; user can size each independently | ✓ |

**User's choice:** Per-page — each stores its own width

---

| Option | Description | Selected |
|--------|-------------|----------|
| All three — Issue, MR, and Release | Consistent with phase goal "any other detail pages with a secondary sidebar" | ✓ |
| Just Issue and MR detail | Release detail less frequently used — skip for now | |

**User's choice:** All three — Issue, MR, and Release

---

## Drag Handle Visual Design

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor change only — ew-resize cursor on hover | Clean and minimal; border highlights on hover | |
| Grip dots — 3 vertical dots visible on hover | Subtle grip icon appears on hover | |
| Always-visible divider line with accent color | Divider always styled differently to signal resizability | |

**User's choice:** "you decide" — deferred to Claude

---

## Width Bounds & Snapping

| Option | Description | Selected |
|--------|-------------|----------|
| 160px min / 320px max (main nav sidebar) | Keeps nav labels readable; 320px natural upper bound | |
| 120px min / 400px max | More flexible; nav labels may clip at 120px | |
| You decide | | ✓ |

**User's choice:** "you decide" — deferred to Claude

---

| Option | Description | Selected |
|--------|-------------|----------|
| 240px min / 50% of viewport max (detail panels) | Keeps fields readable; main content always gets at least half | |
| 200px min / 600px max (fixed px) | Fixed px bounds; simpler but 600px could be too wide | |
| You decide | | ✓ |

**User's choice:** "you decide" — deferred to Claude

---

## Claude's Discretion

- **Drag handle visual:** Resize cursor (`ew-resize`) on hover + subtle border highlight. No permanent visual element. Chosen to match the app's clean, minimal aesthetic.
- **Main nav sidebar bounds:** 160px min / 320px max. 160px keeps nav labels readable; 320px is the natural upper limit before the sidebar dominates.
- **Detail panel bounds:** 240px min / 50% of container width max. 240px keeps form fields readable; 50% cap ensures main content always gets at least half the space.

## Deferred Ideas

None — discussion stayed within phase scope.
