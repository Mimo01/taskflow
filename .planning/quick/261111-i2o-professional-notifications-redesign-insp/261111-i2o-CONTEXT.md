# Quick Task 261111-i2o: Professional notifications redesign inspired by macOS - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Task Boundary

Redesign the notifications experience (the bell popover in TopBar: `taskflow/src/routes/notifications/*`) to feel like a professional, native-grade notification centre. Take inspiration from macOS Notification Center and apps that already do this well. Scope covers the rows/cards, the popover shell (header, filters, sizing, empty states), and the new behaviours listed below.

User's words: "We have recently redone notifications in app. It is better but not quite right. I want you to look into it and design professional notifications. Get inspired by macOS and apps that already have this functionality."

</domain>

<decisions>
## Implementation Decisions

### What's wrong today (all four confirmed by user)
- **Looks amateur/busy:** too many competing colours, rings, halos and weights. The redesign must cut visual noise.
- **Hard to scan:** at a glance it's unclear who/what/where and what needs action. Fix the hierarchy.
- **Popover shell/chrome:** the header, filter tabs, sizing and empty states feel clunky, not just the rows.
- **Missing behaviour:** see Behaviours.

### Fidelity: macOS-inspired
- Borrow the macOS Notification Center anatomy:
  - bold title;
  - secondary line;
  - time at top-right;
  - hover ✕ and actions;
  - soft rounded cards.
- Keep the taskflow palette and tokens. Use no translucent vibrancy material and no new accent colour; colour comes only from the existing per-event colours (see prior feedback).

### Stacking: macOS stacks (USER OVERRIDES the earlier "no grouping" rule for this redesign)
- When an issue or MR has 2+ notifications (read or unread), they collapse into one stack.
- The newest card sits on top, with 1–2 peek edges visible behind it and a "+N" count.
- Clicking expands the stack in place.
- The existing system merge (same actor+entity, ≤60m) may stay as-is, or be subsumed by stacks at the planner's discretion.

### Behaviours to add
- **Hover ✕ + actions:** on hover, a round ✕ (clear/done) appears at the card corner, plus a compact action cluster: mark read/unread and open in browser.
- **Stack controls:** an expanded stack shows a macOS-style header with "Show less" and "Clear" (clears the whole stack).
- **Inline quick actions:** context buttons on the card, for example "Reply" on comments and "Review" on MR review requests. Each action must map to something the app can already do: navigate to the comment composer or open the MR. Do not invent new backend APIs.
- NOT in scope: snooze.

### Process: render 3 directions first
- After research, render 3 distinct macOS-inspired directions as light + dark screenshots, using a throwaway vite preview harness seeded with varied, realistic placeholder data.
- The user picks one before the real build. This is a human checkpoint in the plan.
- Check dark mode in the screenshots: the earlier h9a dark screenshots rendered white cards with invisible text (a harness theming bug). The harness must apply the dark theme correctly.

### Claude's Discretion
- Exact typography, spacing, radius, peek-edge geometry and animation (respect reduced-motion).
- Whether source filters stay as tabs or become something lighter.
- Keyboard triage keeps working (existing NotificationList keyboard support).

</decisions>

<specifics>
## Specific Ideas / Constraints from prior UAT (still binding unless contradicted above)

- Two-line content model: line 1 = key + parent › title + time; line 2 = coloured action + details. Restyling the hierarchy (bold title, muted secondary) is allowed.
- Read notifications are never greyed or dimmed.
- Unread shows a clear but non-garish signal. Neutral border plus an event-colour avatar halo is the current approved state. A calmer macOS-like signal may replace it if the user approves it in the direction pick.
- No drop shadows or glows "not consistent with the app". Peek edges for stacks may need subtle layering; show it in the previews.
- No customer data: placeholders only in fixtures and screenshots.
- GitLab system notes render as changes, never as "commented".
- Use the shared PersonPicker, Card and EmptyState primitives where relevant.

</specifics>

<canonical_refs>
## Canonical References

- Memory: feedback_notification_row_title_first.md (history of 12 rounds of notification UAT)
- `.planning/quick/261111-h9a-*/261111-h9a-SUMMARY.md` (current approved state)
- Phase 95 plans in `.planning/phases/95-*`

</canonical_refs>
