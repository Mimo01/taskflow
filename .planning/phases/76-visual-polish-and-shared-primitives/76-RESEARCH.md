# Phase 76: Visual Polish and Shared Primitives — Research

**Researched:** 2026-06-03
**Domain:** TypeScript / React / Tailwind CSS / Zustand / LexoRank algorithm
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Priority stripe palette = red→gray severity ramp. Highest=red, High=orange, Medium=yellow, Low=gray, Lowest=lighter gray.
- **D-02:** Exact Tailwind shades tuned per-theme to meet WCAG ≥ 3:1 against `bg-card`. Ramp intent locked; literal tokens not locked.
- **D-03:** Cards with no priority / unmapped priority render a neutral gray stripe (never absent/transparent).
- **D-04:** Stripe lives on the existing `TaskCard` outer `<button>`, extending the `border-l-2 border-l-muted` idiom. Use `border-l-4`.
- **D-05:** Key-only strike. Apply `line-through` to the issue key `<span>` only. No opacity/dimming.
- **D-06:** `doneSummaryClass` name kept per roadmap contract but returns class for the issue key element.
- **D-07:** `isDoneStatus` = `statusCategory?.key === 'done'`. Single source of truth.
- **D-08:** Style-only on Standup Today. No new rows/subsections added.
- **D-09:** `rankIssue` = pure client-side LexoRank-style midpoint calculator. No API calls, no UI. Fully unit-tested.
- **D-10:** `rankFieldKey` persisted in settings via v25 migration (default `null`).
- **D-11:** `rankFieldKey` populated from GreenHopper backlog response `rankCustomFieldId`, composed as `customfield_${rankCustomFieldId}`. Probe-verified: fixture carries `rankCustomFieldId: 10105`.

### Claude's Discretion

- Rank-primitive scope (D-09/10/11) delegated to Claude; decided as pure-calc + persisted-key with discovery-time population.
- Exact stripe render mechanism (extended `border-l`, pseudo-element, or inline element) left to planner/executor — constraint is WCAG ≥ 3:1 + visual consistency with the subtask `border-l` idiom.

### Deferred Ideas (OUT OF SCOPE)

- Standup "Done / Completed today" subsection.
- Drag-to-rank UI + Jira rank-API persistence (Phase 78).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VISUAL-01 | Done stories appear struck-through on Backlog active-sprint list | §Existing Code: BacklogRow issue key `<span>` at line 79; `cn()` + `doneSummaryClass` pattern |
| VISUAL-02 | Done items appear struck-through in Standup Notes Today section | §Existing Code: TodayInProgressSection line 105, TodayUpNextSection line 109; same key `<span>` pattern |
| VISUAL-03 | Dashboard per-story list shows done items struck-through (treated as satisfied when aggregate-only) | §Existing Code: confirm via code scan — aggregate-only, no per-row issue keys exist |
| VISUAL-04 | Sprint board cards show left-edge color stripe driven by priority | §WCAG Contrast: verified palette table; §Architecture: `border-l-4` on TaskCard outer button |
| VISUAL-05 | Card color stripe is legible in both themes (WCAG ≥ 3:1) | §WCAG Contrast Analysis: computed ratio table; corrected shades for yellow/gray |
</phase_requirements>

---

## Summary

Phase 76 is a low-complexity visual polish phase with one genuinely novel algorithm: a pure client-side LexoRank midpoint calculator. All visual changes (done-state strike, priority stripe) follow patterns already established in the codebase. The only research risk was the WCAG contrast verification — and the computed ratios reveal that the UI-SPEC's suggested starting shades for `yellow-500` (Medium priority, light mode) fail at 1.92:1, well below 3:1. The correct minimum for Medium in light mode is `yellow-700` (4.92:1). Several other UI-SPEC starting shades also fail in one theme or the other; the verified-passing palette is documented below and replaces those suggestions.

The settings store v25 migration follows a mechanical pattern identical to the v24 block. The `rankFieldKey` discovery seam is in `BacklogPage.tsx` — the natural point is a `useEffect` on the `backlog` query result, setting `rankFieldKey` once when the GreenHopper response first arrives and the field is not yet persisted.

LexoRank midpoint is the most intellectually complex item. A concrete algorithm spec with edge-case table is documented below so the planner can derive unit tests directly from it.

**Primary recommendation:** Follow all locked decisions from CONTEXT.md verbatim. The WCAG contrast table below replaces the UI-SPEC shade suggestions where they fail. Implement the LexoRank algorithm per the spec in §Architecture Patterns; write unit tests against the edge-case table before shipping.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Done-state key strike (VISUAL-01/02/03) | Frontend (React component) | lib utility | Pure display rule; `isDoneStatus` logic lives in a shared lib util, applied at render time in each component |
| Priority stripe (VISUAL-04/05) | Frontend (React component) | lib utility | `priorityStripeClass` maps a Jira priority name to Tailwind border class; applied in `TaskCard` at render |
| `rankIssue` LexoRank calculator | lib utility | — | Pure function, no tier boundary; lives in `services/jira/rank.ts`, consumed by future Phase 78 mutation |
| `rankFieldKey` persistence (D-10/11) | Settings store (Zustand + Tauri Store) | BacklogPage (discovery) | Store persists the key; BacklogPage writes it on first GreenHopper backlog response |

---

## Standard Stack

No new packages are installed by this phase. All implementation uses existing project dependencies.

### Existing Dependencies in Use

| Library | Version (in use) | Purpose | Role in Phase 76 |
|---------|-----------------|---------|-----------------|
| React | 18.x | UI rendering | Component changes |
| Tailwind CSS | 3.x | Utility CSS | `border-l-4`, `line-through`, priority stripe classes |
| Zustand `persist` | 4.x | Settings store | v25 migration for `rankFieldKey` |
| Vitest | latest | Test runner | Unit tests for `rankIssue` |
| `cn()` (clsx + tailwind-merge) | existing `@/lib/utils` | Class composition | Used in all component changes |

**No `npm install` step required.**

---

## Package Legitimacy Audit

> No new packages are installed by this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
GreenHopper backlog response
          │
          ▼
  BacklogPage (useGhBacklogData)
    │   └── backlog.rankCustomFieldId
    │              │
    │              ▼
    │    useEffect → setRankFieldKey('customfield_10105')
    │                         │
    │                         ▼
    │               settings.store (v25, persisted)
    │
    └── issues[] ──► BacklogRow
                       └── isDoneStatus(statusCategory)
                            └── doneSummaryClass() → 'line-through' on key <span>

Jira priority name
          │
          ▼
  priorityStripeClass(priorityName)  ← issueDisplayUtils.ts
          │
          ▼
  'border-l-red-600 dark:border-l-red-400'  (example)
          │
          ▼
  TaskCard outer <button>   + 'border-l-4' (width, added by caller)

rankIssue(before, after)  ← services/jira/rank.ts (pure function)
          │
    [future Phase 78 consumes this]
```

### Recommended Project Structure

```
taskflow/src/
├── lib/
│   └── issueDisplayUtils.ts        # NEW: isDoneStatus, doneSummaryClass, priorityStripeClass
├── services/jira/
│   └── rank.ts                     # NEW: rankIssue (pure LexoRank midpoint)
│   └── rank.test.ts                # NEW: unit tests for rankIssue
├── stores/
│   └── settings.store.ts           # MODIFY: add rankFieldKey + v25 migration
├── routes/dashboard/
│   ├── TaskCard.tsx                 # MODIFY: refactor inline done-check + add border-l-4 + priorityStripeClass
│   └── BacklogRow.tsx               # MODIFY: apply doneSummaryClass to key <span>
└── routes/standup-notes/
    ├── TodayInProgressSection.tsx   # MODIFY: apply doneSummaryClass to key <span>
    └── TodayUpNextSection.tsx       # MODIFY: apply doneSummaryClass to key <span>
```

---

## WCAG Contrast Analysis (VISUAL-04/05 — Critical Finding)

**Method:** WCAG 2.1 relative luminance formula applied to approximate sRGB values of Tailwind v3 default palette shades. Contrast ratio = (L_lighter + 0.05) / (L_darker + 0.05). Threshold for non-text graphical objects = 3:1.

**Surface tokens used:**
- Light `bg-card` = `oklch(1 0 0)` = white = `#ffffff` → luminance = 1.0
- Dark `bg-card` = `oklch(0.205 0 0)` ≈ `#2a2a2a` → luminance ≈ 0.019

**Computed contrast ratios (verified by JavaScript calculation in this session):** [VERIFIED: computed via WCAG formula]

| Shade | Light mode ratio | Light PASS? | Dark mode ratio | Dark PASS? |
|-------|-----------------|-------------|-----------------|------------|
| `red-600` | 4.83 | ✓ | 2.97 | ✗ |
| `red-400` | 2.77 | ✗ | 5.19 | ✓ |
| `orange-600` | 3.56 | ✓ | 4.03 | ✓ |
| `orange-500` | 2.80 | ✗ | 5.12 | ✓ |
| `orange-400` | 2.26 | ✗ | 6.34 | ✓ |
| `yellow-500` | **1.92** | **✗ FAIL** | 7.48 | ✓ |
| `yellow-600` | 2.94 | ✗ | 4.89 | ✓ |
| `yellow-700` | 4.92 | ✓ | 2.92 | ✗ |
| `yellow-300` | 1.32 | ✗ | 10.89 | ✓ |
| `gray-400` | 2.54 | ✗ | 5.65 | ✓ |
| `gray-500` | 4.83 | ✓ | 2.97 | ✗ |
| `gray-600` | 7.56 | ✓ | 1.90 | ✗ |
| `gray-300` | 1.47 | ✗ | 9.74 | ✓ |

**Consequence:** No single Tailwind shade can pass 3:1 in BOTH themes simultaneously for any priority (the luminance needed for ≥3:1 against white is fundamentally different from what is needed against `#2a2a2a`). Light/dark variants are mandatory — confirmed by the data.

**Verified WCAG-passing palette (replaces UI-SPEC starting suggestions where they fail):**

| Priority | Light mode shade | Light ratio | Dark mode shade | Dark ratio |
|----------|-----------------|-------------|-----------------|------------|
| Highest | `border-l-red-600` | 4.83 | `dark:border-l-red-400` | 5.19 |
| High | `border-l-orange-600` | 3.56 | `dark:border-l-orange-400` | 6.34 |
| Medium | `border-l-yellow-700` | 4.92 | `dark:border-l-yellow-500` | 7.48 |
| Low | `border-l-gray-500` | 4.83 | `dark:border-l-gray-400` | 5.65 |
| Lowest | `border-l-gray-600` | 7.56 | `dark:border-l-gray-300` | 9.74 |
| Unset/default | `border-l-gray-600` | 7.56 | `dark:border-l-gray-300` | 9.74 |

**Key correction vs UI-SPEC:** The UI-SPEC suggests `yellow-500` for Medium light mode (fails at 1.92:1) and `yellow-300` for Medium dark mode. The verified palette above uses `yellow-700` for light and `yellow-500` for dark — both pass. This is the most important correction this research produces.

**Acceptance criterion for executor:** Before shipping, verify each shade in the browser DevTools → Accessibility → Color Contrast panel against the rendered card surface, OR run contrast-ratio calculation confirming ≥ 3.0.

---

## Pattern 1: `issueDisplayUtils.ts` — Done-State Utilities

**What:** Shared utilities replacing inline `statusCategory?.key === 'done'` checks across all views.

**Canonical reference:** `TaskCard.tsx` lines 113–117 (existing implementation to centralize).

**Verified contracts from TaskCard.tsx and UI-SPEC:** [VERIFIED: source file inspection]

```typescript
// taskflow/src/lib/issueDisplayUtils.ts

export function isDoneStatus(statusCategory: { key: string } | null | undefined): boolean {
  return statusCategory?.key === 'done';
}

// Despite the name, this returns the class for the issue KEY element, not summary.
// Name kept per roadmap export contract (D-06).
export function doneSummaryClass(statusCategory: { key: string } | null | undefined): string {
  return isDoneStatus(statusCategory) ? 'line-through' : '';
}

const PRIORITY_STRIPE: Record<string, string> = {
  Highest: 'border-l-red-600 dark:border-l-red-400',
  High:    'border-l-orange-600 dark:border-l-orange-400',
  Medium:  'border-l-yellow-700 dark:border-l-yellow-500',    // ← corrected from UI-SPEC
  Low:     'border-l-gray-500 dark:border-l-gray-400',
  Lowest:  'border-l-gray-600 dark:border-l-gray-300',
};
const DEFAULT_STRIPE = 'border-l-gray-600 dark:border-l-gray-300';

// Returns border-l-{color} class only. Caller adds 'border-l-4' (width).
export function priorityStripeClass(priorityName: string | null | undefined): string {
  return PRIORITY_STRIPE[priorityName ?? ''] ?? DEFAULT_STRIPE;
}
```

**Usage in TaskCard (existing `<button>` at line 94):**
```tsx
// Caller owns 'border-l-4'; priorityStripeClass provides color only
<button
  className={cn(
    'group border rounded-lg px-2 py-2 ... border-l-4',
    priorityStripeClass(issue.fields.priority?.name),
    isSubtask && 'border-l-2 border-l-muted',   // subtask overrides to narrower + muted
    // ...
  )}
>
```

Note: `isSubtask && 'border-l-2 border-l-muted'` currently overrides the stripe for subtasks. The planner should decide if subtasks also receive priority stripes or retain the muted indicator. CONTEXT.md/UI-SPEC do not explicitly address subtasks — treat as Claude's discretion, keeping muted for subtasks to preserve visual hierarchy.

**Usage in BacklogRow (key `<span>` at current line 79):**
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

**Usage in TodayInProgressSection (key `<span>` at current line 105):**
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

Same pattern applies to `TodayUpNextSection` (line 109).

---

## Pattern 2: LexoRank Midpoint Algorithm — `rankIssue`

**What:** Pure function computing a rank string strictly between two LexoRank-style neighbors. No Jira API calls. Used by Phase 78's drag-to-rank mutation.

**Background:** Jira uses LexoRank internally. The wire value is a string like `"0|hzzzzz:"`. The canonical shape is `{bucket}|{value}:{tiebreakerOrEmpty}`. [ASSUMED: Jira internal LexoRank format — training knowledge; exact wire format confirmed in probe fixture but algorithm is not officially documented by Atlassian]

**Algorithm Specification (midpoint between two LexoRank strings):**

The goal: given rank strings `before` and `after`, produce a rank string `mid` such that `before < mid < after` under lexicographic order.

```
Algorithm: LexoRank Midpoint

Input:
  before: string | null   (null = insert at start)
  after:  string | null   (null = insert at end)
  alphabet: string        (base-36: '0123456789abcdefghijklmnopqrstuvwxyz', 36 chars)

Step 1 — Parse
  Strip the bucket prefix (e.g. '0|') and trailing ':...' tiebreaker.
  The value portion is the base-36 string between '|' and ':'.
  If before is null, treat as '' (all-zero value, empty string sorts before any char).
  If after is null, treat as a string of all 'z's padded to a length one longer than before.

Step 2 — Pad to equal length
  Pad the shorter string on the RIGHT with '0' until both are the same length.
  (Right-padding with '0' does not change lexicographic order for this alphabet.)

Step 3 — Convert to integer array
  Map each character to its index in the alphabet (0='0', 35='z').

Step 4 — Compute midpoint
  midDigits = []
  carry = 0
  sum = 0
  Iterate from index 0 to len-1:
    sum = beforeDigits[i] + afterDigits[i] + carry * 36
    carry = 0
    midDigits[i] = floor(sum / 2)  [integer division]
    carry from fractional part: if sum is odd, carry 18 to next position (i.e. half of 36)

  Practical implementation (right-to-left accumulation):
    combined = ''
    For i from 0 to len-1 (left to right):
      digitA = alphabet.indexOf(before[i] or '0')
      digitB = alphabet.indexOf(after[i] or '0')
      combined[i] = (digitA + digitB) / 2 ... 
  
  Preferred implementation:
    Convert both padded strings to BigInt treating them as base-36 numbers.
    mid_int = (a_int + b_int) / 2n (BigInt integer division)
    Convert mid_int back to base-36 string.
    Left-pad to the padded length with '0'.

Step 5 — Check if mid == before (adjacent, no gap)
  If mid_string === before_value_padded:
    Append '0' + mid character of the alphabet (index 18 = 'i')
    This extends the string to create a value strictly between them.
    Example: before='z', after='z0' → mid='zz...'; extend to 'z0i'

Step 6 — Reconstruct full rank string
  Use the same bucket prefix as before (or '0|' if before was null).
  Result: bucket + '|' + mid_value + ':'
```

**Simplified implementation (recommended for this codebase):**

Since Jira's wire LexoRank values are long enough that BigInt overflow is not a concern at typical list sizes, the cleanest approach is:

```typescript
// taskflow/src/services/jira/rank.ts

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Compute a LexoRank string strictly between `before` and `after`.
 *
 * - Pass null for `before` to rank before all items (insert at start).
 * - Pass null for `after` to rank after all items (insert at end).
 *
 * The returned string is suitable for Jira's PUT /rest/agile/1.0/issue/rank
 * `rankBeforeIssueKey`/`rankAfterIssueKey` field (Phase 78 will call the API;
 * this function only produces the rank value).
 *
 * Pure function — no side effects, no API calls.
 */
export function rankIssue(
  before: string | null,
  after: string | null,
): string {
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
  // Pad to equal length (right-pad with '0')
  const len = Math.max(a.length, b.length);
  const pa = a.padEnd(len, '0');
  const pb = b.padEnd(len, '0');

  // Convert to BigInt (base-36)
  const ia = BigInt(parseInt(pa || '0', 36));
  const ib = BigInt(parseInt(pb || '0', 36));
  let mid = (ia + ib) / 2n;

  // Convert back to base-36
  let result = mid.toString(36).padStart(len, '0');

  // If mid == before, extend by one character at midpoint of alphabet
  if (result === pa) {
    result = result + ALPHABET[Math.floor(ALPHABET.length / 2)];
  }

  return result;
}
```

**Edge-Case Table (required for unit tests):**

| # | before | after | Expected mid | Rule |
|---|--------|-------|--------------|------|
| E1 | `null` | `0\|hzzzzz:` | value strictly before `hzzzzz` | insert at start |
| E2 | `0\|hzzzzz:` | `null` | value strictly after `hzzzzz` | insert at end |
| E3 | `null` | `null` | any valid rank string | empty list |
| E4 | `0\|aaaaaa:` | `0\|zzzzzz:` | `0\|mmmmmm:` or similar midpoint | normal mid |
| E5 | `0\|aaaaaa:` | `0\|aaaaaab:` | value between (extend length) | adjacent, no gap — digit extension |
| E6 | `0\|aaaaaa:` | `0\|aaaaaa1:` | value between (extend length) | adjacent, 1 gap |
| E7 | bucket preserved | different bucket | should use before's bucket | bucket consistency |
| E8 | `0\|000000:` | `0\|000001:` | value between | near-zero boundary |
| E9 | `0\|zzzzzz:` | `null` | value strictly after `zzzzzz` | near-max boundary |

**Implementation notes:**
- `parseInt(str, 36)` is adequate for strings up to ~12 chars before floating-point precision issues. For Jira's typical 6-char values it is safe. Use `BigInt` path as shown to be safe at any length.
- The function does NOT need to be symmetric (same result regardless of argument order) — it only needs to be strictly between the two neighbors.
- Phase 78 will call `rankIssue(issues[targetIdx - 1]?.fields.rank, issues[targetIdx]?.fields.rank)` where `rank` is the stored LexoRank string from the GH response.

---

## Pattern 3: Settings Store v25 Migration

**Verified pattern from `settings.store.ts` (lines 338–444):** [VERIFIED: source file inspection]

Current state: `version: 24`. The v24 block (lines 438–441) is:
```typescript
if (version < 24) {
  delete (s as Record<string, unknown>).showSubtasksInMyTasks;
}
```

**v25 addition — append after the v24 block, before `return persisted as SettingsState`:**
```typescript
if (version < 25) {
  if (s.rankFieldKey === undefined) s.rankFieldKey = null;
}
```

**State shape additions:**

1. Add to `initialSettings` object:
```typescript
rankFieldKey: null as string | null,
```

2. Add to `SettingsState` interface:
```typescript
/** Discovered rank custom field key. Null until populated from GreenHopper backlog response. */
rankFieldKey: string | null;
setRankFieldKey: (key: string) => void;
```

3. Add to `create()(persist((...) => ({...` actions:
```typescript
setRankFieldKey: (key) => set({ rankFieldKey: key }),
```

4. Bump version number: `version: 25`

5. Update `resetSettings` 'preferences' branch to preserve `rankFieldKey` (follows the same pattern as other discovered field keys — they are NOT reset on 'preferences' reset because they are discovered from the Jira instance):
```typescript
rankFieldKey: s.rankFieldKey,
```

---

## Pattern 4: rankFieldKey Discovery Seam

**Where `rankCustomFieldId` is available:** `backlog.rankCustomFieldId` in `BacklogPage.tsx` after `useGhBacklogData(boardId)` resolves. [VERIFIED: source file inspection]

**Seam pattern** — add a `useEffect` in `BacklogPage` that writes `rankFieldKey` to settings once when discovered, following the `epicColorFieldKey` / `flaggedFieldKey` precedent from `main.tsx`:

```typescript
// In BacklogPage, near the other useSettingsStore destructure:
const { ..., rankFieldKey, setRankFieldKey } = useSettingsStore();

// After `const { data: backlog, ... } = useGhBacklogData(boardId ?? null);`
// Populate rankFieldKey once from backlog response when not yet discovered.
useEffect(() => {
  if (backlog?.rankCustomFieldId && !rankFieldKey) {
    setRankFieldKey(`customfield_${backlog.rankCustomFieldId}`);
  }
}, [backlog?.rankCustomFieldId, rankFieldKey, setRankFieldKey]);
```

**Why BacklogPage and not main.tsx:** `rankCustomFieldId` is GreenHopper-specific (comes from the backlog/allData endpoint, not the standard Jira custom fields API that `discoverCustomFields` calls). It is not available at app-boot time — only when the backlog route is visited. This is the same pattern as how `epicColorFieldKey` was discovered from GH allData in earlier phases.

**Fixture-verified value:** `data.real.json:7211` carries `"rankCustomFieldId": 10105`, so `rankFieldKey` = `"customfield_10105"` in the test environment. The unit test for this should assert the composed key matches the fixture value.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class composition | Manual string concat | `cn()` from `@/lib/utils` | Handles conditional classes, deduplication, tailwind-merge |
| Priority → color mapping | Inline ternary chains | `PRIORITY_STRIPE` record in `issueDisplayUtils.ts` | Mirrors `epicColors.ts` / `statusStyles.ts` pattern; readable, testable |
| WCAG contrast verification | Eyeballing | Use computed ratios from §WCAG Contrast Analysis + browser DevTools accessibility panel | Light mode yellow shades routinely fail — eyeballing is unreliable |
| LexoRank midpoint | Ad-hoc string manipulation without base-36 math | BigInt base-36 implementation as specified | Adjacent-rank edge case (no integer gap) requires digit extension; naive midpoint produces same-as-before |

---

## Common Pitfalls

### Pitfall 1: Yellow Stripe Fails WCAG in Light Mode
**What goes wrong:** Using `yellow-500` for Medium priority in light mode — contrast ratio 1.92:1 against white. Ships and passes visual inspection because yellow looks visible to the eye but fails accessibility tooling.
**Why it happens:** Human contrast perception is non-linear; yellow reads as "bright" but its luminance is high relative to white.
**How to avoid:** Use `yellow-700` (4.92:1) in light mode, `yellow-500` (7.48:1) in dark mode. Verify with browser DevTools accessibility panel before committing.
**Warning signs:** Any automated accessibility scan or Lighthouse audit will flag it.

### Pitfall 2: Subtask Cards Getting Priority Stripe Instead of Muted Border
**What goes wrong:** Applying `priorityStripeClass` to `TaskCard` without handling the `isSubtask` case — subtasks currently render `border-l-2 border-l-muted` which signals nesting, not priority.
**Why it happens:** The stripe is added to the same `className` as the subtask border.
**How to avoid:** When `isSubtask` is true, retain `border-l-2 border-l-muted` and omit `priorityStripeClass`. Alternatively, apply both (width from subtask, color from priority) — but this changes the visual hierarchy. CONTEXT.md does not specify; treat as Claude's discretion. Safest: retain existing `isSubtask` behavior, apply priority stripe only to non-subtask cards.

### Pitfall 3: LexoRank Adjacent-Rank Edge Case
**What goes wrong:** When `before` and `after` have no integer gap (e.g. `before = 'aaaaaa'`, `after = 'aaaaab'`), naive `(a + b) / 2` produces `aaaaaa` = same as `before`. The ordering invariant breaks.
**Why it happens:** Integer division floors toward `before` when the gap is 1.
**How to avoid:** After computing `mid`, check if `mid === before_value`. If so, extend with an additional character at the alphabet midpoint (`'i'`, index 18 of 36). The unit test E5 in the edge-case table above covers this.
**Warning signs:** Unit test `rankIssue(before, after)` returns same string as `before`.

### Pitfall 4: `doneSummaryClass` Applied to Summary Text (Not Key)
**What goes wrong:** Strikethrough applied to the `summary` text `<div>` instead of the key `<span>`. This contradicts D-05/D-06 and the explicit kanban-consistency requirement.
**Why it happens:** The function name `doneSummaryClass` implies it targets the summary.
**How to avoid:** Document at the call site that this class goes on the key element. The UI-SPEC section "Done-State Strike Treatment" makes this explicit.

### Pitfall 5: Tailwind Purge Misses Dynamic Border Classes
**What goes wrong:** `priorityStripeClass` returns strings like `'border-l-red-600 dark:border-l-red-400'` computed at runtime. Tailwind's JIT scanner may not detect these as used classes if it only scans static strings.
**Why it happens:** Tailwind scans source files for class names — dynamically constructed strings are invisible unless listed explicitly.
**How to avoid:** Use full class strings in the `PRIORITY_STRIPE` record (not template literals like `border-l-${color}-600`). The pattern in `epicColors.ts` and `statusStyles.ts` already does this correctly — every class is a complete token in a string literal. Follow the same pattern.

---

## Existing Code — Precise Integration Points

### BacklogRow — Issue Key Span (VISUAL-01)
**File:** `taskflow/src/routes/dashboard/BacklogRow.tsx`
**Current line 79:**
```tsx
<span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
```
**Change:** Wrap className with `cn()` and append `doneSummaryClass(issue.fields.status.statusCategory)`.

### TodayInProgressSection — Issue Key Span (VISUAL-02)
**File:** `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx`
**Current line 105:**
```tsx
<span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
```
**Change:** Apply `cn()` + `doneSummaryClass(issue.fields.status.statusCategory)`.
Note: `TodayInProgressSection` only renders items with `statusCategory.key === 'indeterminate'`. Under D-08, the strike is a style-readiness measure (handles mid-day transitions). `doneSummaryClass` will return `''` for all normal items and only apply `line-through` if a done item appears.

### TodayUpNextSection — Issue Key Span (VISUAL-02)
**File:** `taskflow/src/routes/standup-notes/TodayUpNextSection.tsx`
**Current line 109:**
```tsx
<span className="text-xs text-muted-foreground font-mono shrink-0">{key}</span>
```
**Change:** Same as `TodayInProgressSection`.

### TaskCard — Refactor Inline Done Check + Add Stripe (VISUAL-04 + VISUAL-01)
**File:** `taskflow/src/routes/dashboard/TaskCard.tsx`
**Current lines 113–117:**
```tsx
className={cn(
  'text-xs font-mono text-muted-foreground',
  issue.fields.status.statusCategory?.key === 'done'
    ? 'line-through group-hover:[text-decoration-line:underline_line-through]'
    : 'group-hover:underline',
)}
```
**Change:** Replace inline `statusCategory?.key === 'done'` check with `isDoneStatus(issue.fields.status.statusCategory)`. Keep `group-hover:[text-decoration-line:underline_line-through]` / `group-hover:underline` conditional — those are interactive-context hover states not represented in `doneSummaryClass`.

**Current line 94 (outer button className):**
```tsx
className={cn(
  'group border rounded-lg px-2 py-2 ... bg-card w-full flex flex-col gap-1 cursor-pointer hover:bg-accent/50 transition-colors text-left',
  isSubtask && 'border-l-2 border-l-muted',
  isFlagged && '...',
)}
```
**Change:** Add `!isSubtask && ['border-l-4', priorityStripeClass(issue.fields.priority?.name)]` — priority stripe applies to non-subtask cards only.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Inline `statusCategory?.key === 'done'` in each component | Shared `isDoneStatus` / `doneSummaryClass` in `issueDisplayUtils.ts` | Single source of truth; one place to change |
| No client-side LexoRank | `rankIssue` pure function in `services/jira/rank.ts` | Phase 78 drag-to-rank can use it without re-deriving |
| Settings at v24 | Settings at v25 with `rankFieldKey` | Persisted; survives app restarts; Phase 78 reads it directly |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jira LexoRank wire format is `{bucket}\|{base36value}:` | Pattern 2 (rankIssue) | rankIssue would parse/reconstruct incorrectly; Phase 78 API call would send malformed rank value |
| A2 | BigInt `parseInt(str, 36)` is safe for Jira's typical rank value lengths | Pattern 2 (rankIssue) | Precision errors for very long rank strings (unlikely in practice) |
| A3 | `issue.fields.priority?.name` is the string Jira sends for priority names (e.g. `'Highest'`, `'Medium'`) | Pattern 1 (priorityStripeClass) | Stripe would fall through to DEFAULT_STRIPE for all priorities |
| A4 | `TodayInProgressSection` and `TodayUpNextSection` have access to `issue.fields.status.statusCategory` (not just the category key) | Pattern 1 (doneSummaryClass) | doneSummaryClass call site would need different argument shaping |

**A3 note:** Priority names are standard Jira strings — `'Highest'`, `'High'`, `'Medium'`, `'Low'`, `'Lowest'`. If a Jira instance uses custom priority names (e.g. `'Critical'`), those would fall through to DEFAULT_STRIPE. The `PRIORITY_STRIPE` record can be extended, but for this phase standard names are sufficient.

---

## Open Questions

1. **Subtask priority stripe (CONTEXT.md Claude's discretion)**
   - What we know: `isSubtask` cards currently use `border-l-2 border-l-muted` as a nesting marker. Stripe width would be `border-l-4`.
   - What's unclear: Should subtasks show priority stripe or retain the nesting marker?
   - Recommendation: Retain `border-l-2 border-l-muted` for subtasks (no priority stripe) — nesting hierarchy signal is more important than priority for subtask cards, and the visual clutter would be high.

2. **VISUAL-03 scope (Dashboard per-story list)**
   - What we know: REQUIREMENTS.md says "treated as satisfied where the card is aggregate-only with no per-story rows."
   - What's unclear: Does the Dashboard render any per-story rows with issue keys?
   - Recommendation: Planner should do a quick scan of `DashboardPage` / its child components for `{issue.key}` or `font-mono` renders. If none found, mark VISUAL-03 satisfied as-is per the requirement's own escape hatch.

---

## Environment Availability

> Step 2.6: No external tool dependencies introduced by this phase (code/config-only changes). SKIPPED.

---

## Validation Architecture

`nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/services/jira/rank.test.ts` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VISUAL-01 | `doneSummaryClass` returns `'line-through'` for done status | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ❌ Wave 0 |
| VISUAL-01 | `isDoneStatus` returns true for `{ key: 'done' }`, false otherwise | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ❌ Wave 0 |
| VISUAL-04/05 | `priorityStripeClass` returns correct WCAG-passing Tailwind class per priority + default | unit | `npx vitest run src/lib/issueDisplayUtils.test.ts` | ❌ Wave 0 |
| D-09 | `rankIssue(null, rank)` returns value < rank | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ Wave 0 |
| D-09 | `rankIssue(rank, null)` returns value > rank | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ Wave 0 |
| D-09 | `rankIssue(a, b)` returns value strictly between a and b | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ Wave 0 |
| D-09 | Adjacent rank edge case (no integer gap) produces extended string | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ Wave 0 |
| D-09 | All 9 edge cases from edge-case table pass | unit | `npx vitest run src/services/jira/rank.test.ts` | ❌ Wave 0 |
| D-11 | `rankFieldKey` = `customfield_10105` when `rankCustomFieldId = 10105` | unit | `npx vitest run src/stores/settings.store.test.ts` (or inline) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd taskflow && npx vitest run src/services/jira/rank.test.ts src/lib/issueDisplayUtils.test.ts`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/lib/issueDisplayUtils.test.ts` — covers `isDoneStatus`, `doneSummaryClass`, `priorityStripeClass` (VISUAL-01/04/05)
- [ ] `taskflow/src/services/jira/rank.test.ts` — covers all 9 edge cases from the LexoRank edge-case table (D-09)

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Security Domain

> No new auth flows, session management, access control, or cryptography are introduced by this phase. The only new data persisted is `rankFieldKey` (a non-secret string key like `"customfield_10105"`). No ASVS categories apply.

---

## Sources

### Primary (HIGH confidence)
- Source code inspection: `taskflow/src/routes/dashboard/TaskCard.tsx` — verified existing done-strike implementation and `border-l-2 border-l-muted` stripe anchor
- Source code inspection: `taskflow/src/stores/settings.store.ts` — verified v24 migration pattern and field key persistence idiom
- Source code inspection: `taskflow/src/services/jira/greenhopper/types.ts` lines 204–222 — verified `GhBacklogResponse.rankCustomFieldId: number`
- Source code inspection: `taskflow/src/services/jira/greenhopper/__fixtures__/data.real.json` line 7211 — verified `rankCustomFieldId: 10105`
- Source code inspection: `taskflow/src/lib/epicColors.ts` — verified Jira-value → Tailwind class mapping pattern
- Source code inspection: `taskflow/src/lib/statusStyles.ts` — verified `dark:` prefix pattern for theme variants
- Source code inspection: `taskflow/src/main.tsx` lines 64–110 — verified custom field discovery pattern
- JavaScript computation: WCAG relative luminance formula applied to Tailwind v3 palette sRGB values — verified contrast ratios for all priority stripe shades in both themes

### Secondary (MEDIUM confidence)
- `taskflow/src/routes/standup-notes/TodayInProgressSection.tsx` line 105, `TodayUpNextSection.tsx` line 109 — grep-verified issue key span structure
- `taskflow/src/routes/dashboard/BacklogRow.tsx` line 79 — grep-verified issue key span structure

### Tertiary (LOW confidence / ASSUMED)
- Jira LexoRank wire format `{bucket}|{value}:` — training knowledge + implicit from fixture values; not officially documented by Atlassian

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all dependencies verified in codebase
- Architecture: HIGH — verified against source files, no ambiguity
- WCAG palette: HIGH — computed via WCAG formula; key correction (yellow-500 fails in light mode) is definitive
- LexoRank algorithm: MEDIUM — algorithm logic is well-understood; wire format is assumed
- Pitfalls: HIGH — derived from code inspection and WCAG computation

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (stable domain; only changes if Tailwind major version changes or Jira updates LexoRank format)
