# Quick Task 260607-jwb: Standup "Yesterday" → pick any day - Research

**Researched:** 2026-06-07
**Domain:** React UI (base-ui Menu) + TanStack Query re-keying + TZ-safe local date math
**Confidence:** HIGH (all findings verified against codebase source)

## Summary

The feature is small and the existing architecture already supports it cleanly. `StandupNotesPage`
owns `yesterdayDate` and threads it into all four data-query `queryKey`s plus the markdown export,
so converting `yesterdayDate` from a pure `useMemo` into `override ?? resolved` automatically re-keys
and re-fetches everything for the chosen day — no other wiring needed. The dropdown primitive is
`@base-ui/react` (NOT Radix as CONTEXT.md assumed), and it already exports
`DropdownMenuRadioGroup` / `DropdownMenuRadioItem` with a built-in checkmark indicator — exactly the
"selected day" affordance required. The trigger renders a real native `<button>`, so a11y is free.

The only real risks are the standard TZ off-by-one (mitigated by reusing the module's local-component
pattern) and a couple of existing tests that assert on heading/`dateLabel` text.

**Primary recommendation:** Hold `dateOverride: string | null` state in `StandupNotesPage`. Compute
`yesterdayDate = dateOverride ?? resolveYesterdayDate(scheduleData)`. Pass `yesterdayDate`, the
resolved default, an `onSelectDate` callback, and a TZ-safe 14-day list down to `YesterdayColumn`,
which wraps its `<h2>` in a `DropdownMenuTrigger` with a hover caret and a `DropdownMenuRadioGroup`.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Dropdown lists **all calendar days** from the last 14 days (incl. weekends), most-recent-first.
- Affordance is **caret on hover** — default (no-hover) appearance unchanged, cursor becomes pointer.
- First dropdown row = resolved default day, **labelled "Yesterday"**, shown as currently-selected
  when no override is active. Selecting it reverts to default.
- **No persistence** — override lives in React state only (not settings store / localStorage / stronghold).
  Reload returns to default.
- The clickable title is the **"Yesterday" `<h2>` in `YesterdayColumn.tsx`**, not the page header.

### Claude's Discretion
- Exact dropdown component (existing `dropdown-menu.tsx` is the natural fit — confirmed below).
- Precise per-row label format (reuse `formatDateLabel` / `getColumnHeading` conventions).
- Whether override state lives in `StandupNotesPage` (recommended) vs `YesterdayColumn`.

### Correction to CONTEXT.md assumption
CONTEXT.md calls `dropdown-menu.tsx` a "Radix wrapper." It is **not** — it wraps
`@base-ui/react/menu` (`@base-ui/react` ^1.2.0). All API notes below reflect base-ui, not Radix.

## Where the override state lives (Item 1)

`StandupNotesPage` is the correct owner. Confirmed by reading the source:

- `yesterdayDate` is a `useMemo` over `resolveYesterdayDate(scheduleData ?? undefined)`
  (`StandupNotesPage.tsx:178-181`).
- It is the `queryKey` discriminator for **all four data queries**:
  - `tempoQuery` — `['standup','tempo', jiraBaseUrl, yesterdayDate, ...]` (`:189`)
  - `jiraActivityQuery` — `['standup','jira', ..., yesterdayDate, ...]` (`:208`)
  - `commitsQuery` — `['standup','commits', ..., yesterdayDate, ...]` (`:233`)
  - `mrEventsQuery` — `['standup','mr-events', ..., yesterdayDate]` (`:261`)
- It also feeds `dateLabel` (`:182`) and the `generateMarkdown(..., yesterdayDate)` copy handler (`:354`).
- `issueMetaQuery` keys on `referencedKeys` (derived from the four queries' data), so it re-resolves
  transitively once they refetch — no direct dependency on `yesterdayDate` needed (`:290-299`).

**Change:** replace the memo with:
```tsx
const [dateOverride, setDateOverride] = useState<string | null>(null);
const resolvedYesterday = useMemo(
  () => resolveYesterdayDate(scheduleData ?? undefined),
  [scheduleData],
);
const yesterdayDate = dateOverride ?? resolvedYesterday;
```
Because every query keys on `yesterdayDate`, setting `dateOverride` re-fetches all four for the new day
with zero extra wiring. `dateLabel` (`formatDateLabel(yesterdayDate)`) and the markdown export follow
automatically.

**Query that must stay independent (verified):** the **schedule query**
(`['standup','schedule', jiraBaseUrl, jiraUserKey]`, `:163-175`) does **not** depend on `yesterdayDate`
and must **not** be re-keyed. It fetches the holiday calendar that *drives* the resolved default; making
it depend on the override would be circular. Leave it exactly as-is. `getScheduleLookbackRange()` already
covers a 14-day window, which conveniently matches the dropdown range.

**Reset semantics:** selecting the resolved default day → call `setDateOverride(null)` (not the date
string), so the page returns to the live "follow the schedule" path rather than pinning a literal date.

## Dropdown primitive (Item 2)

Import surface (all exported from `@/components/ui/dropdown-menu`, verified `dropdown-menu.tsx:226-242`):

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
```

**`DropdownMenuRadioGroup` / `DropdownMenuRadioItem` exist and are ideal** — `RadioItem` ships a built-in
`CheckIcon` indicator (`dropdown-menu.tsx:203-208`) that renders only for the selected value, giving the
"first row shown selected / checkmark on chosen day" behavior for free.

base-ui API (verified from `node_modules/@base-ui/react/menu/.../*.d.ts`):
- `DropdownMenuRadioGroup` props: `value` (controlled), `onValueChange(value, eventDetails)`.
- `DropdownMenuRadioItem` props: `value` (required), optional `closeOnClick` (default closes on click).
- `DropdownMenu` (Root) accepts `open` / `onOpenChange` if controlled, but uncontrolled is fine here.
- `DropdownMenuTrigger` **renders a native `<button>`** (verified `MenuTrigger.d.ts`: "Renders a
  `<button>` element") — so it is keyboard/focus accessible with no extra work.

Minimal usage (mirrors the real example at `FieldsSection.tsx:831-873`):
```tsx
<DropdownMenu>
  <DropdownMenuTrigger className="group/yhead flex items-baseline gap-1 cursor-pointer text-left">
    <h2 className="text-2xl font-semibold">{getColumnHeading(yesterdayDate)}</h2>
    <ChevronDown className="size-4 self-center opacity-0 transition-opacity group-hover/yhead:opacity-60" />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
    <DropdownMenuRadioGroup
      value={dateOverride ?? resolvedYesterday}
      onValueChange={(v) => onSelectDate(v === resolvedYesterday ? null : v)}
    >
      {dayOptions.map((opt) => (
        <DropdownMenuRadioItem key={opt.date} value={opt.date}>
          {opt.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>
```
`onSelectDate(null)` when the chosen value equals the resolved default keeps the "revert to default"
path (see Reset semantics above). The radio `value` resolves to the default when no override is set, so
the first row renders checked by default — satisfying "first row shown selected."

**If you prefer not to use RadioItem:** plain `DropdownMenuItem` works too, but you'd hand-render the
checkmark and selected state. RadioGroup is strictly simpler here — use it.

## Building the 14-day list TZ-safely (Item 3)

Mirror the module's local-component rule (`standup-date.ts:24-29` `toLocalDateString`, and the inline
`todayStr` memo at `StandupNotesPage.tsx:107-110`). **Never** `toISOString()` / `toLocaleDateString()`.

```tsx
// Build [today-1 .. today-14], most-recent-first, as local YYYY-MM-DD strings.
const dayOptions = useMemo(() => {
  const opts: { date: string; label: string }[] = [];
  const base = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);           // local calendar arithmetic
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    opts.push({ date, label: getColumnHeading(date) === 'Yesterday'
      ? 'Yesterday'
      : formatDateLabel(date) });            // "Weekday, D Month YYYY"
  }
  return opts;                                // already most-recent-first
}, []);
```

**Label rule:** reuse `getColumnHeading(dateStr)` (`YesterdayColumn.tsx:96-106`) — it returns
`"Yesterday"` for calendar-yesterday and the weekday name otherwise — combined with `formatDateLabel`
(`StandupNotesPage.tsx:58-67`, `"Weekday, D Month YYYY"`) for non-yesterday rows. CONTEXT requires the
**default** row labelled "Yesterday": note the *resolved default* may not be calendar-yesterday (after a
weekend/holiday it's e.g. Friday). Decide one of:
- Label the **resolved default** row "Yesterday" regardless of its calendar position (matches CONTEXT
  decision literally: "first row is the resolved default day, labelled 'Yesterday'"), and label all other
  rows by weekday+date. **Recommended** — pass `resolvedYesterday` down and special-case it.
- Or label strictly by calendar (`getColumnHeading`), which would label calendar-yesterday "Yesterday"
  even when it isn't the default. CONTEXT prefers the former.

`getColumnHeading` and `formatDateLabel` currently live in different files (`YesterdayColumn.tsx` exports
neither; `formatDateLabel` is module-private to `StandupNotesPage`). To build labels in the page, either
compute labels in `YesterdayColumn` (which already has `getColumnHeading`) or export the helper. Cleanest:
build `dayOptions` inside `YesterdayColumn` (it already imports nothing extra) and pass only
`resolvedYesterday` + `onSelectDate` + current `yesterdayDate` from the page.

## Caret-on-hover affordance (Item 4)

Tailwind group-hover with an opacity transition keeps the default look identical:
- Put `group/yhead` on the `DropdownMenuTrigger` (the button wrapping the `<h2>`).
- Caret icon: `opacity-0 transition-opacity group-hover/yhead:opacity-60` (see snippet in Item 2).
- `cursor-pointer` on the trigger gives the pointer cursor on hover.
- The current heading block is `<div className="mb-2 flex items-baseline gap-2">` with the `<h2>` and a
  `<p>` date label (`YesterdayColumn.tsx:556-559`). Wrap only the `<h2>` (+caret) in the trigger button;
  leave the `<p>` date label outside so layout is unchanged. Use `lucide-react`'s `ChevronDown` (the file
  already imports from `lucide-react`).

Named groups (`group/yhead`) avoid collisions with the `group/dropdown-menu-item` already used inside
the menu components.

## Pitfalls (Item 5)

### Pitfall 1: TZ off-by-one
Building the day list or comparing dates via `toISOString()` shifts the calendar day for users east of
UTC / at day boundaries. **Avoid:** use only local getters (`getFullYear`/`getMonth`/`getDate`) exactly
like `toLocalDateString` and `getColumnHeading`. Test with `vi.setSystemTime(new Date(y,m,d,...))`
(local-component construction) as the existing tests do (`YesterdayColumn.test.ts:337`).

### Pitfall 2: trigger must be a real button (a11y)
Don't attach `onClick` to a bare `<h2>`. `DropdownMenuTrigger` already renders a native `<button>` and
manages focus/keyboard/aria — use it. Keep the `<h2>` as the button's child for heading semantics, or
move the heading text into the button with appropriate styling.

### Pitfall 3: accidentally persisting
Keep override in `useState` only. Do **not** route it through `useSettingsStore` or `readSecret`/stronghold.
A page reload remounts `StandupNotesPage`, resetting `dateOverride` to `null` → back to default. No further
work needed for the "reload returns to default" requirement.

### Pitfall 4: existing tests
- `YesterdayColumn.test.ts` — tests `generateMarkdown()` output only (`## Yesterday (date)` etc.,
  lines 333-355). The markdown export is unchanged by this feature, so these should **stay green** as long
  as `generateMarkdown` signature/behavior is untouched. No change expected.
- `YesterdayColumn.tempo-disabled.test.tsx` — renders `<YesterdayColumn {...BASE_PROPS} />` with a fixed
  `dateLabel: 'Thursday, May 22'` (line 23) and a `BASE_PROPS` object (lines ~10-33). If you add **required**
  props to `YesterdayColumn` (e.g. `resolvedYesterday`, `onSelectDate`, `dayOptions`), this test's
  `BASE_PROPS` must be updated or TypeScript/render will fail. Make new props optional or update
  `BASE_PROPS`. The test asserts only on the Tempo-disabled message, not the heading, so wrapping the
  `<h2>` in a button won't break its assertions — but the new required props will. **Action: update
  `BASE_PROPS`** (or default the new props).
- No test currently asserts the heading is non-interactive, so adding the dropdown won't trip an existing
  assertion beyond the props issue above.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Selected-row checkmark | Custom state + check icon | `DropdownMenuRadioGroup` + `RadioItem` | Built-in indicator, keyboard nav, aria |
| Dropdown open/close/focus | onClick + outside-click handler | `DropdownMenu` + `DropdownMenuTrigger` | base-ui handles focus trap, esc, aria |
| Local date string | `toISOString().slice(0,10)` | local-getter formatting (`toLocalDateString` pattern) | UTC shift = off-by-one bug |
| Re-fetch on day change | manual `refetch()` calls | put `yesterdayDate` in queryKey (already done) | TanStack auto-refetches on key change |

## Code Examples

All examples above are derived directly from in-repo source:
- Trigger pattern: `src/routes/dashboard/issue-detail/FieldsSection.tsx:831-873`
- RadioItem checkmark indicator: `src/components/ui/dropdown-menu.tsx:185-211`
- Local date formatting: `src/lib/standup-date.ts:24-29`, `StandupNotesPage.tsx:107-110`
- Heading label logic: `src/routes/standup-notes/YesterdayColumn.tsx:96-106`

## Open Questions

1. **Label of the resolved default when it isn't calendar-yesterday** (e.g. after a weekend the default
   is Friday). CONTEXT says label it "Yesterday." Recommendation: special-case the `resolvedYesterday`
   row to "Yesterday", label all others by weekday+date. Low risk — confirm with planner.
2. **Build `dayOptions`/labels in `YesterdayColumn` vs page.** Recommendation: build in `YesterdayColumn`
   (it already owns `getColumnHeading`); pass `resolvedYesterday`, `yesterdayDate`, `onSelectDate` from
   the page. Avoids exporting `formatDateLabel`.

## Sources

### Primary (HIGH confidence)
- Codebase: `StandupNotesPage.tsx`, `YesterdayColumn.tsx`, `standup-date.ts`, `dropdown-menu.tsx`,
  `FieldsSection.tsx`, `YesterdayColumn.test.ts`, `YesterdayColumn.tempo-disabled.test.tsx` (all read in full / grepped)
- Type defs: `node_modules/@base-ui/react/menu/{radio-group,radio-item,trigger}/*.d.ts`
- `package.json`: `@base-ui/react` ^1.2.0

## Metadata

**Confidence breakdown:**
- State ownership / re-keying: HIGH — read every queryKey in source
- Dropdown primitive API: HIGH — read base-ui type defs + real in-repo usage
- TZ-safe date list: HIGH — mirrors existing verified module pattern
- Test impact: HIGH — read both affected test files

**Research date:** 2026-06-07
**Valid until:** stable (internal code, no external version drift)
