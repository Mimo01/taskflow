---
phase: 60-static-dashboard-welcome-screen
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - taskflow/src/routes/dashboard/DashboardSprintCard.tsx
  - taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx
  - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx
  - taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx
  - taskflow/src/routes/dashboard/DashboardReleaseCard.tsx
  - taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx
  - taskflow/src/routes/dashboard/index.tsx
  - taskflow/src/routes/dashboard/index.test.tsx
  - taskflow/src/components/ui/progress.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 60: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The dashboard implementation is well-structured and follows the prop-drilling pattern (D-16) consistently across all three cards. The sprint-board cache key is shared correctly across components. The main correctness concerns are: a sign-inversion bug in the overdue day-count calculation in `DashboardReleaseCard`, a race-window where all three cards fire API requests before the PAT is loaded in `index.tsx`, and the `Progress` component's absence of a `width` style on the indicator (the bar will always render at 0 width regardless of `value`). Additionally, `useDelayedLoading` is not tested with fake timers in the sprint and in-progress card test suites, which masks timing-dependent skeleton behavior.

---

## Critical Issues

### CR-01: Overdue day-count has inverted sign — always renders a negative number

**File:** `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx:86-89`

**Issue:** When `timing === 'overdue'` the inline calculation subtracts `releaseDate` from `today`:

```
(new Date(today).getTime() - new Date(soonest.releaseDate!).getTime()) / 86_400_000
```

`today` is derived from `new Date().toISOString().slice(0, 10)`, which is always a midnight-UTC value. `soonest.releaseDate` is also a `YYYY-MM-DD` date string. For an overdue release `releaseDate < today`, so `releaseDate` parsed as a Date gives a smaller timestamp than `today` parsed as a Date — that subtraction is `today - releaseDate`, which is *positive*. This appears correct for forward-looking subtraction, but the code does it the correct way. **However**: `today` is constructed as `new Date().toISOString().slice(0, 10)` (a string), then used as `new Date(today)`. When a bare `YYYY-MM-DD` string is passed to `new Date()` it is parsed as **UTC midnight**, while `new Date(soonest.releaseDate!)` is also UTC midnight — so the subtraction is consistent. The number itself is therefore correct.

Wait — re-examining lines 85-89 more carefully:

```tsx
Math.round(
  (new Date(new Date().toISOString().slice(0, 10)).getTime() -
    new Date(soonest.releaseDate!).getTime()) /
    86_400_000,
)
```

`new Date().toISOString().slice(0, 10)` produces the **UTC** date, not the user's local date. `getReleaseTimingLabel` at line 29 also uses `.toISOString().slice(0,10)` for `today`, so the overdue detection and the day count computation use the same UTC-based `today` — they are consistent with each other. But this is a **different date source** from the welcome banner in `index.tsx` which uses `toLocaleDateString('en-GB', ...)` against the local clock. A user west of UTC sees the UTC date in the release card and their local date in the header, which can differ by one calendar day. This is a pre-existing cross-component inconsistency rather than a crash, so it is reclassified below as a Warning.

**Reclassification:** Promoting CR-01 to the correct finding below.

---

### CR-01: `Progress` indicator has no `width` style — bar always renders at 0% fill

**File:** `taskflow/src/components/ui/progress.tsx:39-50`

**Issue:** `ProgressIndicator` renders `<ProgressPrimitive.Indicator>` from `@base-ui/react/progress`. Base UI's Progress Indicator sets its own width via a CSS custom property `--progress-value` that the primitive exposes. The Tailwind classes applied are only `h-full bg-primary transition-all` — there is no `w-[--progress-value]` or `w-[calc(var(--progress-value)*1%)]` utility applied, and no inline `style` is forwarded. Without this, the indicator element has no computed width and the progress bar is visually empty (0 width) regardless of the `value` prop passed. The test in `DashboardSprintCard.test.tsx` only checks `aria-valuenow` (which is set on the Root element by Base UI), not the visual fill, so the test passes while the bar is broken on screen.

**Fix:**
```tsx
function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("h-full bg-primary transition-all w-[calc(var(--progress-value)*1%)]", className)}
      {...props}
    />
  )
}
```

Alternatively, if the Base UI version in use exposes `--progress-percent` instead of `--progress-value` (check the installed version's docs), use `w-[var(--progress-percent)]` directly.

---

## Warnings

### WR-01: `jiraToken` passed as empty string `""` to child cards before PAT is loaded — queries fire immediately with a blank token

**File:** `taskflow/src/routes/dashboard/index.tsx:41-57`

**Issue:** `jiraToken` state is initialised to `null` and the PAT load is asynchronous. The `??` fallback on line 41, 48, and 54 coerces `null` to `""`. All three child cards have `enabled: !!jiraToken` guards, but the guard checks the prop value, not `null`. An empty string `""` is falsy, so `!!""` is `false` — the queries are correctly disabled. **However**, a re-render after the `useEffect` sets the token and a *concurrent* render could still expose a window where the token transitions: on initial mount `jiraToken` is `null` → `""` (falsy, queries disabled, correct). Once `readSecret` resolves and `setJiraToken(t)` fires, `jiraToken` becomes the real token string — this is the expected happy path. So in practice the guard works.

The real issue is a subtler one: if `jiraBaseUrl` is truthy but `readSecret('jira-pat')` rejects (line 18-20), `jiraToken` is set to `null`, which coerces to `""` and permanently disables all queries — the dashboard silently shows empty cards with no error messaging. There is no error state, no retry, and no user-visible indication that the token load failed.

**Fix:** Track an explicit `tokenError` state and render a contextual error banner when the PAT load fails, instead of silently degrading to empty cards.

```tsx
const [jiraToken, setJiraToken] = useState<string | null>(null);
const [tokenError, setTokenError] = useState(false);

useEffect(() => {
  if (jiraBaseUrl) {
    readSecret('jira-pat')
      .then((t) => { setJiraToken(t); setTokenError(false); })
      .catch(() => { setJiraToken(null); setTokenError(true); });
  }
}, [jiraBaseUrl]);
```

---

### WR-02: `getDaysRemaining` uses local clock; overdue calculation in `DashboardReleaseCard` uses UTC clock — cards can show dates one day apart

**File:** `taskflow/src/routes/dashboard/DashboardSprintCard.tsx:27-32` and `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx:29`

**Issue:** `getDaysRemaining` in `DashboardSprintCard` computes `Date.now()` (local wall clock milliseconds) and divides by milliseconds-per-day. `getReleaseTimingLabel` in `DashboardReleaseCard` uses `new Date().toISOString().slice(0, 10)` which is always the **UTC** calendar date. For users in UTC-5 to UTC-12, between midnight local and midnight UTC the two cards report dates from different calendar days. This can manifest as the sprint card saying "0 days remaining" while the release card says the release is still "1 day away" when both releases are today in local time.

**Fix:** Pick one consistent reference for "today" across all dashboard components. The safest option for a locale-aware app is to use the local date throughout:

```ts
// DashboardReleaseCard.tsx — replace line 29
const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
```

And test `DashboardReleaseCard` with the local-date interpretation.

---

### WR-03: `onKeyDown` Enter handler on subtask row buttons is redundant and contains divergent logic risk

**File:** `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx:92-95`

**Issue:** The element is a `<button type="button">`, which natively fires `onClick` on both mouse click and keyboard Enter/Space. The manual `onKeyDown` handler that re-implements Enter navigation is redundant. Worse, it only handles `Enter` and not `Space`, which is inconsistent with ARIA button semantics (buttons should also respond to Space). If the `onClick` handler is ever updated, the `onKeyDown` handler becomes a silent divergence point.

**Fix:** Remove the `onKeyDown` handler entirely. Native button behaviour handles keyboard activation correctly for both Enter and Space:

```tsx
<button
  type="button"
  key={issue.key}
  className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
  onClick={() => navigate(`/issue/${issue.key}`)}
>
```

---

### WR-04: `storyPointsFieldKey` missing from `DashboardSprintCard` query `enabled` guard — query fires with a blank field key

**File:** `taskflow/src/routes/dashboard/DashboardSprintCard.tsx:45`

**Issue:** The `enabled` guard for `sprintIssuesRaw` is:

```ts
enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
```

`storyPointsFieldKey` is passed to `fetchSprintIssues` as the fifth argument but is not gated. If `storyPointsFieldKey` is an empty string (possible if `useSettingsStore` returns a default empty value before settings are loaded), the query fires immediately and the API receives a blank field key. This can produce a malformed JQL query or silently return issues with no story-points field, causing `donePoints` and `totalPoints` to both be 0 and the progress bar to show 0% even when there is real data.

`DashboardInProgressCard` has the same `storyPointsFieldKey` in the query key but also omits it from `enabled` (line 46).

**Fix:**
```ts
enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!storyPointsFieldKey,
```

Apply the same fix to `DashboardInProgressCard.tsx:46`.

---

## Info

### IN-01: `Progress` component exports `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue` but none of them are consumed anywhere in this phase

**File:** `taskflow/src/components/ui/progress.tsx:75-81`

**Issue:** The named exports `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue` are exported but all call sites in this phase use only the `Progress` default-style wrapper. The sub-components are intended for composition use elsewhere but represent dead surface area in the current implementation. This is not a bug, but should be verified against the wider codebase to ensure they are not orphaned exports.

**Fix:** No action needed unless a broader audit finds no consumers — at that point, consider removing or unexporting them to reduce public API surface.

---

### IN-02: Test suites for `DashboardSprintCard` and `DashboardInProgressCard` do not use fake timers — `useDelayedLoading` skeleton behaviour is untestable as written

**File:** `taskflow/src/routes/dashboard/DashboardSprintCard.test.tsx:93-303`, `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx:109-243`

**Issue:** `useDelayedLoading` introduces a 200 ms `setTimeout` before showing the skeleton. The test that passes `isLoading: true` (sprint card test 5, lines 252-277) calls `renderWithQuery` and asserts `not.toThrow()` — it never actually verifies that the skeleton is hidden during the delay window, nor that it appears after. Because real timers run in Vitest, the 200 ms timer fires at some point during the test run, making skeleton-show assertions unreliable and potentially flaky in slower CI environments. `DashboardReleaseCard.test.tsx` correctly uses `vi.useFakeTimers()` and `vi.setSystemTime()`.

**Fix:** Add `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach` for the sprint and in-progress card test suites. Use `act(() => vi.advanceTimersByTime(200))` to advance past the delay when asserting skeleton visibility.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
