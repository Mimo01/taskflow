# Quick Task 260525-rtu: Standup Notes Visual Polish - Research

**Researched:** 2026-05-25
**Domain:** Tailwind CSS / React component styling
**Confidence:** HIGH (full source audit — no external lookups needed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep border-r divider between Yesterday and Today columns
- Today column: add `bg-muted/30` background tint to make it feel subtly inset/contained
- Yesterday column: stays on default background
- Section headers (IN PROGRESS, UP NEXT, MRS AWAITING YOU, PARTICIPATING): add `border-t border-border` above each header except first section; keep text-xs uppercase muted style; add numeric count badge `· N` using `bg-muted px-1.5 rounded text-xs`
- Yesterday issue groups: `rounded-lg border border-border bg-card` wrapper with `mb-2` spacing; replace outer `divide-y divide-border` with `flex flex-col gap-2`; internal sub-item list keeps `divide-y divide-border`

### Claude's Discretion
- Header (StandupPageHeader): polish if obvious gains exist, keep structure
- CompactEmptyNotice: can be subtly improved for visual consistency
- Prioritize coherence with shadcn/ui card patterns, muted tones, thin borders
</user_constraints>

---

## Current State Audit

### StandupNotesPage.tsx — Column Wrappers

| Location | Current classes | Problem |
|----------|-----------------|---------|
| Line 346 (Yesterday wrapper) | `w-1/2 overflow-auto border-r border-border px-6 py-4` | Fine — no change needed |
| Line 362 (Today wrapper) | `w-1/2 overflow-auto` | Missing `bg-muted/30`; padding lives inside TodayColumn, not here |

**Note:** The Today column's `px-6 py-4` padding is on TodayColumn's root div (line 341 of TodayColumn.tsx: `flex flex-col h-full px-6 py-4`), not on the wrapper in StandupNotesPage. Adding `bg-muted/30` must go on the wrapper div in StandupNotesPage (line 362), which is the full-height container. This is the correct placement — it will fill the entire right column height.

### YesterdayColumn.tsx — Issue Group Container

| Location | Current classes | Problem |
|----------|-----------------|---------|
| Line 479 | `divide-y divide-border` on the wrapping `<div>` | Must become `flex flex-col gap-2` |
| IssueActivityGroup root (IssueActivityGroup.tsx line 89) | `<div className="py-2">` | Needs `rounded-lg border border-border bg-card p-2` card treatment |
| StandaloneMrGroup root (StandaloneMrGroup.tsx line 61) | `<div className="py-2">` | Same card treatment |

**Constraint:** The `divide-y divide-border` inside each group's sub-item list (IssueActivityGroup line 108, StandaloneMrGroup line 78) must be **kept** — only the outer container switches to gap-2.

### Today Column — Section Headers

Each section component has an `<h3>` with `text-xs text-muted-foreground uppercase tracking-wide mb-2` and a `<div className="mb-6">` wrapper.

| File | Line | Header text | Has count already? |
|------|------|-------------|-------------------|
| TodayInProgressSection.tsx | 213 | `IN PROGRESS` | No |
| TodayUpNextSection.tsx | 207 | `UP NEXT` | No |
| TodayMrsSection.tsx | 66 | `MRS AWAITING YOU` | No |
| TodayParticipatingSection.tsx | 60-61 | Already dynamic: `PARTICIPATING (N)` or `PARTICIPATING` | Partial — inline in text, not a badge |

The count is always derivable at render time — `rows.length` for InProgress/UpNext, `items.length` for Mrs/Participating. No new props needed.

**Border-t placement:** The `border-t border-border` should go on the `<div className="mb-6">` wrapper — but only for sections 2, 3, 4 (not section 1). Since sections conditionally return `null` when empty, the "first section" question is dynamic. The cleanest approach: add `border-t border-border pt-4` to the `mb-6` wrapper of sections 2–4, and remove `pt-4` only on section 1. The `mb-6` becomes `mb-6 border-t border-border pt-4` for UpNext/Mrs/Participating. InProgress keeps `mb-6` unchanged (no top border on first section).

**Alternative risk:** If InProgress is empty and returns null, UpNext becomes the first rendered section and would show a top border at the very top of the column — slightly awkward. Acceptable given the design decision accepts this; flagging it for planner awareness.

### TodayParticipatingSection.tsx — Count Badge Pattern

Current (line 60-61):
```tsx
const header = items.length > 0 ? `PARTICIPATING (${items.length})` : 'PARTICIPATING';
```
This embeds the count in the label string with parens. Decision requires migrating to inline badge `<span>` style matching the chip pattern. This is in-scope to standardize across all four sections.

### StandupPageHeader.tsx — Discretion Area

Current (line 38): `px-6 py-4 border-b border-border flex items-center justify-between`

The header is already clean and consistent with the MergeRequestListPage header pattern. The one optional improvement: MergeRequestListPage uses `flex-shrink-0` on its header — the standup header doesn't need it because it lives inside a `flex flex-col h-full` where the two-column body has `flex-1 min-h-0`. No change required; header is already polished.

### CompactEmptyNotice in YesterdayColumn.tsx — Discretion Area

Current (line 371): `flex flex-col items-center gap-2 rounded-lg bg-muted/40 px-4 py-3 text-center text-muted-foreground`

The `bg-muted/40` is slightly heavier than the card style. With the new card treatment on issue groups, the empty notices will now have visual contrast. Minor improvement: change `bg-muted/40` to `bg-muted/30` for consistency with the Today column tint, and reduce icon size from `size-7` to `size-5` so it reads as a subtle inline notice rather than a prominent empty-state icon. These are discretion-area changes — only apply if they look right.

---

## App Pattern Reference (from Dashboard files)

### Card pattern (DashboardInProgressCard.tsx line 103)
```tsx
className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]"
```
For Yesterday issue groups, use a simpler version: `rounded-lg border border-border bg-card` with existing internal padding via sub-components. Add `overflow-hidden` to prevent internal border-radius bleed.

### Section header pattern (DashboardInProgressCard.tsx line 107)
```tsx
<span className="text-xs text-muted-foreground uppercase tracking-wide">
```
Today sections already match this.

### Chip/badge pattern (DashboardInProgressCard.tsx line 127, IssueActivityGroup.tsx line 100)
```tsx
className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
```
The CONTEXT.md specifies `px-1.5` for count badges (slightly tighter than the time chip `px-2`). Use `rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground` for count badges to distinguish them visually from value chips.

### Hover row pattern (consistent across all files)
```tsx
className="hover:bg-muted/50"
```
All interactive rows already use this — no change.

---

## Change Surface: File-by-File

### 1. StandupNotesPage.tsx

**Line 362** — Today column wrapper:
- Before: `className="w-1/2 overflow-auto"`
- After: `className="w-1/2 overflow-auto bg-muted/30"`

**Risk:** None. Adding a background color to a container div only affects visual rendering.

---

### 2. YesterdayColumn.tsx

**Line 479** — Outer group container:
- Before: `<div className="divide-y divide-border">`
- After: `<div className="flex flex-col gap-2">`

**Risk:** The `divide-y divide-border` between groups disappears — this is intentional (cards provide visual separation). The internal `divide-y` inside each group card is unaffected.

---

### 3. IssueActivityGroup.tsx

**Line 89** — Root `<div className="py-2">`:
- Before: `<div className="py-2">`
- After: `<div className="rounded-lg border border-border bg-card overflow-hidden">`

The internal `py-2` on the group header button (line 94 in `className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"`) provides adequate spacing inside the card. No extra padding wrapper needed.

**Risk:** The `rounded` on the inner button combined with `overflow-hidden` on the card will clip hover states to the card boundary — this is correct behaviour. The `focus-visible:ring-2` on inner buttons may be clipped at card edge; `overflow-hidden` is standard for card containers.

---

### 4. StandaloneMrGroup.tsx

**Line 61** — Root `<div className="py-2">`:
- Before: `<div className="py-2">`
- After: `<div className="rounded-lg border border-border bg-card overflow-hidden">`

Same reasoning as IssueActivityGroup.

---

### 5. TodayInProgressSection.tsx

**Line 212** — Section wrapper:
- Before: `<div className="mb-6">`
- After: `<div className="mb-4">` (tighten slightly — 6 is wide with cards)

**Line 213** — Header row, add count badge:
- Before: `<h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">IN PROGRESS</h3>`
- After:
```tsx
<div className="flex items-center gap-2 mb-2">
  <h3 className="text-xs text-muted-foreground uppercase tracking-wide">IN PROGRESS</h3>
  {rows.length > 0 && (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {rows.length}
    </span>
  )}
</div>
```

No `border-t` on InProgress (it is the first section).

**Note:** `rows` is already in scope as a prop.

---

### 6. TodayUpNextSection.tsx

**Line 206** — Section wrapper:
- Before: `<div className="mb-6">`
- After: `<div className="mb-4 border-t border-border pt-4">`

**Line 207** — Header, add count badge:
- Before: `<h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">UP NEXT</h3>`
- After:
```tsx
<div className="flex items-center gap-2 mb-2">
  <h3 className="text-xs text-muted-foreground uppercase tracking-wide">UP NEXT</h3>
  {rows.length > 0 && (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {rows.length}
    </span>
  )}
</div>
```

---

### 7. TodayMrsSection.tsx

**Line 65** — Section wrapper:
- Before: `<div className="mb-6">`
- After: `<div className="mb-4 border-t border-border pt-4">`

**Lines 66-68** — Header, add count badge:
- Before:
```tsx
<h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
  MRS AWAITING YOU
</h3>
```
- After:
```tsx
<div className="flex items-center gap-2 mb-2">
  <h3 className="text-xs text-muted-foreground uppercase tracking-wide">MRS AWAITING YOU</h3>
  {items.length > 0 && (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {items.length}
    </span>
  )}
</div>
```

---

### 8. TodayParticipatingSection.tsx

**Line 63** — Section wrapper:
- Before: `<div className="mb-6">`
- After: `<div className="mb-4 border-t border-border pt-4">`

**Lines 59-65** — Replace dynamic string with badge pattern:
- Before:
```tsx
const header = items.length > 0 ? `PARTICIPATING (${items.length})` : 'PARTICIPATING';
// ...
<h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
  {header}
</h3>
```
- After (remove `header` variable entirely):
```tsx
<div className="flex items-center gap-2 mb-2">
  <h3 className="text-xs text-muted-foreground uppercase tracking-wide">PARTICIPATING</h3>
  {items.length > 0 && (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {items.length}
    </span>
  )}
</div>
```

---

## Risks and Structural Notes

| Risk | Severity | Mitigation |
|------|----------|------------|
| `overflow-hidden` on card clips `focus-visible:ring-2` on inner buttons | Low | Ring appears inside card; still accessible. App-wide pattern (DashboardInProgressCard also uses this pattern without issue) |
| UpNext border-t shows at column top when InProgress returns null | Low | Acceptable per design decision; only shows when there's no in-progress work |
| `bg-muted/30` Today column: Tailwind may not generate this class if it's not in the purge scan | None | `bg-muted/20` is already used in CompactEmptyNotice `bg-muted/40`; arbitrary opacity modifiers are generated on-demand in Tailwind v3+ |
| Removing `mb-6` → `mb-4` on section wrappers is discretion change | Low | Tighter spacing looks better with card borders providing visual separation; easy to revert |

---

## No-Change Zones

These must not be altered:
- All `divide-y divide-border` inside card bodies (IssueActivityGroup line 108, StandaloneMrGroup line 78)
- All `hover:bg-muted/50` on interactive rows
- YesterdayColumn `border-r border-border` on Yesterday wrapper (in StandupNotesPage)
- TodayColumn inner layout (`flex flex-col h-full px-6 py-4`) — background comes from the wrapper in StandupNotesPage, not inside TodayColumn
- All query logic, markdown generation, and click handlers — zero business logic changes

---

## Summary of All Edits

| File | Lines Changed | Change Type |
|------|--------------|-------------|
| StandupNotesPage.tsx | 362 | Add `bg-muted/30` to Today wrapper |
| YesterdayColumn.tsx | 479 | `divide-y divide-border` → `flex flex-col gap-2` |
| IssueActivityGroup.tsx | 89 | `py-2` → `rounded-lg border border-border bg-card overflow-hidden` |
| StandaloneMrGroup.tsx | 61 | Same as IssueActivityGroup |
| TodayInProgressSection.tsx | 212-213 | Wrapper tighten + header → flex row with count badge |
| TodayUpNextSection.tsx | 206-207 | Wrapper + border-t + header badge |
| TodayMrsSection.tsx | 65-68 | Wrapper + border-t + header badge |
| TodayParticipatingSection.tsx | 59-65 | Wrapper + border-t + badge (replace string interpolation) |

**Total: 8 files, all changes are class string edits plus minor JSX restructuring of header elements. No new imports, no new props, no logic changes.**
