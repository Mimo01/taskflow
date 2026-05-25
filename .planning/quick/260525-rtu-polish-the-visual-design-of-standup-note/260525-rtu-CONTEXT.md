# Quick Task 260525-rtu: Polish Standup Notes Visual Design - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Task Boundary

Polish the visual design of the standup notes page to be cleaner, sleeker, and match the rest of the app. All existing functionality must be preserved.

Files in scope:
- `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — layout shell
- `taskflow/src/routes/standup-notes/StandupPageHeader.tsx` — page header
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — left column
- `taskflow/src/routes/standup-notes/TodayColumn.tsx` — right column
- `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` — section
- `taskflow/src/routes/standup-notes/TodayUpNextSection.tsx` — section
- `taskflow/src/routes/standup-notes/TodayMrsSection.tsx` — section
- `taskflow/src/routes/standup-notes/TodayParticipatingSection.tsx` — section
- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — Yesterday rows
- `taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx` — Yesterday MR rows

</domain>

<decisions>
## Implementation Decisions

### Column layout & balance
- Keep the border-r divider between Yesterday and Today columns
- Add `bg-muted/30` background tint to the **Today column** to make it feel subtly inset/contained
- Yesterday column stays on the default background (bright side)

### Section headers (Today column: IN PROGRESS, UP NEXT, MRS AWAITING YOU, PARTICIPATING)
- Add a `border-t border-border` separator line above each section header (except the first section)
- Keep text-xs uppercase small-caps label, keep muted foreground color
- Add a numeric count badge next to the label when section has items (e.g. "IN PROGRESS · 3")
- Badge uses the same muted style as the existing chip pattern (bg-muted px-1.5 rounded text-xs)

### Yesterday issue groups (IssueActivityGroup, StandaloneMrGroup)
- Each issue group gets a rounded card treatment: `rounded-lg border border-border bg-card` wrapper with `mb-2` spacing between groups
- Replace the outer `divide-y divide-border` in YesterdayColumn with `flex flex-col gap-2`
- The sub-items list inside each group keeps its `divide-y divide-border` (internal to the card)
- Subtle visual elevation: no shadow needed (flat card with border is consistent with app cards)

### Claude's Discretion
- Header (StandupPageHeader): can improve the overall header refinement if there are obvious gains — keep current structure but ensure it looks polished
- CompactEmptyNotice in YesterdayColumn: can be subtly improved for visual consistency
- Overall: prioritize coherence with the app's existing design language (shadcn/ui card patterns, muted tones, thin borders)

</decisions>

<specifics>
## Specific Ideas

- `bg-muted/30` or `bg-muted/20` for Today column — pick whichever is more subtle in Tailwind
- Today column: the `px-6 py-4` wrapper currently has no background; add `bg-muted/30` to the wrapper div in StandupNotesPage.tsx
- Section count badge: use `· {count}` inline suffix or a small `<span className="...">` badge — match the existing IssueActivityGroup chip style
- Yesterday cards: `rounded-lg border border-border` on each IssueActivityGroup root div; remove outer `divide-y` container

</specifics>

<canonical_refs>
## Canonical References

- App card pattern: `rounded-lg border border-border bg-card` (used in dashboard cards)
- Chip pattern: `rounded bg-muted px-2 py-1 text-xs text-muted-foreground` (used in IssueActivityGroup time chips)
- Section header pattern: `text-xs text-muted-foreground uppercase tracking-wide mb-2` (current)
</canonical_refs>
