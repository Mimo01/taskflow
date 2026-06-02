# Phase 76: Visual Polish and Shared Primitives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 76-Visual Polish and Shared Primitives
**Areas discussed:** Priority color palette, Done treatment depth, Standup Today done items, Rank primitive scope

---

## Priority Color Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Warm→cool ramp | Highest=red, High=orange, Medium=amber, Low=blue, Lowest=slate | |
| Red→gray severity | Highest=red, High=orange, Medium=yellow, Low=gray, Lowest=lighter gray | ✓ |
| Match Jira icon colors | Mirror Jira's own priority icon colors | |

**User's choice:** Red→gray severity ramp
**Notes:** Exact Tailwind shades to be tuned per-theme to satisfy WCAG ≥ 3:1 vs `bg-card` (flagged that `gray-300` on near-white surface won't pass in light mode).

### No-priority handling

| Option | Description | Selected |
|--------|-------------|----------|
| No stripe | Cards without priority show no stripe | |
| Neutral gray stripe | Muted gray stripe; gray = unset | ✓ |
| Transparent placeholder | Reserve width, transparent | |

**User's choice:** Neutral gray stripe

---

## Done Treatment Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Strike + dim whole row | line-through summary + opacity dim | |
| Strike summary only | line-through summary, full opacity | |
| Match kanban exactly | strike issue key only | ✓ |

**User's choice:** Match kanban exactly → clarified to **truly key-only** (strike issue key, summary stays normal)
**Notes:** Clarification round raised the tension between "key-only" and the `doneSummaryClass` name + "struck-through stories" criteria; user confirmed truly key-only for maximal kanban consistency. `isDoneStatus` = `statusCategory.key === 'done'`.

---

## Standup Today Done Items

| Option | Description | Selected |
|--------|-------------|----------|
| Style-only, no new rows | Strike only if a done item already surfaces in Today | ✓ |
| Add a Done subsection | New "Done/Completed today" list in Today column | |

**User's choice:** Style-only, no new rows
**Notes:** Avoids scope creep; a Done subsection deferred as a possible future feature.

---

## Rank Primitive Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pure calc + persisted key | Pure tested midpoint calc + rankFieldKey persisted | ✓ (Claude's decision) |
| Thin placeholder | Stub implementation only | |
| Full service w/ API | Compute + call Jira rank API now | |

**User's choice:** Delegated to Claude → chose Pure calc + persisted key.
**rankFieldKey source:** User directed Claude to verify against the existing probe JSON. Confirmed `rankCustomFieldId: 10105` in `data.real.json` → `rankFieldKey = customfield_10105`, sourced from the GreenHopper backlog response (not per-issue fields). Decision: persist when discovered.

## Claude's Discretion

- Rank primitive scope and `rankFieldKey` population strategy (delegated by user).
- Exact stripe render mechanism (border vs pseudo-element vs inline element), constrained by WCAG ≥ 3:1.

## Deferred Ideas

- Standup "Done / Completed today" subsection (new capability) — future phase.
- Drag-to-rank UI + Jira rank-API persistence — already roadmapped as Backlog Drag-to-Rank phase; consumes this phase's primitives.
