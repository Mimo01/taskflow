# Phase 78: Drag-to-Rank on Backlog — Pattern Map

**Mapped:** 2026-06-03
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `taskflow/src/services/jira/rank.ts` | utility (pure fn) | transform | self (fix in place) | self |
| `taskflow/src/services/jira/rank.test.ts` | test | transform | `src/services/jira/sprints.test.ts` | role-match |
| `taskflow/src/services/jira/rank-api.ts` | service | request-response | `src/services/jira/sprints.ts` (`addIssuesToSprint`, `moveIssuesToBacklog`) | exact |
| `taskflow/src/services/jira/rank-api.test.ts` | test | request-response | `src/services/jira/sprints.test.ts` | exact |
| `taskflow/src/routes/dashboard/BacklogPage.tsx` | component | CRUD + event-driven | self + `useFieldMutation.ts` (`onMutate`/`onError`/`onSettled` pattern) | self + role-match |
| `taskflow/src/routes/dashboard/BacklogRow.tsx` | component | event-driven | self (extend with useSortable) | self |
| `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` | component | request-response | self (add `cancelLabel` prop) | self |
| `taskflow/src/test/package-deps.guard.test.ts` | test | — | self (remove describe block) | self |

---

## Pattern Assignments

### `taskflow/src/services/jira/rank.ts` (utility, transform — FIX)

**Analog:** self — fix the two known bugs in place; remove the `⚠️ KNOWN-BROKEN` header comment once fixed.

**Current file state** (`/taskflow/src/services/jira/rank.ts` lines 1-79):
The file already has `extractValue`, `bucket`, `pad`, `midpoint`, and `rankIssue`. The bugs are:
- **CR-01** (line 36): `rankIssue` ignores cross-bucket: it always uses `bucket(before)` and averages value portions, producing a result that sorts *before* `before` when `before` is bucket 0 and `after` is bucket 1.
- **CR-02** (lines 64-65): `BigInt(parseInt(pa || '0', 36))` passes through float64 — precision loss for value strings > 11 chars.

**CR-01 fix — cross-bucket branch** (replace `rankIssue` function body):
```typescript
export function rankIssue(before: string | null, after: string | null): string {
  const beforeVal = extractValue(before);
  const afterVal = extractValue(after);
  const beforeBucket = bucket(before);
  const afterBucket = bucket(after);

  // CR-01: when neighbours are in different buckets, stay in the lower bucket
  // and extend before's value with the alphabet midpoint character ('i', index 18).
  // Result is strictly > before (same bucket, longer value) and < after (higher bucket).
  if (before !== null && after !== null && beforeBucket !== afterBucket) {
    const midChar = ALPHABET[Math.floor(ALPHABET.length / 2)]; // 'i'
    return `${beforeBucket}|${beforeVal}${midChar}:`;
  }

  const targetBucket = beforeBucket || afterBucket || '0';
  const effectiveAfterVal = afterVal || pad(beforeVal, beforeVal.length + 1);
  return `${targetBucket}|${midpoint(beforeVal, effectiveAfterVal)}:`;
}
```

**CR-02 fix — replace `midpoint` with BigInt digit-by-digit parse** (replace `midpoint` function and add helpers):
```typescript
function parseBase36(s: string): bigint {
  // Digit-by-digit to avoid float64 precision loss from parseInt
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

---

### `taskflow/src/services/jira/rank.test.ts` (test, transform — STRENGTHEN)

**Analog:** self — strengthen existing 9 cases + add 3 new ones.

**Current `rankLt` problem** (`rank.test.ts` lines 13-21): compares value portions only — wrong for cross-bucket assertions where `'zzzzzzg'` > `'000000'` by value but `0|zzzzzzg:` < `1|000000:` by full LexoRank order.

**Fixed `rankLt`** (replace lines 13-21):
```typescript
function rankLt(a: string, b: string): boolean {
  const parseRank = (r: string) => {
    const pipeIdx = r.indexOf('|');
    const colonIdx = r.indexOf(':');
    const bkt = pipeIdx === -1 ? '0' : r.slice(0, pipeIdx);
    const val = r.slice(pipeIdx + 1, colonIdx === -1 ? undefined : colonIdx);
    return { bucket: parseInt(bkt, 10), val };
  };
  const ra = parseRank(a);
  const rb = parseRank(b);
  if (ra.bucket !== rb.bucket) return ra.bucket < rb.bucket;
  return ra.val < rb.val;
}
```

**E7 replacement** (replace lines 66-71 — currently only asserts `startsWith('0|')`):
```typescript
it("E7: different buckets — result is strictly between before and after", () => {
  const before = '0|zzzzzz:';
  const after = '1|000000:';
  const result = rankIssue(before, after);
  expect(rankLt(before, result)).toBe(true);
  expect(rankLt(result, after)).toBe(true);
});
```

**New test cases to add** (after E9, lines 83-86):
```typescript
it('E10: CR-02 — 12-char rank string — no precision collapse', () => {
  const before = '0|aaaaaaaaaaaa:'; // 12 chars
  const after  = '0|zzzzzzzzzzzz:'; // 12 chars
  const result = rankIssue(before, after);
  expect(rankLt(before, result)).toBe(true);
  expect(rankLt(result, after)).toBe(true);
});

it('E11: CR-01 — 0|zzzzzz before 1|000000 — strict ordering', () => {
  const before = '0|zzzzzz:';
  const after  = '1|000000:';
  const result = rankIssue(before, after);
  expect(rankLt(before, result)).toBe(true);
  expect(rankLt(result, after)).toBe(true);
});

it('E12: repeated midpoint — insert 5 items between a and b — all strictly ordered', () => {
  let lo = '0|aaaaaa:';
  let hi = '0|bbbbbb:';
  const inserted: string[] = [];
  for (let i = 0; i < 5; i++) {
    const mid = rankIssue(lo, hi);
    inserted.push(mid);
    lo = mid;
  }
  for (let i = 0; i < inserted.length - 1; i++) {
    expect(rankLt(inserted[i], inserted[i + 1])).toBe(true);
  }
});
```

---

### `taskflow/src/services/jira/rank-api.ts` (service, request-response — NEW)

**Analog:** `taskflow/src/services/jira/sprints.ts` — `addIssuesToSprint` (lines 243-267) and `moveIssuesToBacklog` (lines 206-228).

**Imports pattern** (copy from `sprints.ts` lines 1-6):
```typescript
import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
```

**Core API call pattern** (mirror `addIssuesToSprint` exactly — same `apiFetch` + 204 handling + `ApiError` for 401/403):
```typescript
export async function rankIssueApi(
  baseUrl: string,
  token: string,
  issueKey: string,
  rankCustomFieldId: number,
  position: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never>,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/agile/1.0/issue/rank`;
  const body = { issues: [issueKey], rankCustomFieldId, ...position };
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

**Barrel export** — add to `taskflow/src/services/jira.ts` following the pattern at lines 26-28:
```typescript
export { rankIssueApi } from './jira/rank-api';
```

**Key notes:**
- `rankCustomFieldId` is the integer from `GhBacklogResponse.rankCustomFieldId` — NOT the string `'customfield_10105'` from `settings.store.rankFieldKey`. Pass the integer directly.
- `apiFetch` signature: `apiFetch(service, url, init, operationName)` — four arguments, as used in `sprints.ts` lines 250-258.

---

### `taskflow/src/services/jira/rank-api.test.ts` (test, request-response — NEW)

**Analog:** `taskflow/src/services/jira/sprints.test.ts` (lines 1-70) — same vitest + `vi.mock('../../lib/apiFetch')` pattern.

**Full test file structure** (copy from `sprints.test.ts`):
```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rankIssueApi } from './rank-api';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const RANK_FIELD_ID = 10105; // fixture value from GhBacklogResponse.rankCustomFieldId

describe('rankIssueApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls PUT /rest/agile/1.0/issue/rank with correct body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await rankIssueApi(BASE, TOKEN, 'PROJ-2', RANK_FIELD_ID, { rankAfterIssue: 'PROJ-1' });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      `${BASE}/rest/agile/1.0/issue/rank`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          issues: ['PROJ-2'],
          rankCustomFieldId: RANK_FIELD_ID,  // integer, not string
          rankAfterIssue: 'PROJ-1',
        }),
      }),
      'Rank Issue',
    );
  });

  it('passes rankBeforeIssue when dropping at top of list', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, { rankBeforeIssue: 'PROJ-2' });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          issues: ['PROJ-1'],
          rankCustomFieldId: RANK_FIELD_ID,
          rankBeforeIssue: 'PROJ-2',
        }),
      }),
      'Rank Issue',
    );
  });

  it('throws ApiError on 401', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    await expect(rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {})).rejects.toThrow();
  });

  it('throws generic Error on 500', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    await expect(rankIssueApi(BASE, TOKEN, 'PROJ-1', RANK_FIELD_ID, {})).rejects.toThrow('500');
  });

  it('rankCustomFieldId is passed as integer not string', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);
    await rankIssueApi(BASE, TOKEN, 'PROJ-2', RANK_FIELD_ID, {});
    const callArgs = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse((callArgs[2] as RequestInit).body as string);
    expect(typeof body.rankCustomFieldId).toBe('number');
    expect(body.rankCustomFieldId).toBe(10105);
  });
});
```

---

### `taskflow/src/routes/dashboard/BacklogPage.tsx` (component, CRUD + event-driven — MODIFY)

**Analogs:**
1. `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` — `onMutate`/`onError`/`onSettled` structure (lines 26-73)
2. `taskflow/src/routes/dashboard/BacklogPage.tsx` — `confirmMoveToSprint` (lines 660-703), `bannerDismissed` pattern (line 424, 929-931)

**Imports to add** (after line 33 `useCallback, useEffect, useMemo, useRef, useState`):
```typescript
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
// rankIssueApi — add to the existing jira service import
import { ..., rankIssueApi } from '@/services/jira';
```

**Sensor setup** (add near top of component body, before existing `useRef` calls):
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  }),
);
```

**State additions** (after existing `useState` declarations, following line ~424 `bannerDismissed`):
```typescript
const isDraggingRef = useRef(false);
const justDragged = useRef(false);
const [activeId, setActiveId] = useState<string | null>(null);
// Map<sectionId, string[]> — overrides server issue-key order during drag window
const [localOrder, setLocalOrder] = useState<Map<string, string[]>>(new Map());
const [rankError, setRankError] = useState<string | null>(null);
```

**Rank mutation** (add after `confirmMoveToBacklog`, following the `confirmMoveToSprint` pattern at line 670):
```typescript
const rankMutation = useMutation({
  mutationFn: async ({
    issueKey,
    rankCustomFieldId,
    position,
  }: {
    issueKey: string;
    sectionId: string;
    newOrder: string[];
    previousOrder: string[];
    rankCustomFieldId: number;
    position: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never>;
  }) => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) throw new Error('No token');
    return rankIssueApi(jiraBaseUrl ?? '', token, issueKey, rankCustomFieldId, position);
  },
  onMutate: async ({ sectionId, newOrder, previousOrder }) => {
    // Cancel any in-flight refetch — prevents server data overwriting optimistic order
    await queryClient.cancelQueries({ queryKey: ['gh-backlog', boardId] });
    const snapshot = queryClient.getQueryData<GhBacklogResponse>(['gh-backlog', boardId]);
    isDraggingRef.current = true;
    setLocalOrder((prev) => new Map(prev).set(sectionId, newOrder));
    return { snapshot, sectionId, previousOrder };
  },
  onError: (_err, _vars, context) => {
    if (context?.snapshot) {
      queryClient.setQueryData(['gh-backlog', boardId], context.snapshot);
    }
    if (context?.sectionId && context?.previousOrder) {
      setLocalOrder((prev) => new Map(prev).set(context.sectionId, context.previousOrder));
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

**Drag handlers** (add after rank mutation):
```typescript
function handleDragStart({ active }: { active: { id: string | number } }) {
  setActiveId(active.id as string);
  isDraggingRef.current = true;
  setRankError(null);
}

function handleDragEnd({
  active,
  over,
}: {
  active: { id: string | number; data: { current?: { sortable?: { containerId?: string } } } };
  over: { id: string | number; data: { current?: { sortable?: { containerId?: string } } } } | null;
}) {
  isDraggingRef.current = false;
  setActiveId(null);
  justDragged.current = true;
  setTimeout(() => { justDragged.current = false; }, 50);

  if (!over || active.id === over.id) return;

  const sourceContainer = active.data.current?.sortable?.containerId;
  const targetContainer = over.data.current?.sortable?.containerId ?? (over.id as string);

  if (sourceContainer === targetContainer) {
    // Intra-list reorder — fire rank mutation directly
    const sectionKeys = localOrder.get(sourceContainer) ?? /* current section keys */[];
    const oldIndex = sectionKeys.indexOf(active.id as string);
    const newIndex = sectionKeys.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const newOrder = arrayMove(sectionKeys, oldIndex, newIndex);
    const above = newOrder[newIndex - 1];
    const below = newOrder[newIndex + 1];
    const position =
      above !== undefined
        ? { rankAfterIssue: above }
        : below !== undefined
          ? { rankBeforeIssue: below }
          : {};
    rankMutation.mutate({
      issueKey: active.id as string,
      sectionId: sourceContainer,
      newOrder,
      previousOrder: sectionKeys,
      rankCustomFieldId: backlog?.rankCustomFieldId ?? 0,
      position,
    });
  } else {
    // Cross-section — open confirmation dialog (setPendingDragMove)
    // ...see ConfirmSprintMoveDialog pattern below
  }
}
```

**DndContext wrapper in render** (wrap the existing sprint + backlog section render):
```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  modifiers={[restrictToVerticalAxis]}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  {/* Per section — each gets its own SortableContext with explicit id */}
  <SortableContext
    id={`sprint-${sprint.id}`}        // stable string id — required for containerId detection
    items={sectionIssueKeys}          // string[] of issue keys in rank order
    strategy={verticalListSortingStrategy}
  >
    {/* BacklogRow components */}
  </SortableContext>

  {/* Backlog (unassigned) section */}
  <SortableContext
    id="backlog"
    items={backlogIssueKeys}
    strategy={verticalListSortingStrategy}
  >
    {/* BacklogRow components */}
  </SortableContext>

  <DragOverlay>
    {activeId ? (
      <table style={{ width: '100%' }}>
        <tbody>
          <BacklogRow
            issue={adaptedIssues.find((i) => i.key === activeId)!}
            onIssueClick={() => {}}
            storyPointsFieldKey={storyPointsFieldKey}
            epicLinkFieldKey={epicLinkFieldKey}
            epicNameFieldKey={epicNameFieldKey}
            style={{ opacity: 0.6 }}
          />
        </tbody>
      </table>
    ) : null}
  </DragOverlay>
</DndContext>
```

**Error banner** (inline, following `bannerDismissed` pattern at line 929):
```typescript
{rankError && (
  <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm mb-2">
    <span className="text-muted-foreground flex-1">{rankError}</span>
    <Button variant="ghost" size="sm" onClick={() => setRankError(null)}>
      <X className="size-4" />
    </Button>
  </div>
)}
```

**Section rendered order** — when `localOrder.get(sectionId)` is set, use it as the issue-key ordering instead of the server-derived order. This is the `isDraggingRef`-gated source of truth during the drag window.

---

### `taskflow/src/routes/dashboard/BacklogRow.tsx` (component, event-driven — MODIFY)

**Analog:** self — add `useSortable` to the existing `<tr>` in the `ContextMenuTrigger render` prop pattern (lines 233-247).

**Imports to add** (after existing imports):
```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

**Props to add** (in `BacklogRowProps` interface, after line 54):
```typescript
/** Set true while the row is in the DragOverlay ghost — suppresses sortable hook */
isOverlay?: boolean;
/** Passed from parent when justDragged guard is active */
justDragged?: React.MutableRefObject<boolean>;
```

**useSortable hook** (add at top of component body, before `cellsProps` composition):
```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: issue.key, disabled: isOverlay });

const dragStyle: React.CSSProperties = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0 : 1,  // hide original row while DragOverlay renders the ghost
  cursor: isDragging ? 'grabbing' : 'grab',
};
```

**Apply to `<tr>` in ContextMenuTrigger render prop** (modify existing lines 236-247):
```typescript
<ContextMenuTrigger
  render={
    <tr
      ref={setNodeRef}                          // was: ref={ref}
      data-testid={`backlog-row-${issue.key}`}
      className={rowClassName}
      style={dragStyle}
      data-dragging={isDragging ? 'true' : undefined}
      onClick={() => {
        if (justDragged?.current) return;       // guard drag-end click
        (onOpenIssue ?? onIssueClick)(issue.key);
      }}
      aria-current={isFocused ? 'true' : undefined}
      {...attributes}
      {...listeners}
    >
      <RowCells {...cellsProps} />
    </tr>
  }
/>
```

**No-context-menu path** (the `<tr>` at line 221-229 for rows without sprint-move): apply same `setNodeRef`, `dragStyle`, `{...attributes}`, `{...listeners}`, and `justDragged` guard.

**Key constraint (Pitfall 6):** `ContextMenuTrigger` uses the `render` prop pattern — the `<tr>` is the trigger element directly. The `useSortable` listeners go on the same `<tr>`, not a wrapper. The 150ms `PointerSensor` delay prevents most conflicts with `contextmenu` pointer events.

---

### `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` (component — MODIFY)

**Analog:** self — add `cancelLabel?: string` prop, default `"Cancel"`.

**Current interface** (lines 12-20): has `open`, `onOpenChange`, `issueKey`, `fromSprintName`, `toSprintName`, `onConfirm`, `isPending` — no `cancelLabel`.

**Change 1 — add prop to interface** (after `isPending?` on line 19):
```typescript
/** Override the cancel button label. Defaults to "Cancel". Use "Keep Position" for drag context. */
cancelLabel?: string;
```

**Change 2 — destructure prop** (in function signature after `isPending`):
```typescript
cancelLabel = 'Cancel',
```

**Change 3 — use prop in render** (line 44 currently reads `Cancel`):
```typescript
<DialogClose render={<Button variant="outline" />}>{cancelLabel}</DialogClose>
```

**Existing usages** in `BacklogPage.tsx` do not pass `cancelLabel`, so they continue to render "Cancel". The drag-triggered dialog passes `cancelLabel="Keep Position"`.

---

### `taskflow/src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` (test — NEW)

**Analog:** `taskflow/src/routes/dashboard/__tests__/BacklogPage.network.test.tsx` (lines 1-106) — same `vi.mock` + `QueryClient` setup.

**File structure pattern** (mirror `BacklogPage.network.test.tsx`):
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn() }));

import { QueryClient } from '@tanstack/react-query';
// Import rankIssueApi to spy on it
import { rankIssueApi } from '../../../services/jira/rank-api';

vi.mock('../../../services/jira/rank-api', () => ({
  rankIssueApi: vi.fn(),
}));

const BOARD_ID = 163;
const RANK_FIELD_ID = 10105;  // fixture value — MUST NOT be hardcoded to other values in impl

describe('BacklogPage rank mutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('RANK-03: mutation passes rankCustomFieldId from fixture (integer, not hardcoded)', async () => {
    vi.mocked(rankIssueApi).mockResolvedValueOnce(undefined);
    // ... set up queryClient cache with GhBacklogResponse fixture (rankCustomFieldId: RANK_FIELD_ID)
    // ... trigger the mutation
    expect(vi.mocked(rankIssueApi)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(String),
      RANK_FIELD_ID,          // integer from fixture — not hardcoded
      expect.any(Object),
    );
  });

  it('RANK-04: failed mutation rolls back local order and shows rankError', async () => {
    vi.mocked(rankIssueApi).mockRejectedValueOnce(new Error('Network error'));
    // ... trigger mutation, assert local order restored and rankError state set
  });

  it('RANK-05: cancelQueries called in onMutate', async () => {
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries');
    vi.mocked(rankIssueApi).mockResolvedValueOnce(undefined);
    // ... trigger mutation
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ['gh-backlog', BOARD_ID] });
  });
});
```

---

### `taskflow/src/test/package-deps.guard.test.ts` (test — MODIFY)

**Change:** Remove the entire `describe('package.json — @dnd-kit absence guard (Phase 67 / SETUI-02)', ...)` block (lines 52-82) before installing `@dnd-kit` packages. The `react-grid-layout` absence guard (lines 18-50) stays unchanged.

**After removal, the file ends at line 50** with the closing `});` of the react-grid-layout describe block.

---

## Shared Patterns

### Optimistic Mutation (onMutate / onError / onSettled)

**Source:** `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` lines 26-73
**Apply to:** `BacklogPage.tsx` rank mutation and cross-section move mutation

The canonical three-step structure is:
1. `onMutate`: `cancelQueries` → snapshot `getQueryData` → apply optimistic state → return `{ snapshot }`
2. `onError`: `setQueryData(snapshot)` to rollback → set error state
3. `onSettled`: clear in-flight flag → `invalidateGhBacklogData(queryClient, boardId)`

```typescript
// Source: useFieldMutation.ts lines 26-48
onMutate: async ({ fieldName, value }) => {
  await queryClient.cancelQueries({ queryKey: [...] });
  const previous = queryClient.getQueryData([...]);
  queryClient.setQueryData([...], (old) => ({ ...old, ... }));
  return { previous };
},
onError: (_err, _vars, context) => {
  if (context?.previous) {
    queryClient.setQueryData([...], context.previous);
  }
},
onSettled: () => {
  invalidateGhBacklogData(queryClient, boardId);
},
```

### apiFetch Service Call

**Source:** `taskflow/src/services/jira/sprints.ts` lines 243-267 (`addIssuesToSprint`)
**Apply to:** `rank-api.ts` (`rankIssueApi`)

```typescript
// Source: sprints.ts lines 249-266
const response = await apiFetch(
  'jira',
  url,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ issues: issueKeys }),
  },
  'Move to Sprint',
);
if (!response.ok && response.status !== 204) {
  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Failed to add issues to sprint', response.status, 'jira');
  }
  throw new Error(`Failed to add issues to sprint: ${response.status}`);
}
```

### Inline Error Banner

**Source:** `taskflow/src/components/ui/stale-data-banner.tsx` (full file) + `BacklogPage.tsx` lines 929-931
**Apply to:** `BacklogPage.tsx` rank-failure and cross-section-failure error surface

```typescript
// Source: stale-data-banner.tsx pattern — replicate inline for rank errors
<div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
  <span className="text-muted-foreground flex-1">{message}</span>
  <Button variant="ghost" size="sm" onClick={onDismiss}>
    <X className="size-4" />
  </Button>
</div>
```

Copy text values from UI-SPEC copywriting contract:
- Rank failure: `"Couldn't save new order — reverted"`
- Cross-section failure: `"Couldn't move issue — reverted"`

### Dialog cancelLabel Extension

**Source:** `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` lines 44 (`DialogClose` render)
**Apply to:** `confirm-sprint-move-dialog.tsx` — add `cancelLabel?: string` default `"Cancel"`

Existing callers omit the prop and continue rendering "Cancel". Drag context passes `cancelLabel="Keep Position"`.

### Vitest Service Test Setup

**Source:** `taskflow/src/services/jira/sprints.test.ts` lines 1-16
**Apply to:** `rank-api.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
import { apiFetch } from '../../lib/apiFetch';
// beforeEach: vi.clearAllMocks()
```

---

## No Analog Found

All 8 files have close analogs in the codebase. No files require fallback to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `taskflow/src/services/jira/`, `taskflow/src/routes/dashboard/`, `taskflow/src/routes/dashboard/__tests__/`, `taskflow/src/routes/dashboard/issue-detail/`, `taskflow/src/components/ui/`, `taskflow/src/test/`
**Files scanned:** 14 source files + test files read directly
**Pattern extraction date:** 2026-06-03
