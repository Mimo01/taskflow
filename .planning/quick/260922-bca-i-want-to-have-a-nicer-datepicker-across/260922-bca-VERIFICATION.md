---
phase: quick-260922-bca
verified: 2026-09-22T09:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Quick Task: Nicer DatePicker Across the App — Verification Report

**Task Goal:** I want to have a nicer datepicker across the app. The current one works but I dont like the style
**Verified:** 2026-09-22
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every date field in the app opens a styled calendar popover instead of the browser's native date input | ✓ VERIFIED | `grep -rn 'type="date"' src/` → 0 matches. All 6 call sites (`WorklogsPage.tsx` x2, `EditWorklogForm.tsx`, `SubtaskTemplateRow.tsx`, `EditReleaseModal.tsx`, `LogWorkPopover.tsx`) import and render `DatePicker` from `@/components/ui/date-picker`, which renders a `PopoverTrigger` + `Calendar` (react-day-picker v10, vendored shadcn base-nova styling) instead of a native input. |
| 2 | Picking a day stores the same calendar day the user clicked (no off-by-one across timezones) | ✓ VERIFIED | `src/lib/local-date.ts` `parseLocalDate`/`toLocalDateString` use local calendar components only (no `new Date(str)` / `toISOString().slice`). `local-date.test.ts` (16 tests) and `date-picker.test.tsx` TZ round-trip tests pass; re-ran `vitest run src/lib/local-date.test.ts src/components/ui/date-picker.test.tsx` — 59/59 pass. Human checkpoint item 6 (off-by-one) explicitly confirmed. |
| 3 | The trigger shows the currently selected date in a readable format, or a placeholder when empty | ✓ VERIFIED | `date-picker.tsx:71` — `{selected ? DISPLAY.format(selected) : placeholder}` using `Intl.DateTimeFormat`. Covered by `date-picker.test.tsx` render tests. |
| 4 | A subtask due date that was set can be cleared again (no regression vs native input's clear affordance) | ✓ VERIFIED | `SubtaskTemplateRow.tsx:381-388` passes `clearable`, `value={row.duedate ?? ''}`, `onChange={(v) => onChange({ duedate: v || null })}`. `date-picker.tsx` renders a sibling clear `<button data-slot="date-picker-clear">` when `clearable && selected`, calling `onChange('')`. Deviation #5 in SUMMARY (deselect-click crash) was found and fixed (`01e9da4a`) so non-clearable sites don't emit `''`. Human checkpoint item 4 confirmed clear-then-save persists empty. |
| 5 | Disabled date fields (saving release, disabled subtask row) cannot be opened | ✓ VERIFIED | `EditReleaseModal.tsx:93-97` passes `disabled={isSaving}`; `SubtaskTemplateRow.tsx:386` passes `disabled={isDisabled}`. `date-picker.tsx:59` forwards `disabled` to `PopoverTrigger`, which uses `buttonVariants` (`disabled:pointer-events-none disabled:opacity-50`). Human checkpoint item 5 confirmed both cannot be opened while disabled. |
| 6 | The date pickers inside LogWorkPopover and the worklog cell popover work without dismissing their parent popover | ✓ VERIFIED (human-confirmed, jsdom-unverifiable per plan's own threat model) | `LogWorkPopover.tsx:135` and `EditWorklogForm.tsx:114` both render `DatePicker` inside an already-open outer `PopoverContent`. `date-picker.tsx` leaves `modal` unset on the inner `Popover` and sets `initialFocus={false}` on the inner `PopoverContent`, per plan design. Plan's own RESEARCH.md flagged this as unverifiable in jsdom (assumption A1) — human checkpoint item 3 explicitly exercised this and confirmed outer popovers stay open; final "approved" sign-off recorded in SUMMARY.md. |
| 7 | No `<input type="date">` remains in src/ | ✓ VERIFIED | `grep -rn 'type="date"' src/` returns 0 matches (re-run directly against the live tree, not the SUMMARY's claim). |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/lib/local-date.ts` | `parseLocalDate`/`toLocalDateString`, local-calendar-component conversion | ✓ VERIFIED | Exists, exports both functions, implementation matches spec (no UTC-shift bugs). |
| `taskflow/src/components/ui/calendar.tsx` | Tailwind-styled react-day-picker wrapper | ✓ VERIFIED | Exists (7772 bytes), contains `DayPicker`. |
| `taskflow/src/components/ui/date-picker.tsx` | Shared `DatePicker`, YYYY-MM-DD string in/out | ✓ VERIFIED | Exists, exports `DatePicker` and `DatePickerProps`; `onChange` always emits string per `toLocalDateString`/`''`. |
| `taskflow/src/components/ui/date-picker.test.tsx` | Unit coverage: render/open/select/clear/disabled/TZ | ✓ VERIFIED | Exists, 7 tests, all passing (re-run). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `date-picker.tsx` | `calendar.tsx` | `import { Calendar } from '@/components/ui/calendar'` | ✓ WIRED | Line 4 |
| `date-picker.tsx` | `local-date.ts` | `parseLocalDate`/`toLocalDateString` | ✓ WIRED | Line 6, used at lines 30-31, 52, 77, 80-81, 88 |
| `WorklogsPage.tsx` | `date-picker.tsx` | `import { DatePicker }` | ✓ WIRED | Line 39, used at lines 898 and 906 with `aria-label` and setters wired to `customFrom`/`customTo` state |
| `WorklogsPage.test.tsx` | date-picker trigger DOM | `data-slot` query | ✓ WIRED | Test suite passes (re-run: 3 files / 59+ tests including WorklogsPage.test.tsx, all green) |

Additional wiring checked beyond the declared key_links (all four remaining call sites):
- `EditWorklogForm.tsx:114` — `DatePicker` wired to `date`/`setDate`
- `SubtaskTemplateRow.tsx:381` — wired to `row.duedate`/`onChange`, `clearable`, `disabled={isDisabled}`
- `EditReleaseModal.tsx:93` — wired to `editDate`/`setEditDate`, `disabled={isSaving}`
- `LogWorkPopover.tsx:135` — wired to `date`/`setDate`

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Local-date + DatePicker unit suite | `npx vitest run src/lib/local-date.test.ts src/components/ui/date-picker.test.tsx src/routes/worklogs/WorklogsPage.test.tsx` | 3 files, 59 tests passed | ✓ PASS |
| No native date input in src/ | `grep -rn 'type="date"' src/` | 0 matches | ✓ PASS |
| No date-fns dependency | `grep -n "date-fns" package.json` | 0 matches | ✓ PASS |
| Type-check | `npx tsc --noEmit` | clean, no output | ✓ PASS |
| Biome on phase-touched files | `npx biome check <12 files>` | "Checked 12 files ... No fixes applied." (0 errors) | ✓ PASS |

Note: `npm run check` (full-repo biome) reports 1 error / 40 warnings, but scoping biome to only the files this phase modified shows zero issues — the repo-wide errors are in unrelated pre-existing files (`MyTasksPage.test.tsx`, `IssueDetailPage.progressive.test.tsx`), consistent with the known baseline-drift pattern (biome diagnostics count drifts repo-wide independent of any single phase; see project memory). Not a regression introduced by this task.

### Anti-Patterns Found

None. Scanned `date-picker.tsx`, `local-date.ts`, `calendar.tsx`, and all 6 call sites for TODO/FIXME/HACK/placeholder/stub patterns — none found. No hardcoded empty returns; `onChange` always resolves to a real string or `''` via explicit `clearable`-gated logic (not an unconditional stub).

### Human Verification Required

None outstanding — the plan's blocking `checkpoint:human-verify` task was executed, all six checks passed per SUMMARY.md's checkpoint-resolution note, two styling issues found during checkpoint (trigger width, clear-icon vertical centering) were fixed and re-verified, and final "approved" sign-off was given. Verified directly in code that both fixes are present: `date-picker.tsx:64` (`'w-full min-w-0 justify-start font-normal'`) and `date-picker.tsx:100` (`'absolute top-1/2 right-1.5 -translate-y-1/2 ...'`).

### Gaps Summary

No gaps. All 7 must-have truths verified directly against the live codebase (not solely from SUMMARY.md claims): grep confirmed zero native date inputs and zero date-fns dependency, all 6 call sites read and confirmed wired to their real state/handlers with correct `clearable`/`disabled` props, the deselect-click regression fix and both checkpoint-driven styling fixes are present in the current `date-picker.tsx`, and the full relevant test suite (local-date, date-picker, WorklogsPage) re-ran green along with a clean `tsc --noEmit` and clean biome check scoped to this phase's files.

---

_Verified: 2026-09-22_
_Verifier: Claude (gsd-verifier)_
