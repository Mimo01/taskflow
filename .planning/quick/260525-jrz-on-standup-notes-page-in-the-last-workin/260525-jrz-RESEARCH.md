# Quick Task 260525-jrz: Standup Empty States — Research

**Researched:** 2026-05-25
**Domain:** React/Tailwind UI — YesterdayColumn empty-state rendering

---

## Summary

The YesterdayColumn in `StandupNotesPage` renders up to 4 per-source empty states (Tempo worklogs, Jira activity, commits, MR activity) using the shared `EmptyState` component. Each empty state is a tall centered block: `py-8`, a `size-12` icon, `text-base` title, and `text-sm` subtitle — totalling roughly 140–160px of vertical space per section. When all 4 fire together (e.g., last Friday was a day off and all APIs return empty), the column fills with ~600px of stacked "No X on Friday" cards, which dominates the column and feels out of proportion to actual content.

**Primary recommendation:** Replace the per-source `<EmptyState>` blocks in `YesterdayColumn` with a compact inline variant that renders as a tight horizontal pill/row. When 2+ of the 4 sources are all empty, they should flow side-by-side (CSS grid or flex-wrap) so the total vertical footprint stays under ~80px regardless of how many fire.

---

## Current Empty State Anatomy

### EmptyState component — `src/components/ui/empty-state.tsx`

```tsx
<div className="flex flex-col items-center justify-center py-8 text-center">
  <Icon className="size-12 text-muted-foreground mb-4" />
  <p className="text-base font-medium text-foreground">{title}</p>
  {subtitle && <p className="mt-1 text-sm text-muted-foreground max-w-xs">{subtitle}</p>}
</div>
```

Key sizing facts:
- `py-8` = 32px padding top+bottom (64px total vertical padding)
- `size-12` icon = 48px
- `text-base` title (~20px line-height)
- `text-sm` subtitle
- Total per empty state: ~160px height, full column width

### Where empty states render in YesterdayColumn

Four independent blocks (lines 488–574 of `YesterdayColumn.tsx`), each wrapped in `<div className="mb-3">`:

1. **Tempo disabled:** plain `<p className="text-xs text-muted-foreground mb-3">` (already small — not a problem)
2. **Tempo empty:** `<EmptyState icon={Clock} title="No worklogs on Friday" subtitle="No time was logged on 2026-05-23 in Tempo." />`
3. **Jira empty:** `<EmptyState icon={MessageSquare} title="No Jira activity on Friday" subtitle="No status transitions or comments were found for 2026-05-23." />`
4. **Commits empty:** `<EmptyState icon={GitBranch} title="No commits on Friday" subtitle="No commits were authored by you on 2026-05-23." />`
5. **MR activity empty:** `<EmptyState icon={MessageSquare} title="No MR activity on Friday" subtitle="No comments or approvals were recorded for 2026-05-23." />`

Note: The Tempo-disabled state is already `text-xs` inline text — it is fine.

### Full-column empty state (already fine)

When ALL sources are empty, there is ONE full `<EmptyState icon={Clock} title="Nothing to recap" .../>` shown. That single centered card IS appropriate. The issue is the 4× stacked per-source empties that show alongside partial data (e.g., there IS data but one source is empty).

---

## Approach Options

### Option A: Compact inline rows (recommended)

Create a `CompactEmptyNotice` component that replaces `EmptyState` for per-source notices inside `YesterdayColumn`. Format: small icon + short label in a single horizontal line.

```tsx
// Inline, 1-line, minimal vertical footprint
<div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
  <Icon className="size-3.5 shrink-0" />
  <span>No Jira activity on Friday</span>
</div>
```

Group them in a `flex flex-wrap gap-x-4 gap-y-1` container so they flow side-by-side at normal widths and wrap gracefully when the column is narrow.

```tsx
<div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
  {/* each CompactEmptyNotice */}
</div>
```

This yields ~24px total height for all 4 notices, vs ~640px for 4 stacked EmptyState components.

### Option B: Single merged notice (simpler, less informative)

Collect all empty-source names into one sentence: "No Jira activity, commits, or MR events on Friday." — but this loses the icon differentiation and is harder to parse.

**Recommendation:** Option A. It preserves per-source signal (icon + label), eliminates the visual weight problem, and is responsive by default (flex-wrap handles narrow widths).

---

## Implementation Plan

### What to change

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx`

1. Add a local `CompactEmptyNotice` component (no new file needed — private to YesterdayColumn):

```tsx
function CompactEmptyNotice({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
```

2. Collect the zero-result notices into a single `<div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 mb-2">` container instead of individual `<div className="mb-3"><EmptyState .../></div>` blocks.

3. The existing `EmptyState` import can stay — it's still used for the full-column "Nothing to recap" state.

### What NOT to change

- Tempo-disabled inline text (`text-xs text-muted-foreground`) — already compact, leave as-is.
- Error states — use `ErrorState` component, not `EmptyState`; keep as-is.
- Loading skeletons — leave as-is.
- Full-column empty state (when `!hasAnyData`) — keep the centered `EmptyState` with large icon; that case is intentional.
- `TodayColumn` — task is specifically about the last working day (Yesterday) section.

---

## Responsive Considerations

- The YesterdayColumn is always `w-1/2` of the standup page body — there are no breakpoint changes at the column level.
- The standup page itself uses fixed 50/50 split with no responsive override — there is no breakpoint where YesterdayColumn becomes full-width.
- Tailwind v4 is in use (`@import "tailwindcss"` in `index.css`) — standard Tailwind breakpoints apply (sm: 640px, md: 768px, etc.).
- `flex-wrap` on the notices container handles the case where column width is constrained (e.g., window resized to minimum). Four notices in a single row need roughly 500px; at narrower widths they wrap gracefully to 2×2 or 4×1.
- No custom breakpoints defined in this project — default Tailwind v4 breakpoints confirmed.

---

## Pitfalls

- **Do not remove the per-source messages entirely.** Users need to know WHY there is no data (e.g., "did Jira fail or just have no activity?"). The compact form preserves this.
- **Keep the full-column EmptyState untouched** — it appears only when `!hasAnyData` and all queries resolved, so it's the correct heavy treatment for a genuinely empty column.
- **Subtitle text in the compact form** — drop the subtitle (it's verbose for an inline notice). The icon + short title like "No commits on Friday" is sufficient. If additional context is needed the user can infer from the date label in the column header.

---

## Sources

- `[VERIFIED]` `YesterdayColumn.tsx` — direct code read, lines 488–576
- `[VERIFIED]` `empty-state.tsx` — direct code read
- `[VERIFIED]` `index.css` — Tailwind v4 confirmed via `@import "tailwindcss"`
- `[ASSUMED]` Tailwind v4 default breakpoints (sm/md/lg/xl) — consistent with Tailwind v4 docs; no custom overrides found in project CSS
