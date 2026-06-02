# Phase 76: Visual Polish and Shared Primitives - Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 10 (4 new, 6 modified)
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/lib/issueDisplayUtils.ts` | utility | transform | `taskflow/src/lib/statusStyles.ts` | exact |
| `taskflow/src/lib/issueDisplayUtils.test.ts` | test | — | `taskflow/src/lib/formatTimeAgo.test.ts` | exact |
| `taskflow/src/services/jira/rank.ts` | utility | transform | `taskflow/src/lib/statusStyles.ts` (pure-function pattern) | role-match |
| `taskflow/src/services/jira/rank.test.ts` | test | — | `taskflow/src/lib/formatTimeAgo.test.ts` | exact |
| `taskflow/src/routes/dashboard/TaskCard.tsx` | component | request-response | self (refactor) | self-refactor |
| `taskflow/src/routes/dashboard/BacklogRow.tsx` | component | CRUD | `taskflow/src/routes/dashboard/TaskCard.tsx` (key span pattern) | exact |
| `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` | component | CRUD | `taskflow/src/routes/dashboard/TaskCard.tsx` (key span pattern) | exact |
| `taskflow/src/routes/standup-notes/TodayUpNextSection.tsx` | component | CRUD | `taskflow/src/routes/dashboard/TaskCard.tsx` (key span pattern) | exact |
| `taskflow/src/stores/settings.store.ts` | store | CRUD | self (v24 migration block) | self-extend |
| `taskflow/src/routes/dashboard/BacklogPage.tsx` | component | request-response | `taskflow/src/main.tsx` (custom field discovery useEffect) | exact |

---

## Pattern Assignments

### `taskflow/src/lib/issueDisplayUtils.ts` (utility, transform)

**Analog:** `taskflow/src/lib/statusStyles.ts`

**File structure pattern** (lines 1–14 of statusStyles.ts):
```typescript
/**
 * Unified Jira status category styling.
 *
 * All status badges in the app should use these functions instead of
 * local STATUS_CATEGORY_STYLES constants or regex-based helpers.
 */

const BADGE_STYLES: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  indeterminate: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
};

export function statusCategoryBadgeClass(categoryKey: string | undefined): string {
  return BADGE_STYLES[categoryKey ?? 'new'] ?? BADGE_STYLES.new;
}
```

Key conventions to copy:
1. Named `const RECORD: Record<string, string>` at module scope — full Tailwind class strings as values (no template literals), so JIT scanner finds all classes statically.
2. Light-mode class first, `dark:` prefixed variant inline in the same string.
3. Exported function takes nullable/undefined input, uses `?? fallback` to guarantee a return.
4. No imports needed (pure string utilities).

**Secondary analog for the Record pattern:** `taskflow/src/lib/epicColors.ts` lines 11–38 — the `COLOR_MAP: Record<string, string>` with string values that are complete Tailwind class tokens, no template literals:
```typescript
const COLOR_MAP: Record<string, string> = {
  'ghx-label-1': 'bg-amber-100 text-amber-800 border-amber-300',
  // ...all values are full class strings, not interpolated fragments
};
```

**Verified WCAG-passing palette for `PRIORITY_STRIPE` record** (from RESEARCH.md §WCAG Contrast Analysis — replace the UI-SPEC starting shades):
```typescript
const PRIORITY_STRIPE: Record<string, string> = {
  Highest: 'border-l-red-600 dark:border-l-red-400',
  High:    'border-l-orange-600 dark:border-l-orange-400',
  Medium:  'border-l-yellow-700 dark:border-l-yellow-500',  // ← NOT yellow-500 light (fails at 1.92:1)
  Low:     'border-l-gray-500 dark:border-l-gray-400',
  Lowest:  'border-l-gray-600 dark:border-l-gray-300',
};
const DEFAULT_STRIPE = 'border-l-gray-600 dark:border-l-gray-300';
```

**Complete expected file shape** (from RESEARCH.md Pattern 1):
```typescript
export function isDoneStatus(statusCategory: { key: string } | null | undefined): boolean {
  return statusCategory?.key === 'done';
}

// Despite name, returns class for issue KEY element (not summary). Name kept per roadmap export contract.
export function doneSummaryClass(statusCategory: { key: string } | null | undefined): string {
  return isDoneStatus(statusCategory) ? 'line-through' : '';
}

export function priorityStripeClass(priorityName: string | null | undefined): string {
  return PRIORITY_STRIPE[priorityName ?? ''] ?? DEFAULT_STRIPE;
}
```

---

### `taskflow/src/lib/issueDisplayUtils.test.ts` (test)

**Analog:** `taskflow/src/lib/formatTimeAgo.test.ts`

**Imports and describe/it structure** (lines 1–7 of formatTimeAgo.test.ts):
```typescript
import { describe, expect, it } from 'vitest';

import { formatTimeAgoStrict } from './formatTimeAgo';

describe('formatTimeAgoStrict', () => {
  it('returns Ns for diffs < 60 seconds', () => {
    expect(formatTimeAgoStrict(NOW - 30_000)).toBe('30s');
  });
```

Key conventions:
- Import from `'vitest'` — no `@testing-library` needed for pure utility tests.
- One `describe` block per exported function.
- `it(...)` with a short behavior description; `expect(...).toBe(...)` for string equality; `expect(...).toBe(true/false)` for booleans.
- No `beforeEach`/`afterEach` needed for pure synchronous functions.

**Tests required** (from RESEARCH.md Validation Architecture):
- `isDoneStatus`: true for `{ key: 'done' }`, false for `{ key: 'indeterminate' }`, false for `null`, false for `undefined`
- `doneSummaryClass`: returns `'line-through'` for done, `''` for non-done
- `priorityStripeClass`: each of Highest/High/Medium/Low/Lowest returns its WCAG-passing class string; `null`/`undefined`/unknown returns the DEFAULT_STRIPE

---

### `taskflow/src/services/jira/rank.ts` (utility, transform)

**Analog:** `taskflow/src/lib/statusStyles.ts` (pure function, no imports, exported named functions)

**File header convention** (copy from statusStyles.ts):
```typescript
/**
 * LexoRank midpoint calculator.
 *
 * Pure function — no side effects, no API calls.
 * Phase 78 (drag-to-rank) consumes `rankIssue` directly.
 */
```

**Complete implementation** (from RESEARCH.md Pattern 2 — copy verbatim as the algorithm is fully specified):
```typescript
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function rankIssue(before: string | null, after: string | null): string {
  const beforeVal = extractValue(before);
  const afterVal = extractValue(after) ?? pad(beforeVal, beforeVal.length + 1);
  return bucket(before) + '|' + midpoint(beforeVal, afterVal) + ':';
}

function extractValue(rank: string | null): string {
  if (!rank) return '';
  const pipeIdx = rank.indexOf('|');
  const colonIdx = rank.indexOf(':');
  if (pipeIdx === -1) return rank;
  return rank.slice(pipeIdx + 1, colonIdx === -1 ? undefined : colonIdx);
}

function bucket(rank: string | null): string {
  if (!rank) return '0';
  const pipeIdx = rank.indexOf('|');
  return pipeIdx === -1 ? '0' : rank.slice(0, pipeIdx);
}

function pad(s: string, len: number): string {
  return s.padEnd(len, ALPHABET[ALPHABET.length - 1]); // pad with 'z'
}

function midpoint(a: string, b: string): string {
  const len = Math.max(a.length, b.length);
  const pa = a.padEnd(len, '0');
  const pb = b.padEnd(len, '0');
  const ia = BigInt(parseInt(pa || '0', 36));
  const ib = BigInt(parseInt(pb || '0', 36));
  let mid = (ia + ib) / 2n;
  let result = mid.toString(36).padStart(len, '0');
  if (result === pa) {
    result = result + ALPHABET[Math.floor(ALPHABET.length / 2)];
  }
  return result;
}
```

---

### `taskflow/src/services/jira/rank.test.ts` (test)

**Analog:** `taskflow/src/lib/formatTimeAgo.test.ts`

**Imports pattern** (identical to lib tests):
```typescript
import { describe, expect, it } from 'vitest';
import { rankIssue } from './rank';
```

**Edge-case table to cover** (all 9 from RESEARCH.md Pattern 2):

| # | before | after | Assertion |
|---|--------|-------|-----------|
| E1 | `null` | `'0\|hzzzzz:'` | result < `'0\|hzzzzz:'` lexicographically |
| E2 | `'0\|hzzzzz:'` | `null` | result > `'0\|hzzzzz:'` lexicographically |
| E3 | `null` | `null` | returns a valid rank string (contains `'\|'` and `':'`) |
| E4 | `'0\|aaaaaa:'` | `'0\|zzzzzz:'` | result strictly between them |
| E5 | `'0\|aaaaaa:'` | `'0\|aaaaaab:'` | result strictly between them (adjacent — digit extension) |
| E6 | `'0\|aaaaaa:'` | `'0\|aaaaaa1:'` | result strictly between them |
| E7 | `'0\|hzzzzz:'` | `'1\|hzzzzz:'` | result uses bucket `'0'` (before's bucket) |
| E8 | `'0\|000000:'` | `'0\|000001:'` | result strictly between them |
| E9 | `'0\|zzzzzz:'` | `null` | result > `'0\|zzzzzz:'` |

Lexicographic comparison helper for tests:
```typescript
// Helper: compare two full rank strings
function rankLt(a: string, b: string): boolean { return a < b; }
```

---

### `taskflow/src/routes/dashboard/TaskCard.tsx` (component, self-refactor)

**Change 1 — key span done-strike (lines 112–117, refactor only):**

Current code (lines 112–117):
```tsx
className={cn(
  'text-xs font-mono text-muted-foreground',
  issue.fields.status.statusCategory?.key === 'done'
    ? 'line-through group-hover:[text-decoration-line:underline_line-through]'
    : 'group-hover:underline',
)}
```

New code (replace inline check with `isDoneStatus`; preserve the group-hover variants — these are interactive-context hover states NOT represented in `doneSummaryClass`):
```tsx
className={cn(
  'text-xs font-mono text-muted-foreground',
  isDoneStatus(issue.fields.status.statusCategory)
    ? 'line-through group-hover:[text-decoration-line:underline_line-through]'
    : 'group-hover:underline',
)}
```

**Change 2 — priority stripe on outer button (lines 92–99):**

Current outer button className (lines 94–99):
```tsx
className={cn(
  'group border rounded-lg px-2 py-2 density-compact:py-1 density-comfortable:py-3 bg-card w-full flex flex-col gap-1 cursor-pointer hover:bg-accent/50 transition-colors text-left',
  isSubtask && 'border-l-2 border-l-muted',
  isFlagged &&
    'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40',
)}
```

Add priority stripe for non-subtask cards (subtasks retain existing `border-l-2 border-l-muted` nesting marker — do NOT apply `priorityStripeClass` to subtasks, per RESEARCH.md Pitfall 2):
```tsx
className={cn(
  'group border rounded-lg px-2 py-2 density-compact:py-1 density-comfortable:py-3 bg-card w-full flex flex-col gap-1 cursor-pointer hover:bg-accent/50 transition-colors text-left',
  isSubtask ? 'border-l-2 border-l-muted' : ['border-l-4', priorityStripeClass(issue.fields.priority?.name)],
  isFlagged &&
    'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100/90 dark:hover:bg-yellow-900/40',
)}
```

**Import additions** (add to existing imports at lines 33–35):
```tsx
import { isDoneStatus, priorityStripeClass } from '@/lib/issueDisplayUtils';
```

---

### `taskflow/src/routes/dashboard/BacklogRow.tsx` (component, CRUD)

**Analog:** `taskflow/src/routes/dashboard/TaskCard.tsx` (key span pattern, lines 112–120)

**Change — key span at line 79:**

Current (line 79):
```tsx
<span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
```

New (wrap with `cn()` and append `doneSummaryClass`):
```tsx
<span
  className={cn(
    'font-mono text-xs text-muted-foreground',
    doneSummaryClass(issue.fields.status.statusCategory),
  )}
>
  {issue.key}
</span>
```

**Import additions** (add alongside existing `cn` import at line 29):
```tsx
import { doneSummaryClass } from '@/lib/issueDisplayUtils';
```

Note: `cn` is already imported from `@/lib/utils` (line 29). The `className` string on line 79 currently does NOT use `cn()` — wrapping it with `cn()` for class composition is part of this change.

---

### `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` (component, CRUD)

**Analog:** `taskflow/src/routes/dashboard/TaskCard.tsx` (key span pattern); `BacklogRow.tsx` (identical change)

**Change — key span at line 105:**

Current (line 105):
```tsx
<span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
```

New:
```tsx
<span
  className={cn(
    'text-xs text-muted-foreground font-mono shrink-0',
    doneSummaryClass(issue.fields.status.statusCategory),
  )}
>
  {key}
</span>
```

**Import additions** — add `cn` from `@/lib/utils` and `doneSummaryClass` from `@/lib/issueDisplayUtils`. Check whether `cn` is already imported; add only what is missing.

Note per RESEARCH.md: `TodayInProgressSection` only renders `statusCategory.key === 'indeterminate'` items under normal operation. `doneSummaryClass` returns `''` for all such items — the strike is style-readiness for mid-day status transitions (D-08), not an active filter.

---

### `taskflow/src/routes/standup-notes/TodayUpNextSection.tsx` (component, CRUD)

**Analog:** Identical to `TodayInProgressSection.tsx` change above.

**Change — key span at line 109:**

Current (line 109):
```tsx
<span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
```

New:
```tsx
<span
  className={cn(
    'text-xs text-muted-foreground font-mono shrink-0',
    doneSummaryClass(issue.fields.status.statusCategory),
  )}
>
  {key}
</span>
```

**Import additions** — same as `TodayInProgressSection`: `cn` from `@/lib/utils`, `doneSummaryClass` from `@/lib/issueDisplayUtils`.

---

### `taskflow/src/stores/settings.store.ts` (store, self-extend)

**Analog:** self — the v24 migration block (lines 438–441) is the exact template to append after.

**Change 1 — `initialSettings` object (lines 20–67), append after `quickFilters`:**
```typescript
// After line 57 (quickFilters: [] as QuickFilter[],)
rankFieldKey: null as string | null,
```

**Change 2 — `SettingsState` interface (lines 69–213), add after `accountFieldKey`:**
```typescript
/** Discovered rank custom field key. Null until populated from GreenHopper backlog response. */
rankFieldKey: string | null;
setRankFieldKey: (key: string) => void;
```

**Change 3 — action in `create()(persist(...)` block (lines 230–319), following the pattern of `setFlaggedFieldKey` at line 310:**
```typescript
// Pattern to copy from line 310:
setFlaggedFieldKey: (key) => set({ flaggedFieldKey: key }),
// New action — add in the same group:
setRankFieldKey: (key) => set({ rankFieldKey: key }),
```

**Change 4 — `resetSettings` 'preferences' branch (lines 320–335), add `rankFieldKey` to the preserved keys:**
```typescript
// Current preserved keys end at line 333: accountFieldKey: s.accountFieldKey,
// Add:
rankFieldKey: s.rankFieldKey,
```
Pattern: discovered field keys are NOT reset on 'preferences' reset — they come from the Jira instance, not user preference. All 7 existing field keys (`storyPointsFieldKey`, `epicLinkFieldKey`, `epicNameFieldKey`, `sprintFieldKey`, `epicColorFieldKey`, `flaggedFieldKey`, `accountFieldKey`) follow this pattern. `rankFieldKey` is the 8th.

**Change 5 — v25 migration block (append after line 440, before `return persisted as SettingsState`):**
```typescript
// v24 block (existing, lines 438–440):
if (version < 24) {
  delete (s as Record<string, unknown>).showSubtasksInMyTasks;
}
// v25 block — append immediately after:
if (version < 25) {
  if (s.rankFieldKey === undefined) s.rankFieldKey = null;
}
```

**Change 6 — version bump (line 340):**
```typescript
// Current:
version: 24,
// New:
version: 25,
```

---

### `taskflow/src/routes/dashboard/BacklogPage.tsx` (component, request-response)

**Analog:** `taskflow/src/main.tsx` lines 70–110 — `useCustomFieldDiscovery` hook with `useEffect` writing to settings store when query data arrives.

**Discovery seam pattern from main.tsx** (lines 92–110):
```typescript
useEffect(() => {
  if (query.data) {
    setStoryPointsFieldKey(query.data.storyPointsFieldKey);
    setEpicLinkFieldKey(query.data.epicLinkFieldKey);
    // ... other setters
    setFlaggedFieldKey(query.data.flaggedFieldKey);
  }
}, [
  query.data,
  setStoryPointsFieldKey,
  // ... other setters in deps array
  setFlaggedFieldKey,
]);
```

**Change 1 — destructure `rankFieldKey` and `setRankFieldKey` from the existing `useSettingsStore()` call (lines 211–217):**
```typescript
// Current destructure (lines 211–217):
const {
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  epicColorFieldKey,
  flaggedFieldKey,
} = useSettingsStore();

// Add rankFieldKey and setRankFieldKey to the same destructure:
const {
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  epicColorFieldKey,
  flaggedFieldKey,
  rankFieldKey,
  setRankFieldKey,
} = useSettingsStore();
```

**Change 2 — add `useEffect` after the `useGhBacklogData` call (line 247) and before the `useMemo` chain (line 254):**
```typescript
// Populate rankFieldKey once from backlog response when not yet discovered.
useEffect(() => {
  if (backlog?.rankCustomFieldId && !rankFieldKey) {
    setRankFieldKey(`customfield_${backlog.rankCustomFieldId}`);
  }
}, [backlog?.rankCustomFieldId, rankFieldKey, setRankFieldKey]);
```

Probe-verified: `backlog.rankCustomFieldId === 10105` → `rankFieldKey = 'customfield_10105'`.

Note: `useEffect` is already imported at line 33 — no import change needed.

---

## Shared Patterns

### `cn()` Class Composition
**Source:** `taskflow/src/lib/utils.ts`
**Import:** `import { cn } from '@/lib/utils';`
**Apply to:** All component changes that add conditional `className` logic.

Pattern in use (TaskCard.tsx line 94, BacklogRow.tsx line 110):
```typescript
className={cn(
  'base-classes-always-applied',
  conditionalExpression && 'conditional-class',
  anotherCondition ? 'truthy-class' : 'falsy-class',
)}
```

### Full Tailwind Class Strings (No Template Literals)
**Source:** `taskflow/src/lib/epicColors.ts` lines 11–38, `taskflow/src/lib/statusStyles.ts` lines 10–20
**Apply to:** `issueDisplayUtils.ts` `PRIORITY_STRIPE` record.

Rule: Every class in a Record value must be a complete, static string token so Tailwind JIT scanner detects it. Never use:
```typescript
// WRONG — Tailwind JIT misses these:
`border-l-${color}-600`
```
Always use:
```typescript
// CORRECT — full static strings:
'border-l-red-600 dark:border-l-red-400'
```

### `dark:` Prefix for Theme Variants
**Source:** `taskflow/src/lib/statusStyles.ts` lines 12–14
**Apply to:** All color-bearing Tailwind classes in `issueDisplayUtils.ts`.

Pattern: raw class for light mode, `dark:` prefixed variant in the same string:
```typescript
'bg-blue-500/15 text-blue-600 dark:text-blue-400'
```

### Discovered Field Key Persistence
**Source:** `taskflow/src/stores/settings.store.ts` (pattern for all `*FieldKey` entries)
**Apply to:** `rankFieldKey` in settings store.

Three-part pattern:
1. `initialSettings` object: `rankFieldKey: null as string | null`
2. `SettingsState` interface: field + setter typed
3. Action: `setRankFieldKey: (key) => set({ rankFieldKey: key })`
4. `resetSettings('preferences')`: preserve the value (not reset)
5. Migration block: `if (s.rankFieldKey === undefined) s.rankFieldKey = null`

---

## No Analog Found

All files have close analogs. No entries.

---

## Metadata

**Analog search scope:** `taskflow/src/lib/`, `taskflow/src/routes/dashboard/`, `taskflow/src/routes/standup-notes/`, `taskflow/src/stores/`, `taskflow/src/main.tsx`
**Files read:** 10 source files + 1 test file
**Pattern extraction date:** 2026-06-03
