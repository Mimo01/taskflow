# Quick Task 260922-bca: Nicer DatePicker across the app — Research

**Researched:** 2026-09-22
**Domain:** React date picker integration (react-day-picker + Base UI Popover + Tailwind v4 / shadcn base-nova)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `react-day-picker` (new dependency) rendered inside the app's existing Popover (Base UI) as the trigger/positioning shell.
- Build one shared `DatePicker` component in `src/components/ui/` (shadcn-style) so every call site imports the same component.
- Style the calendar to match the app's existing design tokens/theme (base-nova shadcn style, neutral base color), not the library's default look.
- Replace all 6 native `<input type="date">` locations:
  - `src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx`
  - `src/routes/dashboard/issue-detail/LogWorkPopover.tsx`
  - `src/routes/dashboard/release-detail/EditReleaseModal.tsx`
  - `src/routes/worklogs/WorklogsPage.tsx` (from + to filter fields)
  - `src/routes/worklogs/EditWorklogForm.tsx`
- Keep from/to as two independent single-date `DatePicker` popovers side by side (not a single range-picker component). Matches current two-field layout and avoids changing the from/to state shape.

### Claude's Discretion
- Exact visual styling details (colors, spacing, border radius) beyond "match existing design tokens" — align with `components.json` shadcn config (base-nova, neutral) and existing Popover styling conventions.
- Date formatting/display string in the trigger button (e.g. `MMM d, yyyy` vs locale default).
- Whether existing tests referencing `input[type="date"]` (e.g. `WorklogsPage.test.tsx`) need updating to target the new component's DOM structure — planner/executor should update these accordingly since the DOM shape will change.
- Package version pin for `react-day-picker` (and `date-fns` if required as a peer dependency) — pick current stable versions compatible with React 19 if applicable.

### Deferred Ideas (OUT OF SCOPE)
None stated. No range-picker component. No new visual design language beyond existing tokens.
</user_constraints>

## Summary

The app has **6 native `<input type="date">` call sites**, and every one of them stores/emits a plain **`YYYY-MM-DD` string** — never a `Date` object. That uniformity is the single most important finding: the new `DatePicker` should keep a **string-in / string-out API** (`value: string; onChange: (v: string) => void`) so no call site's state shape changes. `react-day-picker` internally speaks `Date`, so the string↔Date conversion must be **local-calendar-component based**, not `toISOString()` — the codebase already has this exact discipline documented in `src/lib/standup-date.ts`.

`react-day-picker@10.0.1` is current stable (published 2026-08-31), React 19 compatible (`peerDependencies: react >=16.8.0`), and **bundles `date-fns@^4.1.0` + `@date-fns/tz@^1.4.1` as real dependencies — not peers**. So `date-fns` is *not required* to be installed. v10 renamed the canonical package to `@daypicker/react`, but that package is a thin re-export wrapper whose only dependency is `react-day-picker@10.0.1`; installing `react-day-picker` directly is correct and fully supported.

For styling, the **shadcn `base-nova` `calendar` registry component is a near-perfect drop-in** — it is pure Tailwind (no `react-day-picker/style.css` import needed), it consumes `buttonVariants` from `@/components/ui/button` (already present with a matching `icon` size and `ghost` variant), and it already contains an `in-data-[slot=popover-content]:bg-transparent` rule that lines up exactly with this project's `PopoverContent` (`data-slot="popover-content"`). Three adaptations are required, all mechanical (details in Code Examples).

**Primary recommendation:** Install `react-day-picker@^10.0.1` only (no `date-fns`). Vendor the shadcn `base-nova` `calendar.tsx` into `src/components/ui/calendar.tsx` with the three adaptations below, then build `src/components/ui/date-picker.tsx` as a `Popover` + `PopoverTrigger`(Button outline) + `PopoverContent`(Calendar) wrapper with a **`YYYY-MM-DD` string** public API.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-day-picker` | `10.0.1` | Calendar / day-grid primitive | The library shadcn's own `calendar` component is built on; ~33.8M weekly downloads; 12-year-old repo (`github.com/gpbl/react-day-picker`) [VERIFIED: npm registry] |

### Not needed
| Library | Verdict |
|---------|---------|
| `date-fns` | **Do NOT install.** `react-day-picker@10.0.1` lists it as a *direct dependency* (`date-fns: ^4.1.0`), not a peer. [VERIFIED: `npm view react-day-picker dependencies`] The shadcn registry lists `date-fns` in `dependencies`, but that is for consumers who want `format()` in their own code. Use `Intl.DateTimeFormat` or a 6-line local formatter instead — the project has **zero** date libraries today and adding one for one `format()` call is unjustified. |
| `@daypicker/react` | Redundant alias. `npm view @daypicker/react dependencies` → `{ 'react-day-picker': '10.0.1' }`. [VERIFIED: npm registry] |
| `react-day-picker/style.css` | Not imported. The shadcn calendar supplies 100% of layout via Tailwind `classNames` overrides. [VERIFIED: registry source contains no CSS import] |

**Installation:**
```bash
cd taskflow && npm install react-day-picker@^10.0.1
```

## Package Legitimacy Audit

`slopcheck` could **not** be installed in this sandbox (`pip install slopcheck` failed — no network/permission). Manual registry verification was performed instead.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `react-day-picker` | npm | first published 2014-12-29 (~12 yrs) | 33.8M/wk | `github.com/gpbl/react-day-picker` | unavailable | **Approved** — but see note |

Additional checks:
- `npm view react-day-picker scripts.postinstall` → **no postinstall script** [VERIFIED]
- Package name was **not** discovered from WebSearch — it is named explicitly in the user's locked CONTEXT.md decision AND is the documented dependency of the shadcn `base-nova/calendar` registry entry (`https://ui.shadcn.com/r/styles/base-nova/calendar.json` → `dependencies: ["cn", "react-day-picker@latest", "date-fns"]`) [CITED: ui.shadcn.com registry]

**Packages removed due to [SLOP] verdict:** none
**Packages flagged [SUS]:** none. Because slopcheck was unavailable, the planner should still treat the install as a verify-then-proceed step: run `npm view react-day-picker version` and confirm `10.0.1` before `npm install`.

## Current Call Sites — Exact API Requirements

All five files, six inputs. **Every value is a `YYYY-MM-DD` string.** [VERIFIED: codebase read]

| # | File:line | Current shape | Notes for new API |
|---|-----------|---------------|-------------------|
| 1 | `src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx:383` | `<Input type="date" id={`${row.id}-duedate`} className="h-8 w-40 text-sm" value={row.duedate ?? ''} onChange={e => onChange({ duedate: e.target.value \|\| null })} disabled={isDisabled} />` | Needs `id` (a sibling `<label htmlFor>` points at it), `disabled`, and **clearable → `null`**. This is the only site that converts empty → `null`. |
| 2 | `src/routes/dashboard/issue-detail/LogWorkPopover.tsx:136` | `<Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs" />` | **Already inside a Base UI `PopoverContent` (`className="w-72 p-4"`)** → nested popover. See Pitfall 3. |
| 3 | `src/routes/dashboard/release-detail/EditReleaseModal.tsx:94` | `<Input id="release-date" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} disabled={isSaving} />` | Inside a Dialog. Needs `id` + `disabled`. |
| 4/5 | `src/routes/worklogs/WorklogsPage.tsx:898, 905` | raw `<input type="date">` (not the `Input` component) with hand-rolled classes, `value={customFrom}` / `{customTo}`, `className="min-w-32 rounded border border-border bg-background px-2 py-1 text-xs …"` | Sits in a dense filter bar of `h-7 text-xs` pills. Needs a **small / `h-7 text-xs`** trigger size. No `id`, no label. |
| 6 | `src/routes/worklogs/EditWorklogForm.tsx:114` | `<Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 text-xs" />` | Rendered inside `WorklogCellPopover` → **also a nested popover**. See Pitfall 3. |

**No call site uses `min` / `max` / `required` on the date input.** [VERIFIED: grep of all 6 sites] So `min`/`max` support is optional — but adding `minDate?: string` / `maxDate?: string` that map to rdp `startMonth`/`endMonth` + `disabled` matchers is cheap and future-proof. Do not over-build.

**Recommended public API:**
```ts
type DatePickerProps = {
  value: string | null | undefined;        // 'YYYY-MM-DD' | '' | null
  onChange: (value: string) => void;       // always 'YYYY-MM-DD' or '' when cleared
  id?: string;
  disabled?: boolean;
  placeholder?: string;                    // default 'Pick a date'
  className?: string;                      // applied to the trigger button
  size?: 'sm' | 'default';                 // 'sm' → h-7 text-xs for the worklogs filter bar
  clearable?: boolean;                     // shows an X; site #1 needs '' → null mapping at the call site
  minDate?: string;
  maxDate?: string;
  'aria-label'?: string;                   // sites #4/#5 have no visible label
};
```
Keep `onChange` emitting `''` (not `null`) so it stays a single narrow type; SubtaskTemplateRow does `onChange({ duedate: v || null })` exactly as it does today.

## Architecture Patterns

### Data flow
```
call site (YYYY-MM-DD string state)
  │ value: string
  ▼
<DatePicker>  ── src/components/ui/date-picker.tsx  (NEW)
  │  parseLocalDate(value) ──► Date        (local components, NOT new Date(str))
  │  formatDisplay(Date)   ──► "Sep 22, 2026"  (Intl.DateTimeFormat)
  ▼
<Popover>                                  existing src/components/ui/popover.tsx
  ├─ <PopoverTrigger className={buttonVariants({variant:'outline', size})}>
  │     CalendarIcon + display label | placeholder
  └─ <PopoverContent className="w-auto p-0">
        └─ <Calendar mode="single" selected={Date} onSelect={…} />
                 │  src/components/ui/calendar.tsx  (NEW, vendored from shadcn base-nova)
                 ▼
             react-day-picker <DayPicker>
                 │ onSelect(Date | undefined)
                 ▼
        toLocalDateString(Date) ──► 'YYYY-MM-DD' ──► onChange()  + close popover
```

### Pattern: trigger styling mirrors existing convention
`LogWorkPopover.tsx:115` already establishes the house pattern for a button-styled popover trigger — apply `buttonVariants(...)` directly to `PopoverTrigger` rather than nesting a `<Button>` inside it:
```tsx
<PopoverTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
```
Reuse this. It avoids a nested-button a11y problem and matches how the rest of the app does it. [VERIFIED: codebase]

### Pattern: `PopoverContent` needs `p-0` for the calendar
The shared `PopoverContent` hardcodes `p-4`. The shadcn calendar supplies its own `p-2`. Pass `className="w-auto p-0"` — `cn()`/tailwind-merge will strip the `p-4`. [VERIFIED: `popover.tsx` uses `cn()` with the default classes first]

### Recommended files
```
taskflow/src/components/ui/
├── calendar.tsx            # NEW — vendored shadcn base-nova calendar (rdp wrapper)
├── date-picker.tsx         # NEW — Popover + Button trigger + Calendar, string API
└── date-picker.test.tsx    # NEW — open/select/clear + local-TZ regression
taskflow/src/lib/
└── local-date.ts           # NEW (or extend) — parseLocalDate / toLocalDateString
```
Note: `src/lib/standup-date.ts` already has a private `toLocalDateString(d: Date): string` (line ~24) with a comment explaining exactly why `toISOString()` is wrong. **Extract it to a shared `src/lib/local-date.ts` and re-use it from both places** rather than duplicating a third copy. [VERIFIED: codebase read]

### Anti-patterns to avoid
- **`new Date('2026-05-10')`** — parses as UTC midnight; for any user west of UTC `.getDate()` returns the 9th. This would show the wrong day in the calendar. Always `new Date(y, m-1, d)`.
- **`date.toISOString().slice(0,10)`** on a Date built from local components — shifts the day for users east of UTC. Use local getters. (Codebase has 14 existing `toISOString().slice(0,10)` sites; those operate on API strings/UTC math and are fine — do not follow that pattern here.)
- **Installing `date-fns` for one `format()` call.** Use `Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'numeric' })`.
- **Wrapping `<Button>` inside `<PopoverTrigger>`** — produces button-in-button. Use `buttonVariants()` on the trigger.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Month grid / week layout / keyboard nav / ARIA grid roles | custom calendar | `react-day-picker` `<DayPicker>` | Week start, leap years, outside-days, arrow-key roving tabindex, `aria-selected`, screen-reader labels |
| Calendar visual styling | bespoke Tailwind calendar | shadcn `base-nova/calendar` registry `classNames` map | ~9KB of already-tuned token-based class overrides that match this exact shadcn style + neutral base color |
| Popover positioning / outside-click / portal | custom floating logic | existing `src/components/ui/popover.tsx` (Base UI `1.3.0`) | Already in the project, already z-50 portalled |
| Date display formatting | strftime clone | `Intl.DateTimeFormat` | Built into the runtime |

## Code Examples

### 1. Vendoring the shadcn base-nova calendar — the three required edits

Fetch the source (do not blind-run the CLI, which would also try to install `date-fns` and rewrite `components.json`):
```bash
curl -sL https://ui.shadcn.com/r/styles/base-nova/calendar.json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).files[0].content))" \
  > taskflow/src/components/ui/calendar.tsx
```

Then apply these three edits. All other ~9KB of `classNames` mappings transfer **unchanged** — every key it uses (`month_grid`, `button_previous`, `button_next`, `range_start`, `range_middle`, `range_end`, `today`, `outside`, `disabled`, `hidden`, `week_number`, `dropdown_root`) is a **valid v10 key**, and `getDefaultClassNames`, `type DayButton`, `type Locale` are all still exported by `react-day-picker@10.0.1`. [VERIFIED: `unpkg.com/react-day-picker@10.0.1/dist/esm/**/*.d.ts`; `Locale` survives as `export type Locale = DayPickerLocale` in `classes/DateLib.d.ts`]

**Edit A — imports.** `cn` and `Button` paths:
```diff
-import { cn } from "cn"
-import { Button, buttonVariants } from "@/registry/base-nova/ui/button"
-import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder"
+import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
+import { Button, buttonVariants } from '@/components/ui/button';
+import { cn } from '@/lib/utils';
```

**Edit B — replace the three `<IconPlaceholder …>` returns in `components.Chevron`** with plain lucide icons:
```tsx
Chevron: ({ className, orientation, ...props }) => {
  if (orientation === 'left')
    return <ChevronLeftIcon className={cn('size-4', className)} {...props} />;
  if (orientation === 'right')
    return <ChevronRightIcon className={cn('size-4', className)} {...props} />;
  return <ChevronDownIcon className={cn('size-4', className)} {...props} />;
},
```
(`iconLibrary` in `components.json` is already `lucide`, and `lucide-react@^0.577.0` is installed. [VERIFIED])

**Edit C — strip the four dead `cn-*` classes.** `cn-calendar-dropdown-root`, `cn-calendar-caption`, `cn-calendar-caption-label`, `cn-rtl-flip` are **not defined** by the installed `shadcn@4.1.0` — `node_modules/shadcn/dist/tailwind.css` is only 1669 bytes and contains zero `cn-` rules (it ships `@custom-variant data-open/data-selected/…` + `no-scrollbar` only). [VERIFIED: read the file] They are inert, not harmful, but remove them so nobody hunts for a missing stylesheet. Likewise the two `rtl:**:[.rdp-button\_next>svg]` lines can go — `components.json` has `"rtl": false`.

Also: keep `captionLayout="label"` (the default). The `dropdown` caption layout depends on the missing `cn-calendar-dropdown-root` positioning, so it will look wrong here.

### 2. The date conversion helpers (`src/lib/local-date.ts`)
```ts
/**
 * YYYY-MM-DD <-> Date conversions using LOCAL calendar components only.
 *
 * NEVER use `new Date('2026-05-10')` — that parses as UTC midnight, so
 * .getDate() returns the 9th for any user west of UTC.
 * NEVER use `.toISOString().slice(0,10)` on a locally-constructed Date —
 * that shifts the day for users east of UTC.
 * Same discipline as src/lib/standup-date.ts.
 */
export function parseLocalDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}
```

### 3. `src/components/ui/date-picker.tsx` skeleton
```tsx
import { CalendarIcon } from 'lucide-react';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { parseLocalDate, toLocalDateString } from '@/lib/local-date';
import { cn } from '@/lib/utils';

const DISPLAY = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric',
});

function DatePicker({ value, onChange, id, disabled, placeholder = 'Pick a date',
                      className, size = 'default', minDate, maxDate, ...rest }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseLocalDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        data-slot="date-picker-trigger"
        className={cn(
          buttonVariants({ variant: 'outline', size }),
          'justify-start font-normal',
          !selected && 'text-muted-foreground',
          className,
        )}
        {...rest}
      >
        <CalendarIcon />
        {selected ? DISPLAY.format(selected) : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" initialFocus={false}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          autoFocus
          disabled={
            minDate || maxDate
              ? { before: parseLocalDate(minDate), after: parseLocalDate(maxDate) }
              : undefined
          }
          startMonth={parseLocalDate(minDate)}
          endMonth={parseLocalDate(maxDate)}
          onSelect={(d) => {
            onChange(d ? toLocalDateString(d) : '');
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
export { DatePicker };
```
API notes verified against v10 typings [VERIFIED: `react-day-picker@10.0.1/dist/esm/types/props.d.ts` + `selection.d.ts`]:
- `onSelect` signature is `(selected, triggerDate, modifiers, e) => void` — for `mode="single"` (non-required) `selected` is `Date | undefined`.
- `startMonth?: Date` / `endMonth?: Date` (v10 **removed** `fromDate`/`toDate`/`fromMonth`/`toMonth`/`fromYear`/`toYear`).
- `disabled?: Matcher | Matcher[]`.
- `autoFocus?: boolean` replaced v9's removed `initialFocus`.
- `defaultMonth?: Date` still exists.

## Common Pitfalls

### Pitfall 1: UTC day shift on `YYYY-MM-DD` ↔ `Date` conversion (HIGH risk)
**What goes wrong:** picking Sep 22 stores `2026-09-21`, or the calendar highlights the day before the stored value.
**Why:** `new Date('2026-09-22')` is UTC midnight; `.toISOString()` re-converts to UTC.
**Avoid:** use `parseLocalDate` / `toLocalDateString` above, nothing else.
**Detect early:** add a unit test that runs with `TZ=America/Los_Angeles` and asserts round-trip `'2026-09-22' → Date → '2026-09-22'`. A UTC-only CI would hide this bug entirely.

### Pitfall 2: `PopoverContent`'s hardcoded `p-4` double-pads the calendar
The shared `PopoverContent` starts with `'z-50 rounded-lg border border-border bg-background p-4 shadow-lg outline-none'`. Pass `className="w-auto p-0"`; `cn()` (tailwind-merge) resolves the conflict in favor of `p-0`. Also note the calendar's own `in-data-[slot=popover-content]:bg-transparent` rule fires correctly here because `PopoverPopup` sets `data-slot="popover-content"`. [VERIFIED: popover.tsx:22]

### Pitfall 3: Nested popovers at 2 of the 6 call sites (MEDIUM risk)
`LogWorkPopover.tsx` and `EditWorklogForm.tsx` (inside `WorklogCellPopover`) render the date field **inside an already-open Base UI Popover**. Opening a second portalled popover from within one is supported by Base UI, but the outer popover's dismiss-on-outside-click can fire when the user clicks a day in the inner calendar's portal.
**Mitigations, in order of preference:**
1. Leave `modal` unset on both (default is `false`, so there is **no focus trap** to fight). [VERIFIED: `PopoverRoot.d.ts:56` — `modal?: boolean | 'trap-focus'`, documented default off]
2. Pass `initialFocus={false}` to the inner `PopoverContent` so Base UI does not yank focus out of the outer popup on open. [VERIFIED: `PopoverPopup.d.ts:45` accepts `initialFocus`]
3. If the outer popover still closes on day-click, fall back to rendering `<Calendar>` **inline** (no inner popover) inside those two compact forms — they are already narrow (`w-72`) panels where an always-visible calendar is acceptable UX.
**This needs manual verification in the running app** — jsdom cannot reproduce portal outside-click geometry.

### Pitfall 4: `WorklogsPage.test.tsx` will break (4 assertions)
It queries `input[type="date"]` directly at lines 226, 231, 245, 253:
- `226` — `expect(...'input[type="date"]').length).toBe(0)` (before clicking Custom)
- `231` — `.toBe(2)` (after clicking Custom)
- `245` / `253` — `fireEvent.change(fromInput, { target: { value: '2026-05-10' } })` to drive the fetch-gating assertions

After the swap there is **no `<input>` at all** — only a `<button>` trigger. Rewrite plan:
- Count assertions → query `[data-slot="date-picker-trigger"]` (add that attribute to the trigger, as in the skeleton above). This is why the trigger needs a stable `data-slot`.
- The `fireEvent.change` value-driving assertions cannot survive. Two options: (a) open the popover and `fireEvent.click` the day cell by its accessible name — Base UI popovers **do** open under `fireEvent.click` in this project's jsdom setup (proven by `src/routes/dashboard/StatusPopover.test.tsx:88`, which does `fireEvent.click(getByRole('button', …))` then `await screen.findByText(...)`); or (b) keep the fetch-gating logic test at the hook/state level and drop the DOM-driving part. **Prefer (a)** — it keeps the TEMPO-02 coverage intent intact.
- Update the file header comment, which currently says `TEMPO-02 — date presets (… Custom reveals date inputs)`.

### Pitfall 5: `shadcn` CLI would add an unwanted dependency
`npx shadcn add calendar` resolves `dependencies: ["cn", "react-day-picker@latest", "date-fns"]` and would install `date-fns` (unneeded, see Standard Stack) plus write into `@/registry/...` paths. Vendor the file manually via the `curl` above.

### Pitfall 6: `disabled` on `PopoverTrigger`
`PopoverTrigger` forwards to Base UI `Popover.Trigger`, which renders a native `<button>` and accepts `disabled`. Sites #1 (`isDisabled`) and #3 (`isSaving`) depend on this. Verify the disabled styling comes through — `buttonVariants` base includes `disabled:pointer-events-none disabled:opacity-50`. [VERIFIED: button.tsx cva base]

## State of the Art

| Old approach | Current approach | When changed | Impact here |
|--------------|------------------|--------------|-------------|
| `react-day-picker` v8 `classNames` keys (`table`, `nav_button`, `day_selected`) | v9/v10 keys (`month_grid`, `button_previous`/`button_next`, `selected`) | v9 (compat keys **removed** in v10) | The shadcn base-nova calendar already uses v10-valid keys → transfers clean. [CITED: daypicker.dev/upgrading] |
| `fromDate`/`toDate`/`fromMonth`/`toMonth`/`fromYear`/`toYear` | `startMonth`/`endMonth` + `hidden`/`disabled` matchers | v10 | Use `startMonth`/`endMonth` for min/max. Any v9-era snippet using `fromDate` will not compile. [CITED: daypicker.dev/upgrading] |
| `initialFocus` prop | `autoFocus` prop | v10 (removed) | Use `autoFocus`. |
| Package `react-day-picker` | canonical name `@daypicker/react` (old name kept for compat) | v10.0.0 (2026-04-27) | Cosmetic. `react-day-picker@10.0.1` is the real package; `@daypicker/react` merely depends on it. Install `react-day-picker`. [VERIFIED: npm] |
| Non-Gregorian via `react-day-picker/hebrew` | separate `@daypicker/hebrew` packages | v10 | N/A — Gregorian only. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| React | rdp peer `>=16.8.0` | ✓ | `^19.1.0` | — |
| `@base-ui/react` Popover | trigger shell | ✓ | `1.3.0` installed (`^1.2.0` declared) | — |
| `lucide-react` | Chevron + CalendarIcon | ✓ | `^0.577.0` | — |
| `class-variance-authority` / `tailwind-merge` / `clsx` | `buttonVariants`, `cn` | ✓ | `0.7.1` / `3.5.0` / `2.1.1` | — |
| Tailwind CSS v4 | `size-(--cell-size)`, `rounded-(--cell-radius)` arbitrary-property syntax | ✓ | `^4.2.1` | — |
| `shadcn/tailwind.css` `cn-*` utilities | dropdown caption layout only | ✗ (file has no `cn-` rules) | `shadcn@4.1.0` | use `captionLayout="label"`; strip the dead classes |
| `react-day-picker` | the calendar | ✗ **must install** | target `10.0.1` | none — blocking |
| vitest + jsdom + testing-library | tests | ✓ | `vitest@4.0.18`, `jsdom@29`, `@testing-library/react@16.3.2` | — |

**Missing with no fallback:** `react-day-picker` — install step required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 + jsdom 29 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vite.config.ts` (`test:` block, `setupFiles: ['./src/test/setup.ts']`) |
| Quick run | `cd taskflow && npx vitest run src/components/ui/date-picker.test.tsx src/routes/worklogs/WorklogsPage.test.tsx` |
| Full suite | `cd taskflow && npm test` |

### Requirement → test map
| Behavior | Type | Command | File exists? |
|----------|------|---------|-------------|
| Trigger renders formatted value; placeholder when empty | unit | `npx vitest run src/components/ui/date-picker.test.tsx` | ❌ create |
| Click trigger opens calendar; click day emits `YYYY-MM-DD` and closes | unit | same | ❌ create |
| Local-TZ round-trip `'2026-09-22' → Date → '2026-09-22'` under a negative-offset TZ | unit | same (`TZ=America/Los_Angeles npx vitest run …`) | ❌ create |
| `disabled` trigger does not open | unit | same | ❌ create |
| WorklogsPage Custom preset reveals 2 date triggers | unit | `npx vitest run src/routes/worklogs/WorklogsPage.test.tsx` | ✅ **update lines 226/231/245/253** |
| Custom range fetch-gating (from set alone → no fetch; to<from → no fetch; valid → fetch) | unit | same | ✅ **rewrite to drive via calendar clicks** |
| Nested popover: LogWorkPopover / WorklogCellPopover stay open while the date popover is used | **manual** | run the app | — jsdom cannot reproduce portal outside-click |

### Pre-commit note
A husky pre-commit hook runs the **full vitest suite** (`prepare: cd .. && husky taskflow/.husky`). The `WorklogsPage.test.tsx` update must land in the **same commit** as the `WorklogsPage.tsx` swap, or the commit will be rejected. Also run `npm run check` (biome + `tsc --noEmit`) before committing.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Base UI nested popovers (date popover inside `LogWorkPopover` / `WorklogCellPopover`) work without the outer popover dismissing on day-click, given `modal` unset + `initialFocus={false}` | Pitfall 3 | Two call sites need the inline-`<Calendar>` fallback. **Requires manual app verification** — not testable in jsdom. |
| A2 | shadcn `base-nova/calendar.tsx`, written against `react-day-picker@latest`, compiles against `10.0.1` after only the 3 listed edits | Code Examples | Additional type errors at build. Mitigated: every `classNames` key and every imported symbol (`getDefaultClassNames`, `DayButton`, `Locale`) was individually verified present in the v10 `.d.ts` files, but the file was not actually compiled in this session. |
| A3 | `Intl.DateTimeFormat` display formatting is acceptable vs an explicit `MMM d, yyyy` — CONTEXT leaves format to Claude's discretion | Standard Stack | Cosmetic only; swap to a hardcoded formatter if locale variance is unwanted. |
| A4 | `min`/`max` constraints are genuinely unused, so `minDate`/`maxDate` can be a thin optional add | Call Sites | None — verified by grep across all 6 sites; worst case the props go unused. |

## Open Questions

1. **Trigger size for the WorklogsPage filter bar.** The surrounding preset pills are `h-7 … text-xs` and the old inputs were `min-w-32 … text-xs`. `buttonVariants` has a `sm` size (`h-7 … text-[0.8rem]`), which is close but not identical to `text-xs`.
   - Recommendation: use `size="sm"` plus `className="text-xs min-w-32"` at that call site. Visual detail, Claude's discretion per CONTEXT.
2. **Should the due-date field be clearable?** `SubtaskTemplateRow` currently allows clearing via the native input's built-in clear affordance, mapping `'' → null`. A button trigger has no such affordance.
   - Recommendation: add a small `clearable` variant (X icon, appears only when a value is set) and enable it at that one site. Otherwise a user who sets a due date can never unset it — a genuine regression.

## Sources

### Primary (HIGH)
- Codebase — all 6 call sites, `src/components/ui/{popover,button,input}.tsx`, `src/lib/standup-date.ts`, `src/test/setup.ts`, `vite.config.ts`, `package.json`, `components.json`, `src/index.css`, `node_modules/shadcn/dist/tailwind.css`, `node_modules/@base-ui/react/popover/**/*.d.ts`, `src/routes/dashboard/StatusPopover.test.tsx`, `src/routes/worklogs/WorklogsPage.test.tsx`
- `unpkg.com/react-day-picker@10.0.1/dist/esm/**/*.d.ts` — props, selection handlers, `getDefaultClassNames`, `Locale`/`DayPickerLocale`, custom-components exports
- `npm view react-day-picker|@daypicker/react|date-fns` — versions, deps, repo, publish dates, no postinstall
- `api.npmjs.org/downloads/point/last-week/*` — download counts
- `ui.shadcn.com/r/styles/base-nova/calendar.json` — full registry source for the calendar component

### Secondary (MEDIUM)
- `daypicker.dev/upgrading` — v10 breaking changes (package rename, removed nav props, removed compat `classNames` keys)

## Metadata

**Confidence breakdown:**
- Stack / versions: **HIGH** — registry + typings directly inspected
- Call-site API shape: **HIGH** — all 6 sites read; all string-based, none use min/max/required
- Styling approach: **HIGH** — registry source read line-by-line; every `classNames` key cross-checked against v10 typings; the one gap (`cn-*` utilities absent from installed shadcn) was confirmed by reading the actual CSS file
- Nested-popover behavior: **MEDIUM** — Base UI API surface verified, runtime interaction not verified (A1)
- Test-migration path: **HIGH** — exact broken assertions identified; the Base-UI-popover-in-jsdom pattern is proven by an existing passing test

**Research date:** 2026-09-22
**Valid until:** ~2026-10-22 (react-day-picker v10 is 3 weeks old as of the 10.0.1 publish; re-verify the version pin if planning slips)
