---
phase: quick-260922-bca
plan: 01
subsystem: ui-components
tags: [datepicker, react-day-picker, calendar, ui]
dependency-graph:
  requires: []
  provides:
    - "src/components/ui/date-picker.tsx (DatePicker)"
    - "src/components/ui/calendar.tsx (Calendar)"
    - "src/lib/local-date.ts (parseLocalDate, toLocalDateString)"
  affects:
    - "src/routes/worklogs/WorklogsPage.tsx"
    - "src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx"
    - "src/routes/dashboard/release-detail/EditReleaseModal.tsx"
    - "src/routes/dashboard/issue-detail/LogWorkPopover.tsx"
    - "src/routes/worklogs/EditWorklogForm.tsx"
tech-stack:
  added: ["react-day-picker@^10.0.1"]
  patterns:
    - "YYYY-MM-DD string in/out API for date fields (no call-site state shape change)"
    - "Local-calendar-component date conversion (never new Date(str) / toISOString().slice)"
key-files:
  created:
    - taskflow/src/lib/local-date.ts
    - taskflow/src/lib/local-date.test.ts
    - taskflow/src/components/ui/calendar.tsx
    - taskflow/src/components/ui/date-picker.tsx
    - taskflow/src/components/ui/date-picker.test.tsx
  modified:
    - taskflow/package.json
    - taskflow/package-lock.json
    - taskflow/src/lib/standup-date.ts
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx
    - taskflow/src/routes/dashboard/release-detail/EditReleaseModal.tsx
    - taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
    - taskflow/src/routes/worklogs/EditWorklogForm.tsx
decisions:
  - "react-day-picker@10.0.1 verified against npm registry (version + repo + empty postinstall) before install, per T-BCA-SC"
  - "date-fns NOT installed as a direct dependency — react-day-picker bundles it internally; display formatting uses Intl.DateTimeFormat"
  - "Vendored shadcn base-nova calendar.tsx manually via curl (not `npx shadcn add calendar`, which would install date-fns and rewrite components.json)"
  - "WorklogsPage tests drive the real calendar via a new selectCalendarDay() test helper that queries day cells by their stable data-day=\"YYYY-MM-DD\" attribute and navigates months via Previous/Next Month buttons — more robust than accessible-name matching"
metrics:
  duration: "~50min"
  completed: "2026-09-22"
---

# Phase quick-260922-bca Plan 01: Nicer DatePicker Across the App Summary

Replaced all six native `<input type="date">` fields with one shared, design-token-styled `DatePicker` component (react-day-picker v10 inside the app's existing Base UI Popover), giving every date field in the app a consistent themed calendar instead of the browser's native picker.

## What Was Built

**Task 1 — Shared DatePicker component and supporting utilities** (commit `601b9ad0`)
- `src/lib/local-date.ts`: `parseLocalDate` / `toLocalDateString` — YYYY-MM-DD ↔ Date conversion using local calendar components only (never `new Date('YYYY-MM-DD')` or `.toISOString().slice(0,10)`, both of which shift the day across timezones)
- `src/lib/standup-date.ts`: de-duplicated its private `toLocalDateString` to import from the new shared module
- `src/components/ui/calendar.tsx`: vendored shadcn base-nova calendar (react-day-picker v10 wrapper), fetched via `curl` and hand-edited per the three required adaptations (import paths, lucide Chevron icons in place of `IconPlaceholder`, removal of four dead `cn-*`/`rtl` classes not present in the installed shadcn build)
- `src/components/ui/date-picker.tsx`: `DatePicker` — Popover trigger (styled via `buttonVariants`, never a nested `<Button>`) + Calendar popup, with `value`/`onChange` as plain `YYYY-MM-DD` strings, `clearable` (sibling X control, not nested inside the trigger button), `disabled`, `size`, `minDate`/`maxDate` pass-through
- Unit tests for both new modules: render/open/select/clear/disabled behavior, plus TZ round-trip verified green under UTC, `America/Los_Angeles`, and `Asia/Tokyo`
- `react-day-picker@10.0.1` installed after verifying registry version, repo (`github.com/gpbl/react-day-picker`), and an empty `scripts.postinstall`; `date-fns` was NOT added as a direct dependency

**Task 2 — WorklogsPage filter bar migration** (commit `8841bbb2`)
- Replaced the two raw `<input type="date">` custom-range fields with `DatePicker` (`size="sm"`, `className="min-w-32 text-xs"` to match the `h-7` preset pills, `aria-label="From date"` / `"To date"` since these fields have no visible label)
- Rewrote `WorklogsPage.test.tsx`: trigger-count assertions now query `[data-slot="date-picker-trigger"]`; the TEMPO-02 fetch-gating test (from-only → no fetch, to<from → no fetch, valid range → fetch fires) now drives the real calendar through a new `selectCalendarDay()` helper that opens the trigger by its aria-label, navigates months via the Previous/Next Month buttons if needed, and clicks the target day cell via its `data-day="YYYY-MM-DD"` attribute

**Task 3 — Remaining four call sites** (commit `3f7cc399`)
- `SubtaskTemplateRow.tsx`: due-date field, now `clearable` (this is the one regression risk the plan flagged — the native input's clear affordance had no button-trigger equivalent, so `clearable` was added to preserve empty → `null` mapping)
- `EditReleaseModal.tsx`: release-date field, disabled while saving
- `LogWorkPopover.tsx` and `EditWorklogForm.tsx`: both render inside an already-open Base UI Popover (Log Work popover / worklog cell popover) — nested-popover risk mitigated by the `DatePicker`'s defaults from Task 1 (`modal` left unset, inner `PopoverContent` gets `initialFocus={false}`)
- Confirmed zero `type="date"` occurrences remain anywhere in `src/`

## Verification Status

Automated (all green):
- `npm run check` (biome + `tsc --noEmit`) clean for every file this plan touched
- `npm test` — full suite: 196 test files, 2761 tests passing (2 skipped, 13 todo — pre-existing, unrelated to this plan)
- Local-date / date-picker unit tests green under UTC, `America/Los_Angeles`, and `Asia/Tokyo`
- `grep -rn 'type="date"' src/` → 0 occurrences
- `grep -n "date-fns" package.json` → 0 occurrences (dependency not added)

**NOT verified — requires human action (see below).**

## Deviations from Plan

### Post-execution code review fix

**5. [Blocker] Deselect-click on already-selected day crashed non-clearable consumers**
- **Found during:** `gsd-code-reviewer` pass (CR-01) after the 3 execution tasks landed
- **Issue:** `Calendar` runs `mode="single"` without `required`, so clicking the currently-selected day fires `onSelect(undefined)`. `DatePicker.onSelect` unconditionally translated that to `onChange('')`, ignoring the `clearable` prop. `LogWorkPopover.tsx:99` and `EditWorklogForm.tsx:87` both construct `new Date(`${date}T12:00:00`)` with no empty-string guard, so this crashed with an uncaught `RangeError` on click. `EditReleaseModal.tsx` silently cleared the release date instead.
- **Fix:** `date-picker.tsx`'s `onSelect` now only propagates `onChange('')` when `clearable` is true; otherwise a deselect-click is a no-op (popover just closes, prior value retained).
- **Files modified:** `taskflow/src/components/ui/date-picker.tsx`
- **Commit:** `01e9da4a`
- **Verified:** `npm run check` (no new diagnostics vs. pre-existing baseline) + full `npm test` (2761 passing) green after the fix.

**6. [Human-checkpoint feedback] Trigger width inconsistent with sibling form inputs**
- **Found during:** Human verification (checkpoint Task 4) — functional checks (nested popover, clear, disabled, today's-date) all passed; only the width was flagged.
- **Issue:** `DatePicker`'s trigger used `buttonVariants` (content-sized) and its wrapper was `inline-flex` (shrink-to-fit), so the picker sat narrower than sibling `Input`/`Textarea` fields in the same form — most visible in `EditReleaseModal`'s Release Date field below a full-width Name input.
- **Fix:** Trigger now defaults to `w-full min-w-0` (matching `Input`'s own convention); wrapper changed `inline-flex` → `flex` so it behaves as a normal full-width block box in block-level form contexts while still sizing correctly as a flex item in `WorklogsPage`'s horizontal filter toolbar (its `min-w-32` still governs there — verified no layout regression). Removed now-redundant per-call-site width overrides (`w-40` on `SubtaskTemplateRow`, `w-full` on `LogWorkPopover`/`EditWorklogForm`).
- **Files modified:** `taskflow/src/components/ui/date-picker.tsx`, `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx`, `taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx`, `taskflow/src/routes/worklogs/EditWorklogForm.tsx`
- **Commit:** `79b8bd70`
- **Verified:** `tsc --noEmit` clean, full `npm test` (2761 passing) green.

**7. [Human-checkpoint feedback] Clear (X) icon not vertically centered**
- **Found during:** Human verification, second pass (after the width fix)
- **Issue:** The absolutely-positioned clear button only set `right-1.5` with no vertical anchoring, so it sat at its static top-of-flow position — the wrapper's `items-center` has no effect on an absolutely positioned child.
- **Fix:** Added `top-1/2 -translate-y-1/2`.
- **Files modified:** `taskflow/src/components/ui/date-picker.tsx`
- **Commit:** `888d37ab`
- **Verified:** `date-picker.test.tsx` (7 tests) + `tsc --noEmit` clean, full `npm test` (2761 passing) green.

## Checkpoint Resolution

Human verification confirmed: nested popovers stay open, clearable due date works, disabled state blocks opening, and today's date renders correctly with no off-by-one. Two rounds of styling feedback (width inconsistency, deviation 6; clear-icon centering, deviation 7) were fixed and re-verified. User gave final approval. **Checkpoint is satisfied — plan complete.**

### Auto-fixed Issues

**1. [Rule 1 - Bug] `disabled` matcher type mismatch on `Calendar`**
- **Found during:** Task 1, `npm run check` (tsc)
- **Issue:** The skeleton in RESEARCH.md built `disabled={{ before, after }}` as a single object, but react-day-picker v10's `Matcher` type only recognizes `DateBefore` (`{ before: Date }`) and `DateAfter` (`{ after: Date }`) as separate shapes, not a combined object — TS2322.
- **Fix:** Added `buildDisabledMatcher(minDate, maxDate)` in `date-picker.tsx` that returns an array of the applicable single-key matchers (`[{ before }]`, `[{ after }]`, both, or `undefined`).
- **Files modified:** `taskflow/src/components/ui/date-picker.tsx`
- **Commit:** `601b9ad0`

**2. [Rule 1 - Bug] `it.each` tuple-vs-callback-arity mismatch in local-date.test.ts**
- **Found during:** Task 1, `npm run check` (tsc)
- **Issue:** `it.each([[input, undefined], ...])` inferred a 2-arg-tuple callback signature; the callback only declared one parameter, causing TS2345.
- **Fix:** Changed each row to `[input, label]` (a human-readable label instead of a redundant `undefined`) and destructured both params in the callback.
- **Files modified:** `taskflow/src/lib/local-date.test.ts`
- **Commit:** `601b9ad0`

**3. [Rule 1 - Bug] Test helper accessible-name assumptions didn't match actual react-day-picker output**
- **Found during:** Task 1, first `vitest run` of `date-picker.test.tsx`
- **Issue:** Day-button accessible names are formatted as `"Wednesday, September 22nd, 2026"` (weekday + ordinal suffix), not the `"22 September 2026"` shape assumed while drafting the test.
- **Fix:** Adjusted regexes to `/September 22nd, 2026/i` etc. Verified via a scratch debug test (created, inspected, then deleted — never committed) that dumped the actual grid button `aria-label`s.
- **Files modified:** `taskflow/src/components/ui/date-picker.test.tsx`
- **Commit:** `601b9ad0`

**4. [Rule 3 - Blocking] `WorklogsPage.test.tsx` day-selection needed a more robust query than accessible-name matching**
- **Found during:** Task 2
- **Issue:** The plan's suggested approach (match day buttons by accessible name, e.g. `/15 September 2026/`) is fragile once two DatePicker triggers with identical placeholder text exist side by side, and the accessible-name format itself (see deviation 3) needed re-deriving per date.
- **Fix:** Built `selectCalendarDay(triggerName, dateStr)` — opens the trigger via its `aria-label` (unambiguous even when both triggers show the same placeholder text), then locates the day cell via the stable `[role="gridcell"][data-day="YYYY-MM-DD"]` attribute (react-day-picker's `isoDate`), navigating months via the "Go to the Previous/Next Month" buttons by comparing the calendar's caption text against the target date. This is more robust than locale-formatted accessible-name matching and doesn't depend on the day-of-month test-run happens to execute on.
- **Files modified:** `taskflow/src/routes/worklogs/WorklogsPage.test.tsx`
- **Commit:** `8841bbb2`

None of these were architectural — all were test/type correctness fixes within the existing plan scope.

## Known Stubs

None. Every migrated call site is wired to its existing state/handlers; no placeholder or hardcoded-empty data was introduced.

## Checkpoint: Human Verification Required (BLOCKING — not completed by this executor)

The plan's final task is `type="checkpoint:human-verify" gate="blocking"`. Per the constraints for this run, **this checkpoint was NOT faked or auto-approved.** It requires a human to run the app and manually verify:

1. **Styling** — calendar matches the app's theme (neutral surface, app border radius, no browser-chrome look, no double padding).
2. **Worklogs filter bar** (`/worklogs` → Custom preset) — triggers align with the `h-7` preset pills; picking a from/to date refetches the range.
3. **NESTED POPOVER — highest risk** (research assumption A1, unverifiable in jsdom): Log Work popover and the Worklogs cell → Edit form popover must stay open when a day is clicked inside their nested date popover. If either closes on day-click, the documented fallback is an inline `<Calendar>` in those two panels (not applied here — only apply if the human check finds a problem).
4. **Clearable due date** — subtask due date set-then-cleared via the X must go back to empty and stay empty after save.
5. **Disabled** — Release edit modal date trigger unopenable while saving; same for a disabled subtask row.
6. **Off-by-one check** — picking today's date anywhere shows today, not yesterday/tomorrow.

**This plan is not complete until a human runs the app and reports the outcome of these six checks.** Do not mark this quick task as "Verified" without that report.

## Self-Check: PASSED

- `taskflow/src/lib/local-date.ts` — FOUND
- `taskflow/src/lib/local-date.test.ts` — FOUND
- `taskflow/src/components/ui/calendar.tsx` — FOUND
- `taskflow/src/components/ui/date-picker.tsx` — FOUND
- `taskflow/src/components/ui/date-picker.test.tsx` — FOUND
- Commit `601b9ad0` — FOUND
- Commit `8841bbb2` — FOUND
- Commit `3f7cc399` — FOUND
