---
phase: 260616-igl-on-standup-notes-page-in-the-yesterday-d
reviewed: 2026-06-16T00:00:00Z
depth: quick
files_reviewed: 2
files_reviewed_list:
  - taskflow/src/lib/standup-date.ts
  - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 260616-igl: Code Review Report

**Reviewed:** 2026-06-16
**Depth:** quick
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed the addition of `getTodayDate()` to `standup-date.ts` and the "Today" wiring in
`YesterdayColumn.tsx` (heading special-case + prepended "· Today" dropdown row).

**Timezone safety: PASS.** `getTodayDate()` correctly delegates to `toLocalDateString(new Date())`
and never touches `toISOString()`, honoring the file's standing rule. The `getColumnHeading`
"Today" branch reuses the same helper.

**Duplicate-row safety: PASS.** The two `unshift` guards (`resolvedYesterday`, then `today`) each
check `includes()`, and `resolveYesterdayDate` starts at today−1, so `today` and `resolvedYesterday`
never collide into an exact duplicate row under normal operation.

**Revert-to-default interaction: PASS.** Selecting "Today" yields `v !== resolvedYesterday`, so
`onSelectDate(today)` fires correctly (not the `null` revert path); selecting the default row still
reverts. No regression there.

The two warnings below concern the `dayOptions` useMemo dependency array (the specific concern
flagged) and a label-ordering inconsistency between the "Today" tag and the default-row tag.

## Warnings

### WR-01: `dayOptions` useMemo omits `today`/`yesterdayDate` from deps — stale across midnight

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:577-599`
**Issue:** The memo calls `getTodayDate()` (and `buildRecentDayOptions(14)`) internally but its
dependency array is only `[resolvedYesterday]`. Both helpers read `new Date()`, so they are impure
relative to wall-clock time. If the page stays mounted across a midnight boundary, the memo will not
recompute: the row labelled "· Today" keeps pointing at the *previous* day, and a freshly-resolved
`yesterdayDate`/`resolvedYesterday` value can fail to match any rendered radio row (the
`value={yesterdayDate}` on the `DropdownMenuRadioGroup` then has no selected item). This is the exact
dependency-array concern raised in the task. It is latent rather than catastrophic (long-lived
standup tabs across midnight), and pre-existing code already had the same `buildRecentDayOptions`
staleness — but the new `today` prepend widens the surface (the top row is now explicitly
time-relative and user-selectable).
**Fix:** Either compute `today` once at the call site and add it to the deps, or accept the documented
staleness with an explicit comment. Minimal version:
```tsx
const today = getTodayDate();
const dayOptions = useMemo(() => {
  const dates = buildRecentDayOptions(14);
  if (resolvedYesterday && !dates.includes(resolvedYesterday)) dates.unshift(resolvedYesterday);
  if (!dates.includes(today)) dates.unshift(today);
  // ...map...
}, [resolvedYesterday, today]);
```
Hoisting `today` to a `const` outside the memo and listing it as a dep makes the staleness explicit
and lets the memo recompute when the date actually rolls over (on the next render after midnight).

### WR-02: "Today" tag placement is inconsistent with the surrounding code comment / default-row tag

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:592-597`
**Issue:** The comment on line 592 says "Today row: date first, then the tag — consistent with regular
rows," and the code produces `` `${dateLabel} · Today` ``. That is fine on its own. However the
default row (line 597) produces `` `${dateLabel} · ${tag}` `` where `tag` is "Yesterday" / "Last
working day". When `resolvedYesterday` is genuinely calendar-yesterday and the user has navigated such
that *both* a "Today" row and a "Yesterday" row are present, the two tag styles read consistently —
good — but note the `today === resolvedYesterday` edge (only reachable if `resolveYesterdayDate` ever
returns today, e.g. a future change or a 14-iteration safety-cap fallback that lands on today): the
`if (date === today)` branch wins and the row would render "· Today" while the radio default-revert
logic still treats that same date as `resolvedYesterday`. The label would then say "Today" but
selecting it triggers `onSelectDate(null)` (revert), which is a confusing mismatch.
**Fix:** Guard the today branch against the default collision, or assert the invariant. e.g.:
```tsx
if (date === today && today !== resolvedYesterday) return { date, label: `${dateLabel} · Today` };
```
so that if the two ever coincide the row falls through to the default-tag branch and its label matches
the revert behavior.

## Info

### IN-01: `getColumnHeading` recomputes `getTodayDate()` on every call

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:118-128`
**Issue:** `getColumnHeading` now calls `getTodayDate()` (which allocates a `new Date()` and formats
it) on each invocation. It is called from `generateMarkdown`, the JSX heading (line 664), and the
dropdown tag computation (line 596) — several times per render. Not a correctness problem (out of
v1 perf scope) but the today-string could be computed once and threaded in.
**Fix:** Optional — accept an already-resolved `today` parameter, or memoize at the call sites that
already have `getTodayDate()` in scope (the `dayOptions` memo already computes `today`).

### IN-02: Comment claims "consistent with regular rows" but regular rows have no tag

**File:** `taskflow/src/routes/standup-notes/YesterdayColumn.tsx:592`
**Issue:** The inline comment "date first, then the tag — consistent with regular rows" is slightly
misleading: regular rows (line 594) render `dateLabel` with *no* tag at all. The "Today" and default
rows are the only tagged rows. Minor doc-accuracy nit copied from the default-row comment.
**Fix:** Reword to "date first, then the tag — consistent with the default row's format."

---

_Reviewed: 2026-06-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
