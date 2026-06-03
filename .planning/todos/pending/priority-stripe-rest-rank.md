---
type: todo
status: pending
created: 2026-06-03
origin: phase-76 (76-04 checkpoint)
priority: medium
---

# Priority stripe: color by Jira priority-scheme rank (REST /priority)

Phase 76 colors the sprint-board priority stripe by **icon severity** (the priority
icon filename). This works for custom schemes but has a hard limit: priorities that
share an icon (e.g. `Critical` and `Should`, both `highest.svg`) get the same color
and cannot be distinguished.

**Proper fix:** fetch the instance's priority scheme via `GET /rest/api/2/priority`,
which returns priorities in admin **rank order**, each with a configured
`statusColor`. Then either:
- color the stripe by rank position on a graduated ramp, or
- use each priority's own `statusColor` (inline style) — note WCAG contrast is then
  not guaranteed and would need a min-contrast clamp.

Requires: a new cached fetch (react-query, like the other GH entity fetches), a
rank/color map, and wiring through to `priorityStripeClass` / TaskCard. Replaces the
icon-severity heuristic in `taskflow/src/lib/issueDisplayUtils.ts`.

Also revisit: Medium currently uses a bright `yellow-500` (1.92:1 in light, below the
3:1 floor) — a deliberate UX trade-off. A rank/color approach could pick a per-theme
shade that is both vivid and legible.
