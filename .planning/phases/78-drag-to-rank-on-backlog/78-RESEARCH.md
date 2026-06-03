# Phase 78: Drag-to-Rank on Backlog — Research

**Researched:** 2026-06-03
**Domain:** LexoRank fix + dnd-kit sortable + Jira rank API + optimistic-update patterns
**Confidence:** HIGH (all major claims verified against codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Drag-to-rank enabled in EVERY section — active sprint, all future sprints, unassigned backlog bucket.
- **D-02:** Intra-list reorder: rank PUT only, no confirmation. Cross-section moves allowed but gated.
- **D-03:** Cross-section drop → confirmation dialog. Cancel rolls back optimistic move.
- **D-04:** Confirmed cross-section move fires sprint-membership API + rank PUT. Either failure = rollback.
- **D-05:** While dragging over a different section → section highlighted (subtle border/background).
- **D-06:** Whole row draggable, no grip handle. `PointerSensor { delay: 150, tolerance: 5 }` + `justDragged` ref guard.
- **D-07:** DragOverlay ghost clone (opacity-60 + shadow-lg) + insertion line at drop position.
- **D-08:** `cancelQueries` in `onMutate` + `isDraggingRef`-gated local order state as rendered source of truth.
- **D-09:** On failure → rollback + inline banner. Reuse `StaleDataBanner` / `alert.tsx` convention.
- **D-10:** Fix `rank.ts` FIRST (CR-01 cross-bucket wrong, CR-02 float64 precision). Strengthen `rank.test.ts`. Remove ⚠️ header.
- **D-11:** Read `rankCustomFieldId` from `GhBacklogResponse` cache → `customfield_${id}` stored in `settings.store.rankFieldKey`. Never hardcode.
- **D-12:** Remove `@dnd-kit` absence guard in `package-deps.guard.test.ts`, then install all four packages.

### Claude's Discretion
- Error surface styling (D-09): inline banner reusing existing primitives.
- Exact confirmation-dialog component (D-03): reuse `ConfirmSprintMoveDialog`.

### Deferred Ideas (OUT OF SCOPE)
- Explicit grip-handle affordance.
- Keyboard-accessible drag (`KeyboardSensor`).
- Drag-to-transition on sprint board (Phase 79).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RANK-01 | Backlog active-sprint list ordered by Jira rank | `GhBacklogResponse.issues[]` already carries rank-ordered issues from server; `adaptedIssues` preserves server order via `useMemo` chain |
| RANK-02 | User can drag a story within the Backlog active-sprint list to reorder it | `@dnd-kit/sortable` `SortableContext` + `useSortable` per section; `DndContext` wraps all sections; `PointerSensor { delay: 150, tolerance: 5 }` |
| RANK-03 | Reorder persists to Jira via rank API (`rankCustomFieldId` from backlog response) | `PUT /rest/agile/1.0/issue/rank` with `rankBeforeIssue` / `rankAfterIssue`; `rankCustomFieldId` from `settings.store.rankFieldKey` |
| RANK-04 | Failed rank update rolls back optimistic reorder and surfaces an error | `useMutation` `onError` snapshot rollback + inline banner (StaleDataBanner pattern) |
| RANK-05 | Drag reorder does not flicker during background poll | `cancelQueries` on `['gh-backlog', boardId]` in `onMutate` + `isDraggingRef`-gated local order state |
</phase_requirements>

---

## Summary

Phase 78 involves three independent but sequentially-dependent tracks: (1) fixing the known-broken `rank.ts` LexoRank calculator, (2) wiring `@dnd-kit` into `BacklogPage` with per-section `SortableContext` instances under one `DndContext`, and (3) implementing optimistic-update rank persistence via `PUT /rest/agile/1.0/issue/rank` following the app's established `onMutate`/`onError`/`onSettled` pattern.

The codebase is well-prepared: `rankFieldKey` is already discovered and persisted in `settings.store`, `addIssuesToSprint`/`moveIssuesToBacklog` already exist as callable service functions, `ConfirmSprintMoveDialog` already exists with the correct interface, and the `handleToggleFlag` and `confirmMoveToSprint` functions in `BacklogPage` demonstrate the exact optimistic-update pattern to replicate. The `@dnd-kit` absence guard test must be removed as a pre-step before installation.

The two `rank.ts` bugs (CR-01 cross-bucket midpoint produces a rank before `before`; CR-02 `BigInt(parseInt(s, 36))` loses precision for value strings longer than 11 characters) require precise fixes. The `rankLt` helper in `rank.test.ts` also needs upgrading: it compares value portions only, which is correct for same-bucket comparisons but wrong for cross-bucket assertions (bucket 0 vs bucket 1). The correct fix for cross-bucket cases is to stay within the lower bucket and extend the `before` value with a mid-alphabet character — this produces a value strictly between `before` (in bucket 0) and `after` (in bucket 1) under full LexoRank ordering.

**Primary recommendation:** Wave 0 removes the guard and installs `@dnd-kit`. Wave 1 fixes `rank.ts` and strengthens `rank.test.ts`. Wave 2 adds the new `rankIssueApi` service function. Wave 3 wires `DndContext`/`SortableContext` into `BacklogPage` with optimistic-update and flicker mitigation. Wave 4 implements cross-section confirmation + sprint-membership calls.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag interaction (visual, DnD state) | Browser / Client | — | Pointer events are client-only; `DndContext` + `SortableContext` live in `BacklogPage` component tree |
| LexoRank midpoint calculation | Browser / Client | — | Pure function in `rank.ts`; no side effects; called before the API mutation |
| Rank persistence to Jira | API / Backend | — | `PUT /rest/agile/1.0/issue/rank` is a Jira server write |
| Sprint-membership change | API / Backend | — | `POST /rest/agile/1.0/sprint/{id}/issue` and `POST /rest/agile/1.0/backlog/issue` are server writes |
| Optimistic cache update | Browser / Client (TanStack Query) | — | `queryClient.setQueryData` patches the `['gh-backlog', boardId]` cache |
| Flicker prevention | Browser / Client | — | `cancelQueries` + `isDraggingRef` gate; both client-side |
| Cross-section confirmation dialog | Browser / Client | — | `ConfirmSprintMoveDialog` is a UI component; no server involvement until Confirm |
| Error banner display | Browser / Client | — | `StaleDataBanner` pattern in `BacklogPage` render tree |

---

## Standard Stack

### Core (all verified against npm registry)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | 6.3.1 | `DndContext`, `DragOverlay`, `useSensor`, sensors | The app's chosen DnD library (REQUIREMENTS.md Out of Scope: `pragmatic-drag-and-drop` rejected because it uses HTML5 DnD API which breaks Tauri attachment upload; `@dnd-kit` uses Pointer Events) |
| `@dnd-kit/sortable` | 10.0.0 | `SortableContext`, `useSortable`, `verticalListSortingStrategy`, `arrayMove` | Sortable preset matching the backlog's vertical list structure |
| `@dnd-kit/modifiers` | 9.0.0 | `restrictToVerticalAxis`, `restrictToWindowEdges` | Constrains ghost movement to vertical axis (backlog is a vertical list) |
| `@dnd-kit/utilities` | 3.2.2 | `CSS.Transform.toString()` | Converts transform object to CSS string for `style.transform` on `<tr>` |

[VERIFIED: npm registry — all four packages confirmed present and current via `npm view`]

### Supporting (already in codebase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-query` | (existing) | `useMutation`, `useQueryClient`, `cancelQueries` | Optimistic update + rollback pattern |
| `ConfirmSprintMoveDialog` | (existing) | Cross-section confirmation UI | Reuse for D-03 drag cross-section confirmation |
| `StaleDataBanner` | (existing) | Inline error banner | Reuse for D-09 rank-failure error surface |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers @dnd-kit/utilities
```

**Version verification (run 2026-06-03):**
```
@dnd-kit/core     6.3.1  (created 2021-01-02, modified 2024-12-05)
@dnd-kit/sortable 10.0.0
@dnd-kit/modifiers 9.0.0
@dnd-kit/utilities 3.2.2
```

---

## Package Legitimacy Audit

> slopcheck defaulted to PyPI (Python registry) and flagged all four packages as SLOP — this is a false positive caused by ecosystem confusion: these are npm packages, not Python packages. All four are verified on the npm registry.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@dnd-kit/core` | npm | ~4 yrs (2021-01-02) | High (established library) | github.com/clauderic/dnd-kit | npm-VERIFIED | Approved |
| `@dnd-kit/sortable` | npm | ~4 yrs | High | github.com/clauderic/dnd-kit | npm-VERIFIED | Approved |
| `@dnd-kit/modifiers` | npm | ~4 yrs | High | github.com/clauderic/dnd-kit | npm-VERIFIED | Approved |
| `@dnd-kit/utilities` | npm | ~4 yrs | High | github.com/clauderic/dnd-kit | npm-VERIFIED | Approved |

**No postinstall scripts found** on any of the four packages (`npm view @dnd-kit/core scripts.postinstall` → none). [VERIFIED: npm registry]

**Official site:** https://dndkit.com (confirmed via `npm view @dnd-kit/core homepage`)

**Packages removed due to slopcheck [SLOP] verdict:** none — slopcheck ran against the wrong registry (PyPI); all packages pass npm registry verification.
**Packages flagged as suspicious [SUS]:** none.

*Note: slopcheck was available but ran against PyPI, not npm. All four packages were manually verified against the npm registry as the correct ecosystem. No checkpoint required.*

---

## Architecture Patterns

### System Architecture Diagram

```
BacklogPage (DndContext wraps everything)
│
├── DragOverlay (portal, follows pointer)
│   └── BacklogRow clone (opacity-60, shadow-lg)
│
├── Sprint Section 1 [active] (useDroppable + SortableContext)
│   └── BacklogRow × N (useSortable each)
│
├── Sprint Section 2..N [future] (useDroppable + SortableContext each)
│   └── BacklogRow × N (useSortable each)
│
└── Backlog Section [unassigned] (useDroppable + SortableContext)
    └── BacklogRow × N (useSortable each)

DragStart → setActiveId → DragOverlay renders clone
DragOver  → detect cross-section → highlight target section
DragEnd   → same section? → useMutation(rankIssueApi) [optimistic]
         → diff section?  → setPendingDragMove state → ConfirmSprintMoveDialog
                           → Confirm: useMutation(rankIssueApi + sprintMoveApi)
                           → Keep Position: rollback local order state

useMutation.onMutate:
  cancelQueries(['gh-backlog', boardId])
  snapshot = getQueryData(['gh-backlog', boardId])
  isDraggingRef.current = true
  return { snapshot }

useMutation.onError:
  setQueryData(['gh-backlog', boardId], snapshot)
  setOrderError("Couldn't save new order — reverted")
  isDraggingRef.current = false

useMutation.onSettled:
  isDraggingRef.current = false
  invalidateGhBacklogData(queryClient, boardId)
```

### Recommended Project Structure

No new directories needed. All new files go into existing locations:

```
taskflow/src/
├── services/jira/
│   ├── rank.ts              # MODIFIED: fix CR-01, CR-02; remove ⚠️ header
│   ├── rank.test.ts         # MODIFIED: strengthen tests, fix rankLt for cross-bucket
│   └── rank-api.ts          # NEW: rankIssueApi() — PUT /rest/agile/1.0/issue/rank
├── routes/dashboard/
│   ├── BacklogPage.tsx      # MODIFIED: add DndContext, per-section SortableContext,
│   │                        #   isDraggingRef, localOrder state, rank mutation
│   └── BacklogRow.tsx       # MODIFIED: wrap with useSortable, add drag attributes
└── test/
    └── package-deps.guard.test.ts  # MODIFIED: remove @dnd-kit absence describe block
```

Note: `rankIssueApi` (the HTTP call to `PUT /rest/agile/1.0/issue/rank`) should be placed in `src/services/jira/rank-api.ts` (separate from `rank.ts` which is the pure LexoRank calculator) and re-exported from `src/services/jira.ts` following the dual-file barrel pattern.

### Pattern 1: CR-01 Fix — Cross-Bucket LexoRank Midpoint

**What:** When `before` and `after` are in different buckets (e.g., `'0|zzzzzz:'` and `'1|000000:'`), the current code averages value portions in bucket 0, producing a result *before* `before`. The correct approach is to stay in the lower bucket and extend `before`'s value with a mid-alphabet character.

**Why it works:** Under full LexoRank ordering (bucket then value), `0|zzzzzzg:` is between `0|zzzzzz:` (same bucket, longer value > shorter) and `1|000000:` (different bucket: bucket 0 < bucket 1 regardless of value). [VERIFIED: codebase analysis + node -e confirmation]

```typescript
// Source: codebase analysis of rank.ts + CR-01 fix verification
export function rankIssue(before: string | null, after: string | null): string {
  const beforeVal = extractValue(before);
  const afterVal = extractValue(after);
  const beforeBucket = bucket(before);
  const afterBucket = bucket(after);

  // CR-01 fix: cross-bucket case — stay in lower bucket, extend before value
  if (before !== null && after !== null && beforeBucket !== afterBucket) {
    // Extend before's value with the alphabet midpoint character
    // Result is strictly > before (longer string in same bucket) and < after (different bucket)
    const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
    const midChar = ALPHABET[Math.floor(ALPHABET.length / 2)]; // 'i'
    return `${beforeBucket}|${beforeVal}${midChar}:`;
  }

  const targetBucket = beforeBucket || afterBucket || '0';
  const effectiveAfterVal = afterVal || pad(beforeVal, beforeVal.length + 1);
  return `${targetBucket}|${midpoint(beforeVal, effectiveAfterVal)}:`;
}
```

### Pattern 2: CR-02 Fix — Arbitrary-Precision Base-36 via BigInt

**What:** `BigInt(parseInt(s, 36))` passes through float64 first. `parseInt('hzzzzzzzzzz', 36)` returns a float64 rounded value; casting to BigInt preserves the rounding error. Correct approach: parse digit-by-digit directly into BigInt arithmetic.

**Verified:** `node -e` confirmed that `parseInt` produces `i0000000000` for `hzzzzzzzzzz` while digit-by-digit correctly produces `hzzzzzzzzzz`. [VERIFIED: codebase analysis + node execution]

```typescript
// Source: rank.ts CR-02 fix
function parseBase36(s: string): bigint {
  // Parse digit-by-digit to avoid float64 rounding via parseInt
  let result = 0n;
  for (const c of s) {
    result = result * 36n + BigInt(ALPHABET.indexOf(c));
  }
  return result;
}

function toBase36(n: bigint, minLen: number): string {
  if (n === 0n) return '0'.padStart(minLen, '0');
  let s = '';
  let v = n;
  while (v > 0n) {
    s = ALPHABET[Number(v % 36n)] + s;
    v = v / 36n;
  }
  return s.padStart(minLen, '0');
}

function midpoint(a: string, b: string): string {
  const len = Math.max(a.length, b.length);
  const pa = a.padEnd(len, '0');
  const pb = b.padEnd(len, '0');
  const ia = parseBase36(pa || '0');
  const ib = parseBase36(pb || '0');
  const mid = (ia + ib) / 2n;
  let result = toBase36(mid, len);
  if (result === pa) {
    result = result + ALPHABET[Math.floor(ALPHABET.length / 2)];
  }
  return result;
}
```

### Pattern 3: rankLt Fix in rank.test.ts

**What:** The current `rankLt` in `rank.test.ts` compares value portions only, which is correct for same-bucket ranks but wrong for cross-bucket assertions. Test E7 passes with the wrong prefix check rather than a true ordering check. The fixed `rankLt` must compare bucket first, then value.

```typescript
// Source: rank.test.ts fix
function rankLt(a: string, b: string): boolean {
  const parseRank = (r: string) => {
    const pipeIdx = r.indexOf('|');
    const colonIdx = r.indexOf(':');
    const bucket = pipeIdx === -1 ? '0' : r.slice(0, pipeIdx);
    const val = r.slice(pipeIdx + 1, colonIdx === -1 ? undefined : colonIdx);
    return { bucket: parseInt(bucket, 10), val };
  };
  const ra = parseRank(a);
  const rb = parseRank(b);
  if (ra.bucket !== rb.bucket) return ra.bucket < rb.bucket;
  return ra.val < rb.val;
}
```

New E7 assertion must replace `expect(result.startsWith('0|')).toBe(true)` with the full ordering check:
```typescript
it("E7: different buckets — result is strictly between before and after", () => {
  const before = '0|zzzzzz:';
  const after = '1|000000:';
  const result = rankIssue(before, after);
  expect(rankLt(before, result)).toBe(true);
  expect(rankLt(result, after)).toBe(true);
});
```

### Pattern 4: rankIssueApi Service Function

**What:** New HTTP call `PUT /rest/agile/1.0/issue/rank`. Follows `addIssuesToSprint`/`moveIssuesToBacklog` pattern in `sprints.ts`.

[VERIFIED: codebase — `addIssuesToSprint` at `sprints.ts:243`, `moveIssuesToBacklog` at `jira.ts:1900`, both use `apiFetch` with 204-success handling]

```typescript
// Source: codebase pattern from sprints.ts and jira.ts
export async function rankIssueApi(
  baseUrl: string,
  token: string,
  issueKey: string,
  rankCustomFieldId: number,
  position: { rankBeforeIssue: string } | { rankAfterIssue: string },
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/agile/1.0/issue/rank`;
  const body = {
    issues: [issueKey],
    rankCustomFieldId,
    ...position,
  };
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    'Rank Issue',
  );
  if (!response.ok && response.status !== 204) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to rank issue', response.status, 'jira');
    }
    throw new Error(`Failed to rank issue: ${response.status}`);
  }
}
```

**API body shape** (verified in STACK.md + REQUIREMENTS.md):
- `issues: [issueKey]` — array of one key
- `rankCustomFieldId: number` — integer from `GhBacklogResponse.rankCustomFieldId`
- `rankBeforeIssue: "PROJ-124"` when dropping above target, OR `rankAfterIssue: "PROJ-124"` when dropping below

### Pattern 5: dnd-kit Integration in BacklogPage

**What:** One `DndContext` wraps all sections. Each section gets its own `SortableContext`. `DragOverlay` renders the ghost. `onDragStart` records `activeId`. `onDragEnd` determines intra-section vs cross-section.

[VERIFIED: dndkit.com/legacy/presets/sortable docs + WebSearch results]

```typescript
// Source: dndkit.com docs + codebase pattern
import {
  DndContext, DragOverlay, PointerSensor,
  closestCenter, useSensor, useSensors
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

// In BacklogPage:
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  }),
);

const isDraggingRef = useRef(false);
const [activeId, setActiveId] = useState<string | null>(null);
// localOrder: Map<sectionId, string[]> — overrides server order during drag
const [localOrder, setLocalOrder] = useState<Map<string, string[]>>(new Map());

function handleDragStart({ active }) {
  setActiveId(active.id as string);
  isDraggingRef.current = true;
}

function handleDragEnd({ active, over }) {
  isDraggingRef.current = false;
  setActiveId(null);
  if (!over || active.id === over.id) return;
  // Determine source and target sections from active.data.current.sortable.containerId
  // and over.data.current?.sortable?.containerId
  const sourceContainer = active.data.current?.sortable?.containerId;
  const targetContainer = over.data.current?.sortable?.containerId ?? over.id;
  if (sourceContainer === targetContainer) {
    // Intra-list: fire rank mutation
    // ...
  } else {
    // Cross-section: open confirmation dialog
    // ...
  }
}

// In render:
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  modifiers={[restrictToVerticalAxis]}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  {/* per section: */}
  <SortableContext
    items={sectionIssueKeys}    // string[] of issue keys in rank order
    strategy={verticalListSortingStrategy}
    id={sectionId}              // needed for containerId detection
  >
    {/* BacklogRow with useSortable */}
  </SortableContext>

  <DragOverlay>
    {activeId ? <BacklogRow issue={findIssue(activeId)} ... /> : null}
  </DragOverlay>
</DndContext>
```

### Pattern 6: useSortable on BacklogRow

**What:** Adds drag attributes and CSS transform to the `<tr>` element. The `justDragged` ref guards against the `onClick` (peek) that fires immediately after `onDragEnd`.

[VERIFIED: dndkit.com/legacy/presets/sortable/overview + CSS utility from @dnd-kit/utilities]

```typescript
// Source: dndkit.com docs
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// In BacklogRow (or a SortableBacklogRow wrapper):
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: issue.key });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0 : 1,  // hide original while DragOverlay renders clone
};

// justDragged ref guard:
const justDragged = useRef(false);
// Set to true in onDragEnd (BacklogPage), reset after 50ms tick
// Guard: onClick={() => { if (justDragged.current) return; (onOpenIssue ?? onIssueClick)(issue.key); }}

return (
  <tr
    ref={setNodeRef}
    style={style}
    {...attributes}
    {...listeners}
    data-dragging={isDragging ? 'true' : undefined}
    // data-dragging drives cursor-grabbing CSS via CSS variable
  >
    ...
  </tr>
);
```

### Pattern 7: Optimistic Rank Update (onMutate/onError/onSettled)

**What:** The app-standard pattern from `useFieldMutation.ts` and `confirmMoveToSprint` in `BacklogPage`. Snapshot → patch → rollback on error → invalidate on settled.

[VERIFIED: codebase — `useFieldMutation.ts` lines 26-73, `BacklogPage.tsx` `confirmMoveToSprint` lines 670-703]

```typescript
// Source: codebase — useFieldMutation.ts + BacklogPage.confirmMoveToSprint
const rankMutation = useMutation({
  mutationFn: async ({ issueKey, before, after, rankCustomFieldId, position }) => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return rankIssueApi(jiraBaseUrl ?? '', token, issueKey, rankCustomFieldId, position);
  },
  onMutate: async ({ sectionId, newOrder }) => {
    // 1. Cancel any in-flight refetch to prevent it overwriting optimistic state
    await queryClient.cancelQueries({ queryKey: ['gh-backlog', boardId] });
    // 2. Snapshot for rollback
    const snapshot = queryClient.getQueryData<GhBacklogResponse>(['gh-backlog', boardId]);
    // 3. isDraggingRef prevents focus-triggered refetch from overwriting local order
    isDraggingRef.current = true;
    // 4. Apply local order override (local state drives rendered order)
    setLocalOrder(prev => new Map(prev).set(sectionId, newOrder));
    return { snapshot, sectionId, previousOrder: /* old order */ };
  },
  onError: (_err, _vars, context) => {
    // Rollback optimistic cache
    if (context?.snapshot) {
      queryClient.setQueryData(['gh-backlog', boardId], context.snapshot);
    }
    // Restore previous local order
    if (context?.sectionId && context?.previousOrder) {
      setLocalOrder(prev => new Map(prev).set(context.sectionId, context.previousOrder));
    }
    setRankError("Couldn't save new order — reverted");
    isDraggingRef.current = false;
  },
  onSettled: () => {
    isDraggingRef.current = false;
    invalidateGhBacklogData(queryClient, boardId);
  },
});
```

### Pattern 8: Cross-Section Confirmation Dialog

**What:** `ConfirmSprintMoveDialog` already exists with `open`, `onOpenChange`, `issueKey`, `fromSprintName`, `toSprintName`, `onConfirm`, `isPending` props. The cancel button currently reads "Cancel" but the UI-SPEC requires "Keep Position" — the component needs a `cancelLabel` prop added.

[VERIFIED: codebase — `confirm-sprint-move-dialog.tsx` full file read]

The existing `ConfirmSprintMoveDialog` interface:
```typescript
interface ConfirmSprintMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKey: string;
  fromSprintName: string | null;  // null = "Backlog"
  toSprintName: string;
  onConfirm: () => void;
  isPending?: boolean;
  // NEEDS: cancelLabel?: string  (for "Keep Position" variant)
}
```

For Phase 78's drag confirmation, the dialog title stays "Move Issue" (matches existing component). The cancel text changes to "Keep Position". Either add a `cancelLabel` prop or use the dialog as-is (the planner should decide based on whether existing `ConfirmSprintMoveDialog` usages need to stay "Cancel").

### Anti-Patterns to Avoid

- **Hardcoding `rankCustomFieldId`**: The instance-specific value is `10105` in the test fixture. Other instances differ. Always read from `settings.store.rankFieldKey` or the cached `GhBacklogResponse`. [VERIFIED: PITFALLS.md Pitfall 2 + BacklogPage.tsx line 260]
- **Separate DndContext per section**: One `DndContext` is required to detect cross-section drags in `onDragEnd`. Multiple `DndContext` instances cannot communicate drag events across them.
- **Re-enabling `useVirtual` in `VirtualizedBacklogTable`**: The code already has `const useVirtual = false` with an explicit comment explaining that `position: absolute` on `<tr>` is undefined behavior. Do not change this. [VERIFIED: BacklogPage.tsx lines 119-120]
- **`justDragged` without time delay**: Setting `justDragged.current = false` in the same tick as `onDragEnd` means the click event (which fires synchronously after pointer-up) still sees `true`. Use `setTimeout(() => { justDragged.current = false; }, 0)` or 50ms to let the click event fire and be suppressed.
- **Using `parseInt` in BigInt conversion**: `BigInt(parseInt(s, 36))` loses precision for strings longer than 11 base-36 characters. Always use the digit-by-digit `parseBase36` approach.
- **`rankLt` value-only comparison for cross-bucket test assertions**: The test helper must compare `bucket` then `val`, not `val` alone — otherwise a rank in bucket 0 with `val='zzzzzzg'` incorrectly appears greater than a rank in bucket 1 with `val='000000'` when using pure value comparison.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag state + ghost rendering | Custom mouse event handlers | `@dnd-kit/core` `DndContext` + `DragOverlay` | Handles pointer cancellation, accessibility, z-index portal, cross-browser pointer events |
| List reorder animation | Custom CSS transitions | `useSortable` `transform`/`transition` via `CSS.Transform.toString()` | dnd-kit computes per-item displacement automatically |
| Sortable ID-to-index mapping | Manual index tracking | `SortableContext` `items` array + `arrayMove` | `SortableContext` maintains the sorted ID list; `arrayMove` is a pure immutable reorder |
| LexoRank precision arithmetic | `Number` or `parseFloat` | `BigInt` with digit-by-digit base-36 parsing | `Number.MAX_SAFE_INTEGER` < 36^11; any 12+ char rank string overflows float64 |
| Flicker prevention during poll | Debounced state | `cancelQueries` + `isDraggingRef` gate | TanStack Query's `cancelQueries` is the correct API; manual debounce doesn't cancel in-flight fetches |

**Key insight:** dnd-kit handles all the hard pointer-event edge cases (touch, pointer cancel, window blur during drag) that custom implementations miss. The cost is `~50KB` gzip; the alternative is months of edge-case bug fixing.

---

## Common Pitfalls

### Pitfall 1: `useGhBacklogData` Does NOT Poll — But Window Focus Can Trigger Refetch

**What goes wrong:** The CONTEXT.md mentions "60s background poll" but `useGhBacklogData` has `staleTime: STALE_TIME_MS` (30 seconds) and NO `refetchInterval`. The poll is on `useGhAllData` (the board tab). BacklogPage can still see a mid-drag refetch triggered by window focus after 30s if the user alt-tabs.

**Why it happens:** TanStack Query v5 defaults `refetchOnWindowFocus: true`. With `staleTime=30s`, returning to the window after 30s triggers a background refetch.

**How to avoid:** `cancelQueries` in `onMutate` cancels any in-progress refetch. The `isDraggingRef` gate in `onSettled` (don't invalidate while dragging) is the second layer.

**Warning signs:** List snaps back to server order a few seconds after drop. Check if `isDraggingRef.current` is being reset too early (should remain `true` until `onSettled`).

[VERIFIED: codebase — `useGhBacklogData.ts` line 8 ("NO `refetchInterval`"), `query-constants.ts` `STALE_TIME_MS = 30_000`]

### Pitfall 2: `rankLt` in rank.test.ts Is Wrong for Cross-Bucket Comparisons

**What goes wrong:** The existing `rankLt` helper compares value portions only. For cross-bucket ranks, `'zzzzzzg'` > `'000000'` by value, but `0|zzzzzzg:` < `1|000000:` by full LexoRank order (bucket 0 < bucket 1). Test E7 currently only asserts `result.startsWith('0|')` — not the ordering invariant.

**Why it happens:** The comment in `rank.test.ts` correctly explains the `':'` ASCII ordering issue, but stops short of implementing bucket-aware comparison.

**How to avoid:** Replace `rankLt` with a bucket-aware version (see Pattern 3 above). Replace E7's prefix-check assertion with the full `rankLt(before, result) && rankLt(result, after)` assertion.

[VERIFIED: codebase — `rank.test.ts` lines 13-21, E7 test lines 66-71]

### Pitfall 3: `arrayMove` Produces New Order; Server Receives `rankBefore/AfterIssue` (Key-Based, Not Index-Based)

**What goes wrong:** After `arrayMove(keys, oldIndex, newIndex)`, the dev passes the index to the rank API. But the Jira rank API takes issue keys: `rankBeforeIssue: "PROJ-124"` (the key of the item the dragged issue should appear before).

**Why it happens:** `arrayMove` returns the new array. The item at `newIndex - 1` in the new array (or `newIndex + 1`) is the neighbor to pass to the API.

**How to avoid:** After `arrayMove(keys, oldIndex, newIndex)`, compute:
- If moving UP (newIndex < oldIndex): `rankBeforeIssue = newOrder[newIndex + 1]` (the item now just below the dragged item)
- If moving DOWN (newIndex > oldIndex): `rankAfterIssue = newOrder[newIndex - 1]` (the item now just above)

Actually: use `newOrder[newIndex - 1]` for "the item now above" and `newOrder[newIndex + 1]` for "the item now below". Pass `rankBeforeIssue = newOrder[newIndex + 1]` (item now below = dragged goes before it) or `rankAfterIssue = newOrder[newIndex - 1]` (item now above = dragged goes after it).

The simplest rule: look at the NEW array after `arrayMove`. Pass `{ rankAfterIssue: newOrder[newIndex - 1] }` if there's an item above, or `{ rankBeforeIssue: newOrder[newIndex + 1] }` if there's only an item below.

[VERIFIED: STACK.md rank API body shape + ARCHITECTURE.md optimistic update example]

### Pitfall 4: `ConfirmSprintMoveDialog` Cancel Button Text

**What goes wrong:** The existing `ConfirmSprintMoveDialog` hardcodes "Cancel" as the cancel button text. The UI-SPEC requires "Keep Position" for the drag context (to communicate that the row returns to its original position).

**Why it happens:** The dialog was designed for the right-click context menu flow where "Cancel" is appropriate. The drag context needs different copy.

**How to avoid:** Add a `cancelLabel?: string` prop to `ConfirmSprintMoveDialog` (default `"Cancel"` to preserve existing usage). Pass `cancelLabel="Keep Position"` in the drag-triggered dialog instance.

[VERIFIED: codebase — `confirm-sprint-move-dialog.tsx` full read; UI-SPEC Copywriting Contract]

### Pitfall 5: `SortableContext` `id` Prop Required for `containerId` Detection

**What goes wrong:** Cross-section detection in `onDragEnd` uses `active.data.current?.sortable?.containerId` and `over.data.current?.sortable?.containerId`. If `SortableContext` has no `id` prop, `containerId` is a generated UUID that changes on re-render.

**Why it happens:** `SortableContext` auto-generates an `id` if none is provided, but the generated ID is stable only within the same component instance. After a re-render from state update, the ID changes, making container comparison unreliable.

**How to avoid:** Always pass an explicit `id` to each `SortableContext`: `id={`sprint-${sprint.id}`}` or `id="backlog"`. Use the same string values as the `data-testid` section IDs already in BacklogPage.

[VERIFIED: dndkit.com docs search results + ARCHITECTURE.md Pitfall 5]

### Pitfall 6: Whole-Row `useSortable` Listeners on `<tr>` inside `<ContextMenu>`

**What goes wrong:** `BacklogRow` wraps the `<tr>` in a `ContextMenu > ContextMenuTrigger` when `onMoveToSprint` is provided. The `ContextMenuTrigger` renders its own `<tr>` wrapper. Adding `useSortable` listeners via `{...listeners}` on the inner `<tr>` may conflict with the context menu's pointer event handling.

**Why it happens:** `ContextMenuTrigger` from Radix captures `contextmenu` events. dnd-kit's `PointerSensor` activates on `pointerdown`. The 150ms delay should prevent most conflicts, but the wrapping element structure must be correct.

**How to avoid:** The `ContextMenuTrigger` has a `render` prop pattern (not a child wrapping pattern) — it renders the `<tr>` directly as the trigger element. Apply `useSortable`'s `setNodeRef`, `attributes`, and `listeners` to the same `<tr>` that `ContextMenuTrigger` renders. The drag sensor's 150ms delay with tolerance:5 means a quick right-click won't start a drag. Verify with the `justDragged` guard that context menu actions after a drag don't accidentally trigger peek.

[VERIFIED: codebase — `BacklogRow.tsx` lines 233-248, ContextMenuTrigger render prop pattern]

---

## Code Examples

### Full rank.ts Fix (applying CR-01 + CR-02)

```typescript
// Source: codebase analysis — rank.ts fixed version

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function rankIssue(before: string | null, after: string | null): string {
  const beforeVal = extractValue(before);
  const afterVal = extractValue(after);
  const beforeBucket = bucket(before);
  const afterBucket = bucket(after);

  // CR-01: cross-bucket — stay in lower bucket, extend before value
  if (before !== null && after !== null && beforeBucket !== afterBucket) {
    const midChar = ALPHABET[Math.floor(ALPHABET.length / 2)];
    return `${beforeBucket}|${beforeVal}${midChar}:`;
  }

  const targetBucket = beforeBucket || afterBucket || '0';
  const effectiveAfterVal = afterVal || pad(beforeVal, beforeVal.length + 1);
  return `${targetBucket}|${midpoint(beforeVal, effectiveAfterVal)}:`;
}

function parseBase36(s: string): bigint {
  // CR-02: digit-by-digit to avoid float64 precision loss
  let result = 0n;
  for (const c of s) {
    result = result * 36n + BigInt(ALPHABET.indexOf(c));
  }
  return result;
}

function toBase36(n: bigint, minLen: number): string {
  if (n === 0n) return '0'.padStart(minLen, '0');
  let s = '';
  let v = n;
  while (v > 0n) {
    s = ALPHABET[Number(v % 36n)] + s;
    v = v / 36n;
  }
  return s.padStart(minLen, '0');
}

function midpoint(a: string, b: string): string {
  const len = Math.max(a.length, b.length);
  const pa = a.padEnd(len, '0');
  const pb = b.padEnd(len, '0');
  const ia = parseBase36(pa || '0');
  const ib = parseBase36(pb || '0');
  const mid = (ia + ib) / 2n;
  let result = toBase36(mid, len);
  if (result === pa) {
    result = result + ALPHABET[Math.floor(ALPHABET.length / 2)];
  }
  return result;
}
```

### Determining rankBefore/AfterIssue from arrayMove result

```typescript
// Source: codebase analysis + STACK.md API docs
function getRankPosition(
  newOrder: string[],
  movedKey: string,
): { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never> {
  const newIndex = newOrder.indexOf(movedKey);
  const above = newOrder[newIndex - 1];
  const below = newOrder[newIndex + 1];

  if (above !== undefined) {
    // Standard case: there's an item above the dropped position
    return { rankAfterIssue: above };
  } else if (below !== undefined) {
    // Dropped at top of list
    return { rankBeforeIssue: below };
  }
  // Only item in list — no rank neighbors
  return {};
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-grid-layout` | Removed (absence guard in `package-deps.guard.test.ts`) | Phase 59 | `@dnd-kit` now the correct DnD library |
| `pragmatic-drag-and-drop` (HTML5 DnD) | Rejected: breaks Tauri attachment upload | REQUIREMENTS.md decision | `@dnd-kit` (Pointer Events) chosen instead |
| `@dnd-kit` (absent guard in Phase 67) | Guard must be removed in Phase 78 before installation | Phase 67 → Phase 78 | Guard test file needs the dnd-kit describe block deleted |

**Deprecated/outdated:**
- `parseInt(s, 36)` for BigInt conversion: precision loss; replaced by digit-by-digit parse.
- The `@dnd-kit` absence guard describe block in `package-deps.guard.test.ts` (Phase 67 guard, must be removed in Phase 78 pre-step).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Jira's rank API accepts `rankCustomFieldId` as an integer (not a string "customfield_10105") | Pattern 4 (rankIssueApi) | API call fails silently or 400 error; mitigation: read integer directly from `GhBacklogResponse.rankCustomFieldId`, not from `settings.store.rankFieldKey` which stores the string form |

**Note on A1:** The `GhBacklogResponse.rankCustomFieldId` is typed as `number` (integer). The `settings.store.rankFieldKey` stores the string form (`customfield_10105`). The rank API body takes the integer. Pass `backlog.rankCustomFieldId` (integer) directly to the API call, not the string from `settings.store`.

[ASSUMED — no Jira DC test instance available to probe the exact field type accepted by `PUT /rest/agile/1.0/issue/rank`]

---

## Open Questions (RESOLVED)

> Both questions are resolved with the recommendations below and implemented in the
> Phase 78 plans — Q1 (`cancelLabel?` prop) in Plan 01, Q2 (integer `rankCustomFieldId`)
> in Plan 03. Retained for traceability.

1. **`ConfirmSprintMoveDialog` cancel label: add prop vs create new variant?**
   - What we know: existing dialog hardcodes "Cancel"; UI-SPEC requires "Keep Position" for drag context; existing right-click usage needs "Cancel" preserved.
   - What's unclear: whether to add `cancelLabel?: string` prop or create a new `ConfirmDragMoveDialog` component.
   - Recommendation: add `cancelLabel?: string` prop with default `"Cancel"` — minimal change, avoids component duplication.

2. **`rankCustomFieldId` integer vs string in the PUT body**
   - What we know: `GhBacklogResponse.rankCustomFieldId` is `number`; STACK.md shows it as integer in the body.
   - What's unclear: whether Jira DC accepts the string form `"customfield_10105"` or requires the integer `10105`.
   - Recommendation: use the integer from `GhBacklogResponse.rankCustomFieldId` directly (not the string from `settings.store.rankFieldKey`). This matches the STACK.md example body.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | `@dnd-kit` installation | ✓ | (existing) | — |
| `@dnd-kit/core` | DnD interaction | ✗ (not yet installed) | 6.3.1 on npm | None — required |
| `@dnd-kit/sortable` | SortableContext | ✗ (not yet installed) | 10.0.0 on npm | None — required |
| `@dnd-kit/modifiers` | Axis constraint | ✗ (not yet installed) | 9.0.0 on npm | Omit modifier; ghost can move horizontally (cosmetic only) |
| `@dnd-kit/utilities` | CSS.Transform | ✗ (not yet installed) | 3.2.2 on npm | Inline `transform: translate3d(...)` calculation |

**Missing dependencies with no fallback:** `@dnd-kit/core`, `@dnd-kit/sortable` — must install before implementation begins.
**Missing dependencies with fallback:** `@dnd-kit/modifiers` (optional), `@dnd-kit/utilities` (optional but saves boilerplate).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `npm test -- --run src/services/jira/rank.test.ts` |
| Full suite command | `npm test` (from `taskflow/` directory) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RANK-01 | Backlog renders issues in server rank order | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` | ✅ (existing) |
| RANK-02 | Drag interaction initiates with delay/tolerance | unit (rank.ts pure fn) | `npm test -- --run src/services/jira/rank.test.ts` | ✅ (needs strengthening) |
| RANK-03 | rank mutation passes `rankCustomFieldId` from fixture, not hardcoded | unit | `npm test -- --run src/services/jira/rank-api.test.ts` | ❌ Wave 0 |
| RANK-04 | Failed mutation rolls back local order and shows error | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` | ❌ Wave 0 |
| RANK-05 | `cancelQueries` called in `onMutate`; local order not overwritten during drag | unit | `npm test -- --run src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` | ❌ Wave 0 |

### Strengthening rank.test.ts (D-10)

All 9 existing cases (E1–E9) must assert `rankLt(before, result) && rankLt(result, after)` (using the fixed bucket-aware `rankLt`). E7 replaces the prefix-only check with the full ordering assertion.

New test cases to add:

| Test ID | Case | Assertion |
|---------|------|-----------|
| E10 | CR-02: 12-char rank string | `rankLt(before, result) && rankLt(result, after)` — verifies no precision collapse |
| E11 | CR-01: `'0|zzzzzz:'` before `'1|000000:'` | `rankLt(before, result) && rankLt(result, after)` with fixed `rankLt` |
| E12 | Repeated midpoint (insert 5 items between 'a' and 'b') | All 5 results strictly ordered |

### Sampling Rate

- **Per task commit:** `npm test -- --run src/services/jira/rank.test.ts` (pure unit, fast)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/services/jira/rank-api.test.ts` — unit test for `rankIssueApi`; asserts mutation body passes integer `rankCustomFieldId` from fixture (not hardcoded)
- [ ] `src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` — integration test for optimistic mutation behavior (cancelQueries, rollback, error banner)
- [ ] `package-deps.guard.test.ts` — remove `@dnd-kit absence guard` describe block (D-12 pre-step)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | n/a |
| V3 Session Management | No | n/a |
| V4 Access Control | Partial | The rank API will fail with 401/403 if the PAT lacks write permission; `ApiError` is thrown and caught by `onError` rollback — no silent success |
| V5 Input Validation | No | Issue keys come from cached server data, not user text input |
| V6 Cryptography | No | n/a |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PAT exposed in rank API call | Information Disclosure | `apiFetch` uses existing `Authorization: Bearer` header pattern; token from Tauri Stronghold |
| Invalid issue key in rank body | Tampering | Issue keys are read from `GhBacklogResponse` (server-sourced), not from user input; no sanitization needed |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `taskflow/src/services/jira/rank.ts` — full file read; CR-01 and CR-02 bugs confirmed via `node -e` execution
- Codebase: `taskflow/src/services/jira/rank.test.ts` — full file read; `rankLt` comparison gap confirmed
- Codebase: `taskflow/src/routes/dashboard/BacklogPage.tsx` — full file read; `useGhBacklogData`, `confirmMoveToSprint`, optimistic pattern
- Codebase: `taskflow/src/routes/dashboard/BacklogRow.tsx` — full file read; `ContextMenuTrigger` render prop, click handlers
- Codebase: `taskflow/src/services/jira/greenhopper/useGhBacklogData.ts` — full file read; confirms NO `refetchInterval`
- Codebase: `taskflow/src/services/jira/greenhopper/types.ts` — `GhBacklogResponse.rankCustomFieldId: number`
- Codebase: `taskflow/src/stores/settings.store.ts` — `rankFieldKey: string | null`, persist version 25
- Codebase: `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` — full read; `cancelLabel` gap confirmed
- Codebase: `.planning/research/PITFALLS.md` — Pitfalls 1-5 cited
- Codebase: `.planning/research/STACK.md` — PUT rank API body shape
- npm registry: all four `@dnd-kit/*` packages verified via `npm view`

### Secondary (MEDIUM confidence)
- [dndkit.com/legacy/presets/sortable/overview](https://dndkit.com/legacy/presets/sortable/overview) — `useSortable` API, `CSS.Transform.toString()`, multiple `SortableContext` under one `DndContext`
- [dndkit.com PointerSensor docs](https://dndkit.com/legacy/api-documentation/sensors/pointer/) — `activationConstraint: { delay, tolerance }` semantics
- WebSearch results — `SortableContext` multiple-lists pattern, `containerId` detection via `active.data.current.sortable`

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- rank.ts fix (CR-01, CR-02): HIGH — bugs confirmed by code reading + `node -e` execution
- dnd-kit integration: HIGH — documented API verified against dndkit.com docs + WebSearch
- API endpoint shape: HIGH — verified in STACK.md (prior research) + REQUIREMENTS.md
- Optimistic update pattern: HIGH — existing `useFieldMutation.ts` and `confirmMoveToSprint` are the templates
- Test gaps: HIGH — confirmed by `find` + file inspection

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (dnd-kit releases infrequently; Jira rank API is stable)
