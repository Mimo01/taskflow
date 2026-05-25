# Quick Task 260525-kfi: Unify Yesterday/Today Views - Research

**Researched:** 2026-05-25
**Domain:** React / Tailwind CSS — standup-notes UI restyling
**Confidence:** HIGH (pure codebase analysis, no external dependencies)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- No section labels added to Yesterday — keep the flat joined list, just restyle item rows.
- Sub-items in `IssueActivityGroup` → indented rows using `pl-6 border-l border-border ml-2`.
- Keep the stat line ("Xh logged · Y commits · Z MR events"). Restyle to `text-xs text-muted-foreground` if not already matching.

### Claude's Discretion
- IssueActivityGroup header row: restyle to match Today's IssueRow — `hover:bg-muted/50`, issue type icon, monospace key, truncated summary, time chip right-aligned.
- StandaloneMrGroup and OtherCommitsGroup: align with Today's MR row style (GitBranch icon, monospace iid, truncated title).
- Compact empty notices and loading skeletons in Yesterday: keep current placement, ensure visual match with Today's treatment.

### Deferred Ideas (OUT OF SCOPE)
_(none listed)_
</user_constraints>

---

## Summary

The Yesterday and Today columns share the same overall two-column shell but their item rendering is visually divergent. Today uses `divide-y divide-border` containers with `px-2 py-2` row padding, monospace issue keys, time chips via `rounded bg-muted px-2 py-1 text-xs text-muted-foreground`, and indented nested rows via `pl-6 border-l border-border ml-2`. Yesterday's `IssueActivityGroup` uses a tighter `py-0.5` header with `-mx-1 px-1` padding offset, `pl-8` indent for sub-items (plain `<li>` list, not indented `div` rows), and `font-semibold` on the header rather than normal weight. `StandaloneMrGroup` and `OtherCommitsGroup` have plain non-interactive headers with a similar `pl-8` list sub-item pattern.

All three Yesterday components (`IssueActivityGroup`, `StandaloneMrGroup`, `OtherCommitsGroup`) are used exclusively by `YesterdayColumn.tsx`. Zero risk of regressions in other parts of the codebase. [VERIFIED: codebase grep]

**Primary recommendation:** Restyle all three Yesterday components to use Today's exact row and indent patterns — the changes are self-contained to three files.

---

## Visual Diff: Yesterday vs Today [VERIFIED: codebase grep]

### IssueActivityGroup header vs Today's IssueRow

| Property | Yesterday (`IssueActivityGroup`) | Today (`IssueRow` in TodayInProgressSection) |
|----------|-----------------------------------|----------------------------------------------|
| Wrapper padding | `-mx-1 px-1 py-0.5` | `px-2 py-2` |
| Font weight | `font-semibold` | normal (no bold) |
| Key style | `text-xs font-medium text-muted-foreground` (NOT monospace) | `text-xs text-muted-foreground font-mono shrink-0` |
| Time chip | `text-xs text-muted-foreground ml-auto shrink-0` (plain text) | `rounded bg-muted px-2 py-1 text-xs text-muted-foreground` (chip) |
| Hover state | `hover:bg-muted/50` (present) | `hover:bg-muted/50` (present) |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-ring` (present) | `focus-visible:ring-2 focus-visible:ring-ring` (present) |
| Element type | `<button type="button">` | `<div role="button" tabIndex={0}>` |

### Sub-item layout

| Property | Yesterday | Today (nested subtask/MR) |
|----------|-----------|--------------------------|
| Container | `<ul className="mt-1 flex flex-col gap-1 pl-8">` | `<div className="pl-6 border-l border-border ml-2">` wrapping a `flex items-center gap-2 py-2 px-2` div |
| Sub-item element | `<li className="flex items-start gap-1.5 text-xs text-foreground">` | `flex items-center gap-2 py-2 px-2` |
| Icon size | `size-3 mt-0.5 text-muted-foreground` | `size-4 shrink-0 text-muted-foreground` |
| Text | `text-xs text-foreground` | `text-xs text-muted-foreground` for key (monospace), `text-sm` for title |
| Container divider | none | `divide-y divide-border` on parent |

### StandaloneMrGroup header

| Property | Yesterday | Today's MR rows (TodayMrsSection, TodayParticipatingSection) |
|----------|-----------|-------------------------------------------------------------|
| Container | `<div className="flex items-center gap-2 text-sm font-semibold">` | `<div className="flex items-center gap-2 py-2 px-2">` |
| iid key | `<span className="text-muted-foreground font-mono mr-1">!{iid}</span>` | `<span className="text-xs text-muted-foreground font-mono shrink-0">!{iid}</span>` |
| Padding | none | `py-2 px-2` |
| Interactivity | non-interactive div | non-interactive div (matches) |

### OtherCommitsGroup header

| Property | Yesterday | Equivalent Today pattern |
|----------|-----------|--------------------------|
| Header | `text-sm font-semibold text-muted-foreground italic` | No direct equivalent — this is a catch-all section |
| Sub-item | Same `pl-8` list pattern as IssueActivityGroup | Should match Today's plain MR row style |

---

## Exact Target Patterns to Apply [VERIFIED: codebase grep]

### 1. IssueActivityGroup header → match Today's IssueRow

```tsx
// TODAY'S PATTERN (from TodayInProgressSection.tsx IssueRow):
<div
  role="button"
  tabIndex={0}
  className="w-full flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
  onClick={onClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
>
  <IssueTypeIcon typeName={issueType ?? ''} className="size-4 shrink-0" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">{issueKey}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{summary}</span>
  {totalSeconds > 0 && (
    <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
      {formatDuration(totalSeconds)}
    </span>
  )}
</div>
```

Changes from current: `py-0.5 px-1 -mx-1` → `py-2 px-2`; drop `font-semibold`; add `font-mono` to key span; wrap time in chip span; keep `hover:bg-muted/50` and focus ring (already present).

Note: the element type can stay as `<button>` — Today uses `<div role="button">` but both are valid patterns. No need to change element type unless desired for consistency.

### 2. IssueActivityGroup sub-items → match Today's NestedMrRow

```tsx
// TODAY'S PATTERN (from TodayInProgressSection.tsx NestedMrRow):
<div className="pl-6 border-l border-border ml-2">
  <div className="flex items-center gap-2 py-2 px-2">
    <Icon className="size-4 shrink-0 text-muted-foreground" />
    <span className="flex-1 min-w-0 truncate text-sm">{label}</span>
  </div>
</div>
```

The sub-items in Yesterday don't have a separate key/title structure — they have a plain text `label` string. The Today NestedMrRow pattern (indented div + icon + truncating text) is the right fit. Icon size bumps from `size-3` to `size-4` to match. The `divide-y divide-border` container wrapping sub-items also needs to be added (currently the parent `IssueActivityGroup` `py-2` wrapper handles spacing, but Today uses dividers).

### 3. StandaloneMrGroup header → match Today's MR row

```tsx
// TODAY'S PATTERN (from TodayMrsSection.tsx):
<div className="flex items-center gap-2 py-2 px-2">
  <GitMerge className="size-4 shrink-0 text-muted-foreground" />
  <span className="text-xs text-muted-foreground font-mono shrink-0">!{iid}</span>
  <span className="flex-1 min-w-0 truncate text-sm">{title}</span>
  {/* right-aligned tag */}
</div>
```

Changes: drop `font-semibold`, add `py-2 px-2`, change iid from inline `mr-1` to separate `shrink-0` span matching Today.

### 4. OtherCommitsGroup header

No direct Today equivalent. Recommended: treat it like a plain non-interactive MR row, dropping the `italic font-semibold text-muted-foreground` styling. Header becomes a simple `flex items-center gap-2 py-2 px-2` with `GitBranch` icon and `text-sm` label — consistent with how Today renders any "other" row.

---

## Container Structure — What Needs to Change in YesterdayColumn

Current:
```tsx
<div className="divide-y divide-border">
  {issueGroups.map((group) => <IssueActivityGroup ... />)}
  {standaloneMrGroups.map((mr) => <StandaloneMrGroup ... />)}
  {otherCommits.length > 0 && <OtherCommitsGroup ... />}
</div>
```

The `divide-y divide-border` container already matches Today — no change needed at the `YesterdayColumn` level. All changes are internal to the three sub-components.

---

## Risk Assessment

| Component | Used By | Risk |
|-----------|---------|------|
| `IssueActivityGroup` | `YesterdayColumn` only | Zero cross-codebase risk |
| `StandaloneMrGroup` | `YesterdayColumn` only | Zero cross-codebase risk |
| `OtherCommitsGroup` | `YesterdayColumn` only | Zero cross-codebase risk |

No shared components exist between Yesterday and Today item rows. Today's `IssueRow` is a private function component inside `TodayInProgressSection`/`TodayUpNextSection` and is not exported. The unification work is purely cosmetic CSS/className changes, zero data flow or API changes required.

---

## Stat Line — Current vs Target

Current Yesterday stat line:
```tsx
<p className="text-xs text-muted-foreground mb-4">
  {formatDuration(totalSeconds)} logged across{' '}
  {issueGroups.filter((g) => g.totalSeconds > 0).length} stories &middot; {commitCount}{' '}
  commits &middot; {mrEventCount} MR events
</p>
```

Already uses `text-xs text-muted-foreground` — this matches Today's secondary text style. No change needed.

---

## Shared Components Already Used by Both Columns

- `IssueTypeIcon` — used in Today's `IssueRow` and already in `IssueActivityGroup`. No changes needed.
- `Skeleton` — both columns use the same `LoadingSkeletons` pattern with `h-4 w-full`.
- `ErrorState` — both columns use it identically.
- `formatDuration` — shared utility, no changes.

---

## Sources

- `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — [VERIFIED: codebase read]
- `taskflow/src/routes/standup-notes/StandaloneMrGroup.tsx` — [VERIFIED: codebase read]
- `taskflow/src/routes/standup-notes/OtherCommitsGroup.tsx` — [VERIFIED: codebase read]
- `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` — [VERIFIED: codebase read]
- `taskflow/src/routes/standup-notes/TodayMrsSection.tsx` — [VERIFIED: codebase read]
- `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — [VERIFIED: codebase read]
- Usage grep (IssueActivityGroup, StandaloneMrGroup, OtherCommitsGroup) — [VERIFIED: codebase grep]

**Research date:** 2026-05-25
**Valid until:** indefinite (pure codebase analysis)
