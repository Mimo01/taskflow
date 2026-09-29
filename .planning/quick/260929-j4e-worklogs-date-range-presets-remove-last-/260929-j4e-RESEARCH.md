# Quick Task 260929-j4e: Worklogs date range presets - Research

**Researched:** 2026-09-29
**Domain:** Local-date range math, zustand persist migration, vitest fake timers
**Confidence:** HIGH (everything verified by codebase grep/read; no external packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rolling 7-day range: includes today: from = today - 6 days, to = today (7 calendar days inclusive).
- Rolling month range: from = the same day-of-month one month ago, to = today (e.g. 2026-08-29 -> 2026-09-29). If that day doesn't exist in the previous month (e.g. today = 31 Mar), clamp to the last day of the previous month (-> 28/29 Feb). Must not overflow into the current month (JS `setMonth` overflow pitfall). Uses local dates via existing `localISO()` helper, like the other presets.
- Pill order: This Week · Last 7 Days · This Month · Last Month · Custom
- Saved filters (persisted `tempo-filters.store.ts`): any saved filter whose `preset` is a removed id (`last-week`, `last-month`, `last-working-day`) falls back to `this-week`. Must be robust: loading such a filter must never leave `from/to` undefined (the `useMemo` switch has no default today -> destructuring crash). Implement via persisted-store migration (zustand persist `version` + `migrate`) and/or a defensive normalize on load.

### Claude's Discretion
- Preset ids: `last-7-days` and `last-month-to-date` (new ids — do NOT reuse `last-month`).
- Labels: "Last 7 Days" and "Last Month".
- Remove dead helpers (`getLastWeekRange`, `getLastMonthRange`, `getLastWorkingDay`) from WorklogsPage.tsx.
- Update `DatePreset` union in `src/services/tempo/types.ts`.
- Update WorklogsPage tests and add unit coverage for new range functions incl. month-end clamp.

### Out of scope
- Standup Notes' last-working-day logic (`src/lib/standup-date.ts`) must NOT be touched.
</user_constraints>

## Summary

Blast radius is small and fully contained: 3 source files + 2 test files. No other consumer of `DatePreset` or `TempoFilter` exists (`grep -rl "tempo-filters.store\|TempoFilter" src` -> only the store and WorklogsPage.tsx) [VERIFIED: grep]. The store is already zustand `persist` with `version: 1` and a pass-through `migrate` (tempo-filters.store.ts:49-54), so the fix is a version bump to 2 plus a real migrate, following the `pinned-tabs.store.ts:66-77` pattern. Because WorklogsPage tests mock the store (WorklogsPage.test.tsx:110) and bypass migrate, a component-level normalize is ALSO required for defense in depth.

**Primary recommendation:** Extract the range helpers + a `normalizeDatePreset()` into a new pure module `src/lib/worklog-date-ranges.ts` (functions take `today: Date = new Date()`), bump the store to `version: 2` with a mapping migrate, call `normalizeDatePreset` in `handleLoadFilter`, and add a `default:` branch to the `useMemo` switch returning `getThisWeekRange()`.

## Blast Radius (all references, verified by grep)

| File:line | What | Action |
|-----------|------|--------|
| `src/services/tempo/types.ts:51-57` | `DatePreset` union | Replace with `'this-week' \| 'last-7-days' \| 'this-month' \| 'last-month-to-date' \| 'custom'` |
| `src/routes/worklogs/WorklogsPage.tsx:138-140` | `localISO()` (private) | Move to lib or reuse `toLocalDateString` from `src/lib/local-date.ts` (identical body) |
| `WorklogsPage.tsx:142-213` | `getThisWeekRange`, `getLastWeekRange`, `getThisMonthRange`, `getLastMonthRange`, `getLastWorkingDay` | Delete the 3 dead ones; move keepers + new ones to lib |
| `WorklogsPage.tsx:253-260` | `DATE_PRESETS` array | New order/labels per locked decision |
| `WorklogsPage.tsx:345-362` | `useMemo` switch — no `default` | Replace cases; add `default: return getThisWeekRange();` |
| `WorklogsPage.tsx:727-732` | `handleLoadFilter` -> `setPreset(filter.preset)` | `setPreset(normalizeDatePreset(filter.preset))` |
| `src/stores/tempo-filters.store.ts:49-54` | `version: 1`, pass-through migrate | `version: 2`, map legacy presets |
| `WorklogsPage.test.tsx:5` | header comment "6 pills" | -> 5 pills |
| `WorklogsPage.test.tsx:234-243` | asserts 'Last Week', 'Last Working Day' labels | Assert 5 labels incl. 'Last 7 Days'; assert 'Last Week'/'Last Working Day' absent |
| `WorklogsPage.test.tsx:302` | `fireEvent.click(getByText('Last Week'))` | -> 'Last 7 Days' |
| `WorklogsPage.test.tsx:651` | `SAMPLE_FILTER.preset: 'last-month'` (will fail tsc) | -> `'last-month-to-date'`; test at L700-710 still clicks label 'Last Month' — still valid |
| `src/stores/tempo-filters.store.test.ts` | only uses 'this-week'/'this-month' | No change needed; add migrate test |

Not touched: `src/lib/standup-date.ts` (separate logic; no shared ids). No other routes/stores reference the ids.

## Persistence & Migration

- Store: zustand `persist` + `createTauriStorage('tempo-filters.json')` (Tauri LazyStore), `version: 1`, `migrate: (p) => p` [VERIFIED: tempo-filters.store.ts:47-54]. zustand only calls `migrate` when stored version !== current version, so bumping to 2 guarantees every existing user's file passes through it once.
- Recommended migrate (mirrors `pinned-tabs.store.ts:67-76` style):

```ts
version: 2,
migrate: (persisted, version) => {
  const s = persisted as TempoFiltersState;
  if (version < 2 && Array.isArray(s?.savedFilters)) {
    s.savedFilters = s.savedFilters.map((f) => ({ ...f, preset: normalizeDatePreset(f.preset) }));
  }
  return s;
},
```

- `normalizeDatePreset(p: unknown): DatePreset` — returns `p` if it's in the valid-id set, else `'this-week'`. Covers removed ids AND any future garbage. Put it in the lib module so store + page share it (store must not import from route components — see comment at types.ts:46-50, CLEAN-04).
- Testing migrate: existing precedent extracts it via `store.persist.getOptions().migrate` (subtask-templates.store.test.ts:156-170). Call `migrate({ savedFilters: [{...preset:'last-week'}, {...preset:'last-month'}, {...preset:'last-working-day'}, {...preset:'this-month'}] }, 1)` and assert `['this-week','this-week','this-week','this-month']`.
- Defense in depth: WorklogsPage.test.tsx mocks `useTempoFiltersStore` (L110) so migrate never runs there — the `handleLoadFilter` normalize + switch `default` is what protects the page (and what a page-level regression test exercises: `mockSavedFilters = [{...SAMPLE_FILTER, preset: 'last-week' as DatePreset}]`, click pill, expect 'This Week' has `bg-accent` and `fetchWorklogs` called with defined, non-empty from/to).
- TS note: with a `default` branch the switch stays type-valid; `preset` param is `DatePreset` so `default` is unreachable per types but reachable at runtime — add a short comment.

## Date Math (local time, DST-safe)

```ts
// src/lib/worklog-date-ranges.ts
import { toLocalDateString } from './local-date'; // identical to WorklogsPage localISO

export function getLast7DaysRange(today = new Date()) {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  return { from: toLocalDateString(from), to: toLocalDateString(today) };
}

export function getLastMonthToDateRange(today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const lastDayPrevMonth = new Date(y, m, 0).getDate(); // day 0 = last day of prev month
  const from = new Date(y, m - 1, Math.min(today.getDate(), lastDayPrevMonth));
  return { from: toLocalDateString(from), to: toLocalDateString(today) };
}
```

- Why: `d.setMonth(m - 1)` on 31 Mar yields "31 Feb" -> rolls to 3 Mar (overflow). Clamping the day BEFORE constructing avoids it. `new Date(y, -1, d)` correctly rolls to December of the previous year (Jan case). [CITED: ECMAScript MakeDay semantics — out-of-range month/day normalize; ASSUMED from training, but behavior is universally relied on and is already used at WorklogsPage.tsx:185-186]
- DST: constructing via `(y, m, d)` components (midnight local) and formatting via getFullYear/getMonth/getDate never does ms arithmetic, so DST transitions can't shift the day. Never use `toISOString()` (comment at WorklogsPage.tsx:133-137; local-date.ts:1-9).
- Taking `today` as a param makes unit tests deterministic without fake timers; still default to `new Date()` so the page calls them bare.

Test cases to cover (unit, `src/lib/worklog-date-ranges.test.ts`):
| today | last-7-days | last-month-to-date |
|-------|-------------|--------------------|
| 2026-09-29 | 2026-09-23 -> 09-29 | 2026-08-29 -> 09-29 |
| 2026-03-31 | 03-25 -> 03-31 | **2026-02-28** -> 03-31 (clamp) |
| 2028-03-31 (leap) | — | **2028-02-29** -> 03-31 |
| 2026-01-15 | — | **2025-12-15** -> 2026-01-15 (year wrap) |
| 2026-03-03 | **2026-02-25** -> 03-03 (month wrap) | 2026-02-03 -> 03-03 |
| 2026-05-31 | — | 2026-04-30 -> 05-31 (30-day month clamp) |
| 2026-03-29 (EU DST day) | 03-23 -> 03-29 | **2026-02-28** -> 03-29 (clamp; Feb 2026 has 28 days) |

Plus `normalizeDatePreset`: each valid id passes through; `'last-week'`, `'last-month'`, `'last-working-day'`, `undefined`, `'garbage'` -> `'this-week'`. Optionally also move/test `getThisWeekRange`/`getThisMonthRange` (currently untested).

## Test Conventions

- Vitest + jsdom + @testing-library/react. Time control precedent: `vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 5, 7, 10, 0, 0))` with `afterEach(vi.useRealTimers)` (standup-date.test.ts:20-27, 128). Prefer local-component `new Date(y, m, d, 10)` over `'...Z'` strings to avoid TZ flakiness.
- Pure lib modules with colocated `*.test.ts` is the established pattern (`src/lib/local-date.ts` + `.test.ts`, `standup-date.ts` + `.test.ts`). Route file keeps only UI; do NOT export helpers from WorklogsPage.tsx (it's a default-export route component).
- Do NOT use fake timers in WorklogsPage.test.tsx — it relies on `waitFor` + real timers; page-level tests only assert labels/active class/fetch count.

## Common Pitfalls

1. **setMonth overflow** — see Date Math; never `setMonth` on a day-of-month > 28.
2. **toISOString / `new Date('YYYY-MM-DD')`** — UTC shift; use local components only.
3. **Mocked store hides migration** — page tests won't catch a missing normalize; need both migrate test (store) and page normalize test.
4. **Switch without default** — `const { from, to } = undefined` crashes render; add default.
5. **Pre-commit hook** (`taskflow/.husky/pre-commit`: `biome check --staged ./src && tsc --noEmit && npm run test`) runs the FULL vitest suite + tsc. RED-only commits are blocked -> write failing test and implementation in the same commit per task. Also: changing the `DatePreset` union breaks tsc at WorklogsPage.test.tsx:651 until updated — update types, page, store and tests in the same commit.
6. **getByText ambiguity** — 'Last Month' label now belongs to `last-month-to-date`; saved-filter pill named 'Alice last month' is a different string (case-sensitive exact match), so L708 still resolves uniquely.

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | vitest (jsdom) |
| Quick run | `cd taskflow && npx vitest run src/lib/worklog-date-ranges.test.ts src/stores/tempo-filters.store.test.ts src/routes/worklogs/WorklogsPage.test.tsx` |
| Full suite | `cd taskflow && npm run test` (+ `npx tsc --noEmit`, `npx biome check ./src`) |

| Behavior | Test | File exists? |
|----------|------|--------------|
| 7-day / month-to-date ranges incl. clamp, year wrap, leap | unit | New: `src/lib/worklog-date-ranges.test.ts` |
| normalizeDatePreset | unit | New (same file) |
| Store migrate v1->v2 maps legacy presets | unit via `persist.getOptions().migrate` | Extend `src/stores/tempo-filters.store.test.ts` |
| 5 pills in order, removed labels absent | component | Update `WorklogsPage.test.tsx:234-243` |
| Legacy saved filter loads as This Week, fetch has valid from/to | component | New case in `WorklogsPage.test.tsx` TEMPO-05 block (~L700) |

## Security Domain

No new input surface; persisted-data migration is the only trust boundary (V5 input validation: normalize unknown preset values to a known default). No packages installed — Package Legitimacy Audit not applicable.

## Assumptions Log

| # | Claim | Risk if wrong |
|---|-------|---------------|
| A1 | `new Date(y, m, 0)` / negative month normalization per ECMAScript MakeDay | Very low — already used at WorklogsPage.tsx:185-186 and covered by the proposed unit tests |

## Sources
- Codebase: tempo-filters.store.ts, pinned-tabs.store.ts:63-77, subtask-templates.store.test.ts:156-170, WorklogsPage.tsx:133-362,705-732, WorklogsPage.test.tsx, types.ts:45-57, local-date.ts, standup-date.test.ts, taskflow/.husky/pre-commit
