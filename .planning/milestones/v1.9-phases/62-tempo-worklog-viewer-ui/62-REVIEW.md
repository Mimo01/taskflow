---
phase: 62-tempo-worklog-viewer-ui
reviewed: 2026-05-21T15:15:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/components/app/Sidebar.test.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/components/app/sidebar-items.ts
  - taskflow/src/routes/routes.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.tsx
  - taskflow/src/stores/settings.store.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 62: Code Review Report

**Reviewed:** 2026-05-21T15:15:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Seven files reviewed for the Tempo Worklog Viewer UI phase. The implementation is structurally sound — the route wiring, store migration, sidebar gate, and pivot-table logic are all correct at the macro level. Two blockers are present: a timezone bug in `enumerateDays` that mis-generates column keys on any system running east of UTC, and a dateStarted key mismatch in the pivot table that silently blanks all data cells if the service layer normalization ever produces a non-YYYY-MM-DD value. Four warnings cover a timer leak on unmount, a stale-data/error precedence inversion, a hardcoded `visible: true` in the migration, and a phantom item id in the test fixture. Two info items cover minor quality issues.

---

## Critical Issues

### CR-01: `enumerateDays` emits wrong dates for users east of UTC (timezone bug)

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:57-64`

**Issue:** `enumerateDays` creates each day as `new Date('${from}T00:00:00')` (local midnight), then calls `.toISOString().slice(0, 10)` to push to the array. `toISOString()` returns UTC. On a system with a positive UTC offset (UTC+1 through UTC+14 — most of Europe, Asia, Africa, Oceania), local midnight is still the previous calendar day in UTC. For example on UTC+2, `new Date('2026-05-18T00:00:00').toISOString()` is `2026-05-17T22:00:00.000Z`, so `.slice(0, 10)` yields `2026-05-17`. Every column in the pivot table is one day behind the actual column header (computed separately by `formatDayHeader`), meaning no row ever matches a column and the entire table renders as blank cells.

This is the exact pitfall called out in the comment above `formatDayHeader` (line 44: "avoid timezone-shift bugs") but the pattern was not applied to `enumerateDays`. The day-iteration variable `d` is initialized at local midnight and must be advanced and serialized in local-date terms, not via UTC conversion.

**Confirmed:** On the dev machine (UTC+2), `new Date('2026-05-18T00:00:00').toISOString().slice(0,10)` returns `'2026-05-17'`.

**Fix:** Advance the date using local date methods and format by padding the local year/month/day components — the same technique used in Phase 61 service layer:

```typescript
function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end) {
    // Use local date components, not UTC (toISOString returns UTC and shifts date east of UTC)
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${mo}-${da}`);
    d.setDate(d.getDate() + 1);
  }
  return days;
}
```

The same UTC-conversion mistake affects `getLastWorkingDay` (line 125: `d.toISOString().slice(0, 10)`), `getThisWeekRange` (line 77–78), `getLastWeekRange` (line 88–91), `getThisMonthRange` (line 99–100), and `getLastMonthRange` (line 110–112) — all use `toISOString().slice(0, 10)` on a `Date` object that holds local midnight. All of those from/to strings should also be formatted using local date components.

---

### CR-02: Pivot table silently loses data if `dateStarted` is not strict YYYY-MM-DD

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:236`

**Issue:** The pivot map builds `dayMap` using `w.dateStarted` as the key directly:

```typescript
entry.dayMap.set(w.dateStarted, (entry.dayMap.get(w.dateStarted) ?? 0) + w.timeSpentSeconds);
```

The `enumerateDays` function (even after the CR-01 fix) produces strings like `"2026-05-18"`. If `dateStarted` arrives from the service layer as anything other than exactly that format — for example `"2026-05-18T00:00:00"` (full ISO) or `"2026-05-18T00:00:00+02:00"` — the `dayMap.get(day)` lookup on line 468 returns `undefined` for every cell, and the entire table renders blank. This is a silent data loss with no error.

`types.ts` documents that `fetchWorklogs` normalizes to YYYY-MM-DD via `slice(0, 10)`, but this component relies entirely on that contract without any defense. If the normalization is removed or the service is called through a different path, the failure mode is invisible.

**Fix:** Explicitly normalize `dateStarted` in the pivot loop:

```typescript
for (const w of data ?? []) {
  const name = w.author.name;
  const dateKey = w.dateStarted.slice(0, 10); // normalize to YYYY-MM-DD defensively
  if (!pivotMap.has(name)) {
    pivotMap.set(name, { displayName: w.author.displayName ?? name, dayMap: new Map(), total: 0 });
  }
  const entry = pivotMap.get(name)!;
  entry.dayMap.set(dateKey, (entry.dayMap.get(dateKey) ?? 0) + w.timeSpentSeconds);
  entry.total += w.timeSpentSeconds;
}
```

---

## Warnings

### WR-01: `closeTimer` ref is not cleaned up on unmount — stale-state call on unmounted component

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:154,266-268`

**Issue:** The 150ms blur-close timer on line 267 (`closeTimer.current = setTimeout(() => setOpen(false), 150)`) is never cleared in a `useEffect` cleanup. If the component unmounts while the timer is pending (e.g., user navigates away immediately after blurring the combobox), the `setOpen(false)` call fires on an unmounted component. React 18 no longer throws for this, but it can still cause unexpected behavior (e.g., if the component has remounted at a different location with shared state) and logs a development-mode warning in some environments.

**Fix:** Add a cleanup effect:

```typescript
useEffect(() => {
  return () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
}, []);
```

---

### WR-02: Error state hidden when stale empty data is cached during a network error

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:393-431`

**Issue:** The render-branch order is:

```typescript
{isError && !data ? (
  <ErrorState ... />
) : isLoading && !data ? (
  <Skeleton ... />
) : data?.length === 0 ? (
  <EmptyState ... />
) : (
  <table .../>
)}
```

If the query returns an empty array `[]`, TanStack Query caches `data = []`. On a subsequent background refetch that fails, `isError` becomes `true` but `data` is still `[]` (not null/undefined). The `isError && !data` guard is falsy (`![]` is `false`), so the error is silently swallowed and the component renders the "No worklogs found" EmptyState. The user sees no indication that a network error occurred and may not realize their data is stale.

**Fix:** Check `isError` independently of data presence:

```typescript
{isError ? (
  <ErrorState error={error} onRetry={refetch} viewName="worklogs" />
) : isLoading && !data ? (
  <Skeleton ... />
) : data?.length === 0 ? (
  <EmptyState ... />
) : (
  <table ... />
)}
```

If the intent is stale-while-error (show stale table + banner), that should be an explicit in-table warning strip, not an accidental fallthrough.

---

### WR-03: `appendWorklogsItemIfMissing` hardcodes `visible: true` for all upgrading users

**File:** `taskflow/src/stores/settings.store.ts:174-177`

**Issue:** The migration for version 21 calls `appendWorklogsItemIfMissing` which adds `{ id: 'worklogs', visible: true }`. The analogous `appendAioItemIfMissing` (version 16) does the same. This means every user upgrading from store version ≤ 20 will have the Worklogs item injected with `visible: true` regardless of their previous sidebar customizations. For a PM user who has previously hidden all "Tracking" items, the Worklogs link will re-appear in their sidebar (albeit still gated by the `tempoEnabled` store flag in the Sidebar filter).

The `visible: true` default is inconsistent with the preset logic: `getDefaultSidebarItems('dev')` includes `worklogs` visible, but `getDefaultSidebarItems('pm')` also includes it visible — so defaulting to `true` is consistent with presets. The real concern is for users who had previously hidden the item (impossible here since it's a new item, so this is actually fine semantically). However, there is a subtler issue: if a user is on store version 20 and already somehow has a `worklogs` item in their `sidebarItems` (from a future downgrade/restore scenario), the guard `if items.some(i => i.id === 'worklogs')` returns early, preserving whatever visibility they had. This is correct. The only concern is a cosmetic one for new items being `visible: true` by default which matches the existing pattern.

**Revised severity:** The actual defect is the precedent established by both helpers always defaulting to `visible: true` without consulting the user's role. A PM who disables an entire section would have new items re-appear. This is low-impact because `tempoEnabled` gates rendering, but it is a state inconsistency worth documenting.

**Fix:** Use the user's current role to determine the default visibility:

```typescript
function appendWorklogsItemIfMissing(items: SidebarItem[], role?: string | null): SidebarItem[] {
  if (items.some((i) => i.id === 'worklogs')) return items;
  // Default to visible=true (matches both dev and pm presets)
  return [...items, { id: 'worklogs', visible: true }];
}
```

Since both presets include `worklogs` visible, this is actually a no-op change — but document the intent explicitly in the migration comment.

---

### WR-04: Sidebar test fixture contains phantom item id `'workload'`

**File:** `taskflow/src/components/app/Sidebar.test.tsx:79`

**Issue:** The `sidebarItems` mock array at line 71-83 includes `{ id: 'workload', visible: true }`. There is no `'workload'` item in `SIDEBAR_NAV_ITEMS` (sidebar-items.ts). The valid tracking item is `'worklogs'` (which is also present at line 81). The `'workload'` entry will be in `visibleIds` inside Sidebar.tsx but will never match any `SIDEBAR_NAV_ITEMS` entry, so it is silently ignored. This phantom id does not cause a test failure but it indicates a copy-paste error and creates misleading state in the fixture — reviewers and future maintainers may assume `'workload'` is a real item.

**Fix:** Remove the stale entry:

```typescript
// Before:
{ id: 'workload', visible: true },
{ id: 'worklogs', visible: true },

// After:
{ id: 'worklogs', visible: true },
```

---

## Info

### IN-01: `getLastWorkingDay` and all preset helpers use `toISOString().slice(0,10)` on non-UTC dates (style consistency with fix for CR-01)

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:119-126`

**Issue:** Even after fixing CR-01, the `getLastWorkingDay`, `getThisWeekRange`, `getLastWeekRange`, `getThisMonthRange`, and `getLastMonthRange` functions all produce from/to date strings by calling `.toISOString().slice(0, 10)` on `Date` objects that hold a local-time value (not UTC midnight). On a UTC+2 machine, `new Date()` at noon gives `.toISOString()` as `T10:00Z` which is still the same date, so the slice is correct during daytime hours. But at `00:00–01:59` local time the UTC date is still the previous day, so the `from`/`to` boundaries would be one day off.

This is lower-impact than CR-01 (affects only the boundary hours of each day), but for consistency all five helpers should use local-date component formatting as described in the CR-01 fix. Extract a helper:

```typescript
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
```

---

### IN-02: `WorklogsPage` test file uses raw `setTimeout` promises instead of `vi.useFakeTimers`

**File:** `taskflow/src/routes/worklogs/WorklogsPage.test.tsx:192,200`

**Issue:** Two test cases (lines 192 and 200) use `await new Promise((r) => setTimeout(r, 50))` to "wait and assert no call was made." This is a real 50ms sleep in the test runner, making the suite unnecessarily slow and theoretically flaky if CI load causes the reaction to take more than 50ms. Since the test is only asserting that a call count has *not* increased, `waitFor` with a negation or `vi.useFakeTimers` + `vi.advanceTimersByTime` would be both faster and more deterministic.

**Fix:** Use fake timers for the "should NOT fetch" assertion:

```typescript
// In describe block:
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

// In test:
vi.advanceTimersByTime(50);
expect((fetchWorklogs as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
```

---

_Reviewed: 2026-05-21T15:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
