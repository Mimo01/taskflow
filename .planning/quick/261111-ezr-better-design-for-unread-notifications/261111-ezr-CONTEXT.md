# Quick Task 261111-ezr: Better design for unread notifications - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning

<domain>
## Task Boundary

Restyle the read/unread distinction on notification cards (taskflow/src/routes/notifications/NotificationRow.tsx). Only the unread vs read visual treatment changes; card structure, line grammar, tray, and list behaviour stay as they are.

</domain>

<decisions>
## Implementation Decisions

### What's wrong today (user)
- Too subtle: ring-foreground/20 vs /10 + 6px dot barely register.
- The 6px dot in the left padding looks off.

### Chosen direction: Tinted card
- Unread card: faint primary-tinted surface (≈ color-mix primary 5% into card) + primary ring (≈ ring-primary/30). Must read clearly in BOTH light and dark themes.
- Read card: unchanged plain card (bg-card ring-1 ring-foreground/10).
- REMOVE the unread dot entirely (the span with data-unread). Drop the extra left padding that only existed for the dot slot so left padding matches right padding at every density (default/compact/comfortable).
- Keep unread title semibold foreground / read title normal muted (user did not object).
- Hover/focus on unread must keep the tint (hover = accent mixed into the TINTED surface, not plain card), and the hover tray's background (--card-hover) must match the hovered card so the tray fade has no seam.
- Still: read vs unread changes only class strings / aria prefix, never the DOM tree (D-05) — except the dot span removal, which applies to both states.
- Update the STYLE CONTRACT comment (A and H) in NotificationRow.tsx to match.

### Claude's Discretion
- Exact tint/ring percentages (verify contrast visually in light and dark).

</decisions>

<specifics>
## Specific Ideas

ASCII chosen by user:
┌──────────────────────────────────────┐  ← primary/30 ring
│  (av) PROJ-12  Fix login…        2m │  ← bg primary/5
│       Cara commented  "looks good"   │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐  ← foreground/10 ring
│  (av) PROJ-9   Update docs       1h │  ← bg-card
│       Ben changed status  To Do→Done │
└──────────────────────────────────────┘

Tests that assert the dot (data-unread) must be updated to assert the card-level unread styling (data-unread-card) instead.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above
</canonical_refs>

## Amendment (after planning) — tint colour LOCKED
The app's --primary is neutral grey (oklch 0.205 / 0.922, chroma 0), so a "primary" tint would be a grey shade.
User chose **soft blue**: unread card = blue-500 at ~6% mixed into the card surface + ring-blue-500/30 (tune for dark mode so it is clearly visible but calm). Do NOT use --primary for the tint or ring. Read cards unchanged.
