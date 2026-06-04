# Phase 79: Drag-to-Transition on Sprint Board - Pattern Map

**Mapped:** 2026-06-04
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/routes/dashboard/sprintBoardDragHelpers.ts` | utility | transform | `src/routes/dashboard/backlogDragHelpers.ts` | exact (same role, same test-seam purpose) |
| `src/routes/dashboard/sprintBoardDragHelpers.test.ts` | test | transform | `src/routes/dashboard/__tests__/backlogDragHelpers.test.ts` | exact |
| `src/services/jira/types.ts` (§ JiraTransition) | model | — | self (additive edit to existing interface) | self-extension |
| `src/services/jira.ts` (§ JiraTransition mirror) | model | — | self (mirror of types.ts) | self-extension |
| `src/services/jira/greenhopper/transitions.ts` (§ `__adaptToJiraTransition`) | service | request-response | self (additive propagation in existing function) | self-extension |
| `src/routes/dashboard/SprintBoardTab.tsx` (DndContext + drop mutation) | component | event-driven | `src/routes/dashboard/BacklogPage.tsx` (DndContext/sensor/overlay) | role-match (DndContext) + self-extension (handleTransition) |
| `src/routes/dashboard/TaskCard.tsx` (useDraggable) | component | event-driven | `src/routes/dashboard/BacklogRow.tsx` (useSortable → useDraggable analog) | role-match |
| `src/services/jira/greenhopper/transitions.test.ts` (extend) | test | — | self (extend existing describe block) | self-extension |

---

## Pattern Assignments

### `src/routes/dashboard/sprintBoardDragHelpers.ts` (utility, transform)

**Analog:** `src/routes/dashboard/backlogDragHelpers.ts`

**File header / module docblock pattern** (backlogDragHelpers.ts lines 1-13):
```typescript
/**
 * Pure helpers for the Backlog drag-to-rank multi-container resolution.
 *
 * These are extracted from BacklogPage's drag handlers so the cross-section
 * container resolution can be unit-tested without simulating a real dnd-kit
 * pointer drag (which jsdom cannot do). ...
 */
```
Mirror this docblock for `sprintBoardDragHelpers.ts`, replacing the description with the drop-model purpose.

**Export shape pattern** (backlogDragHelpers.ts — every export is a named pure function or interface; no default export):
```typescript
export interface SortableData { ... }
export type SectionIdSet = ReadonlySet<string>;
export function resolveSourceContainer(...): string | null { ... }
export function resolveTargetContainer(...): string | null { ... }
export function computeInsertIndex(...): number { ... }
export function buildTargetOrder(...): string[] { ... }
```
Apply same pattern for the three new pure functions:
```typescript
export type CategoryKey = 'new' | 'indeterminate' | 'done';

export interface DropZone {
  transitionId: string;
  transitionName: string;
}

export type ColumnDropModel =
  | { kind: 'split';   zones: DropZone[] }
  | { kind: 'single';  zone: DropZone }
  | { kind: 'invalid' };

export type DropModel = Map<CategoryKey, ColumnDropModel>;

/** Bucket reachable, droppable transitions into a per-column drop model. */
export function buildDropModel(transitions: JiraTransition[]): DropModel { ... }

/** Filter reachable transitions: filterTransitionsForStatus + D-07 screen/validator removal. */
export function filterDroppableTransitions(
  all: JiraTransition[],
  currentStatusId: string | undefined,
): JiraTransition[] { ... }

/** over.id → transitionId; returns null for invalid/own/no-zone (snap-back). */
export function resolveDropTransitionId(
  overId: string | null,
  dropModel: DropModel,
): string | null { ... }
```

**No-import constraint:** helpers must import only types, `filterTransitionsForStatus` from the GH transitions service, and `JiraTransition` — no React, no dnd-kit, no query client. Mirrors `backlogDragHelpers.ts` which imports nothing at all.

---

### `src/routes/dashboard/sprintBoardDragHelpers.test.ts` (test, transform)

**Analog:** `src/routes/dashboard/__tests__/backlogDragHelpers.test.ts`

**Imports block pattern** (backlogDragHelpers.test.ts lines 17-31):
```typescript
import { describe, expect, it } from 'vitest';
import {
  buildTargetOrder,
  computeInsertIndex,
  ...
} from '../backlogDragHelpers';
```
Mirror exactly, importing from `../sprintBoardDragHelpers`.

**Test describe/it naming pattern** (backlogDragHelpers.test.ts lines 37-163 — every describe names the function, every it names the scenario):
```typescript
describe('resolveSourceContainer', () => {
  it('returns the dragged row container id', () => { ... });
  it('returns null when no sortable data', () => { ... });
});
describe('resolveTargetContainer', () => {
  it('prefers the over-row sortable containerId', () => { ... });
  it('falls back to a section droppable id when over is NOT a row', () => { ... });
  it('returns null for an unknown over id', () => { ... });
});
```
Apply same one-describe-per-function, multiple-it-per-scenario structure for `buildDropModel`, `filterDroppableTransitions`, `resolveDropTransitionId`.

**Regression-guard comment pattern** (backlogDragHelpers.test.ts line 222):
```typescript
it('REGRESSION: a fresh drag (no pre-drag override) still persists — ...', () => { ... });
```
Use same prefixing for pitfall tests (e.g. `'REGRESSION: hasScreen:true transition not offered as drop target when D-08 omitted'`).

**Fixture / helper factory pattern** (backlogDragHelpers.test.ts lines 33-35):
```typescript
const SECTION_IDS = new Set(['sprint-1', 'sprint-2', 'backlog']);
const rowData = (containerId: string) => ({ sortable: { containerId } });
```
Mirror with:
```typescript
const makeTransition = (
  id: string, name: string, toStatusCategoryKey: string,
  opts?: { hasScreen?: boolean; hasValidators?: boolean; fromStatusId?: string }
): JiraTransition => ({ id, name, to: { id: `s-${id}`, name, statusCategory: { id: 0, key: toStatusCategoryKey, name: '' } }, ...opts });
```

---

### `src/services/jira/types.ts` § JiraTransition (model, additive edit)

**Analog:** self — current shape at lines 76-95:
```typescript
export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory?: { id: number; key: string; name: string };
  };
  /**
   * Source status id this transition applies from. Undefined means the
   * transition is global (applies from any status). Use
   * `filterTransitionsForStatus` to narrow ...
   *
   * Phase 72 (WR-02): keep this in sync with the re-export at
   * `services/jira.ts:193-208` ...
   */
  fromStatusId?: string;
}
```
**Add after `fromStatusId?`** (following the existing JSDoc pattern for optional fields):
```typescript
  /**
   * Phase 79 (D-08): propagated from GhTransition. When true, the transition
   * requires a screen (form) that drag-to-transition cannot satisfy — filter
   * out of drop targets (D-07). Keep in sync with the mirror at
   * `services/jira.ts:195-210`.
   */
  hasScreen?: boolean;
  /**
   * Phase 79 (D-08): propagated from GhTransition. When true, the transition
   * has post-function validators — also filtered from drop targets (D-07).
   */
  hasValidators?: boolean;
```

**Sync rule:** the comment at `types.ts:92-93` ("keep this in sync with the re-export at `services/jira.ts:193-208`") means BOTH files must be edited together. Same rule applies to the new fields.

---

### `src/services/jira.ts` § JiraTransition mirror (model, additive edit)

**Analog:** self — current shape at lines 195-210:
```typescript
export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory?: { id: number; key: string; name: string };
  };
  /**
   * Source status id this transition applies from. Undefined means the
   * transition is global (applies from any status). Use
   * `filterTransitionsForStatus` to narrow a workflow's full transition list
   * to those available from a specific issue's current status.
   */
  fromStatusId?: string;
}
```
Add `hasScreen?: boolean` and `hasValidators?: boolean` with the same JSDoc pattern. This is the legacy-import path used by all 60 existing imports (`import type { JiraTransition } from '@/services/jira'`).

---

### `src/services/jira/greenhopper/transitions.ts` § `__adaptToJiraTransition` (service, request-response)

**Analog:** self — current function at lines 125-160. Both return branches currently omit the two fields:

**Fallback branch** (lines 143-152 — status miss):
```typescript
return {
  id: String(gh.transitionId),
  name: gh.name,
  to: {
    id: toId,
    name: `Status ${toId}`,
    statusCategory: { id: 0, key: 'indeterminate', name: 'Unknown' },
  },
  fromStatusId,
  // ADD: hasScreen: gh.hasScreen, hasValidators: gh.hasValidators
};
```

**Success branch** (lines 154-159 — status hit):
```typescript
return {
  id: String(gh.transitionId),
  name: gh.name,
  to: { id: toId, name: status.name, statusCategory: status.statusCategory },
  fromStatusId,
  // ADD: hasScreen: gh.hasScreen, hasValidators: gh.hasValidators
};
```

**D-08 pattern:** Copy `gh.hasScreen` and `gh.hasValidators` into BOTH return branches. The raw `GhTransition` type already carries both fields as `boolean` (not optional), so no undefined-check is needed — just direct assignment.

---

### `src/routes/dashboard/SprintBoardTab.tsx` — DndContext wrapper (component, event-driven)

**Analog:** `src/routes/dashboard/BacklogPage.tsx`

**Sensor config pattern** (BacklogPage.tsx lines 329-333):
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { delay: 150, tolerance: 5 },
  }),
);
```
Copy verbatim. D-12 locks this config.

**Drag-guard refs pattern** (BacklogPage.tsx lines 336-337):
```typescript
const isDraggingRef = useRef(false);
const justDragged = useRef(false);
```
Copy verbatim. These gate click handler and suppress stray onClick after drop.

**Custom collision detection pattern** (BacklogPage.tsx lines 287-314):
```typescript
const backlogCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  const { pointerCoordinates, droppableRects, droppableContainers } = args;
  if (pointerCoordinates) {
    let closestId: string | number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const container of droppableContainers) {
      const rect = droppableRects.get(container.id);
      if (!rect) continue;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(centerX - pointerCoordinates.x, centerY - pointerCoordinates.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = container.id;
      }
    }
    if (closestId != null) return [{ id: closestId }];
  }

  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;
  return closestCenter(args);
};
```
Copy verbatim and rename `backlogCollisionDetection` → `boardCollisionDetection`. Needed for nested split-zone droppables.

**DndContext JSX pattern** (BacklogPage.tsx lines 1295-1374):
```tsx
<DndContext
  sensors={sensors}
  collisionDetection={boardCollisionDetection}
  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
  autoScroll={false}                        // D-12: dnd-kit#1108
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  {/* board content */}

  {createPortal(
    <DragOverlay dropAnimation={null}>
      {activeId ? <TaskCard issue={...} isOverlay /> : null}
    </DragOverlay>,
    document.body,   // or boardRef.current per D-13 — planner decides mount point
  )}
</DndContext>
```
Key differences from BacklogPage: no `modifiers={[restrictToVerticalAxis]}` (board drag is 2D), no `SortableContext` (board uses plain `useDroppable` columns/zones, not sortable items), `DragOverlay` renders a `TaskCard` not a `BacklogRow`.

**handleDragStart pattern** (BacklogPage.tsx lines 948-952):
```typescript
function handleDragStart({ active }: DragStartEvent) {
  setActiveId(active.id as string);
  isDraggingRef.current = true;
  setRankError(null);         // ← replace with: setActiveDragCard(issue); buildDropModel(...)
}
```
At drag start: record the active card key, call `filterDroppableTransitions` + `buildDropModel` to compute the `dropModel` for the dragged card, store in state.

**handleDragEnd pattern** (BacklogPage.tsx lines 964-979):
```typescript
function handleDragEnd({ active, over }: DragEndEvent) {
  isDraggingRef.current = false;
  setActiveId(null);
  setLocalOrder((prev) => new Map(prev));   // ← replace with: setDropModel(null); setActiveId(null)
  justDragged.current = true;
  setTimeout(() => { justDragged.current = false; }, 50);
  if (!over) return;
  // ...resolve and act
}
```
At drag end: clear dropModel state, set `justDragged`, then call `resolveDropTransitionId(over.id, dropModel)` — null → no-op; non-null → call existing `handleTransition(issueKey, transitionId, ...)`.

**Optimistic transition pattern — existing `handleTransition`** (SprintBoardTab.tsx lines 816-870):
```typescript
async function handleTransition(
  issueKey: string,
  transitionId: string,
  toStatusName: string,
  toStatusId: string,
  toStatusCategoryKey?: string,
) {
  const originalIssue = localIssues.find((i) => i.key === issueKey);
  if (!originalIssue) return;

  // Optimistic update
  setLocalIssues((prev) =>
    prev.map((i) =>
      i.key === issueKey
        ? { ...i, fields: { ...i.fields, status: {
              id: toStatusId,
              name: toStatusName,
              statusCategory: { key: toStatusCategoryKey ?? 'new' } as { key: 'new' | 'indeterminate' | 'done' },
            } } }
        : i,
    ),
  );
  setCardErrors((prev) => {
    const m = new Map(prev);
    m.delete(issueKey);
    return m;
  });

  try {
    await postTransition(jiraBaseUrl ?? '', jiraToken ?? '', issueKey, transitionId);
    invalidateGhAllData(queryClient, boardId ?? undefined);   // TRAN-05
  } catch {
    // Rollback
    setLocalIssues((prev) =>
      prev.map((i) =>
        i.key === issueKey
          ? { ...i, fields: { ...i.fields, status: originalIssue.fields.status } }
          : i,
      ),
    );
    setCardErrors((prev) => new Map(prev).set(issueKey, 'Transition failed'));  // TRAN-04
  }
}
```
The drag drop handler calls this exact function — D-09 says "mirror it", meaning call `handleTransition` directly rather than duplicating the pattern.

**getTransitions / filterDroppableTransitions integration** (SprintBoardTab.tsx lines 769-781):
```typescript
function getTransitions(issue: JiraIssue): JiraTransition[] | undefined {
  const projectId = Number(issue.fields.project?.id ?? 0) || sentinelProjectId;
  const all = peekGhTransitions(queryClient, projectId, issue.fields.issuetype?.id ?? '');
  if (!all) return undefined;
  return filterTransitionsForStatus(all, issue.fields.status?.id);
}
```
In `handleDragStart`, call `getTransitions(draggedCard)` then pass through `filterDroppableTransitions` (which adds the D-07 `!t.hasScreen && !t.hasValidators` filter) before `buildDropModel`.

**State declarations to add** (following SprintBoardTab.tsx line 568-569 pattern):
```typescript
const [localIssues, setLocalIssues] = useState<JiraIssue[]>([]);
const [cardErrors, setCardErrors] = useState<Map<string, string>>(new Map());
// ADD for drag:
const [activeId, setActiveId] = useState<string | null>(null);
const [dropModel, setDropModel] = useState<DropModel | null>(null);
const isDraggingRef = useRef(false);
const justDragged = useRef(false);
```

**CATEGORY_COLUMNS / categoryOf** (SprintBoardTab.tsx lines 57-67 — already present, reuse):
```typescript
const CATEGORY_COLUMNS = [
  { key: 'new', label: 'To Do' },
  { key: 'indeterminate', label: 'In Progress' },
  { key: 'done', label: 'Done' },
] as const;

function categoryOf(issue: JiraIssue): CategoryKey {
  return (issue.fields.status.statusCategory?.key as CategoryKey) ?? 'new';
}
```
`buildDropModel` buckets transitions using the same `statusCategory.key` values — use these constants.

---

### `src/routes/dashboard/TaskCard.tsx` — useDraggable (component, event-driven)

**Analog:** `src/routes/dashboard/BacklogRow.tsx` (useSortable — same dnd-kit draggable protocol)

**useSortable → useDraggable translation pattern** (BacklogRow.tsx lines 193-210):
```typescript
// BacklogRow uses useSortable (sortable list context)
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: issue.key,
  disabled: isOverlay,
});

const dragStyle: React.CSSProperties = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging && !isOverlay ? 0 : undefined,
  cursor: isDragging ? 'grabbing' : 'grab',
  position: 'relative',
};
```
For `TaskCard`, use `useDraggable` instead (no sortable context on the board):
```typescript
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Inside TaskCard, gated by isDraggable prop (D-04 — only non-story cards):
const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
  id: issue.key,
  disabled: !isDraggable || isOverlay,
});

const dragStyle: React.CSSProperties = isDraggable
  ? {
      transform: CSS.Transform.toString(transform),
      opacity: isDragging && !isOverlay ? 0 : undefined,
      cursor: isDragging ? 'grabbing' : 'grab',
      touchAction: 'none',   // D-13: required for PointerSensor on touch/Tauri
    }
  : {};
```

**Spreading attributes/listeners pattern** (BacklogRow.tsx lines 257-268):
```tsx
<tr
  ref={setNodeRef}
  style={dragStyle}
  data-dragging={isDragging ? 'true' : undefined}
  {...attributes}
  {...listeners}
>
```
Mirror on the TaskCard outer element (`div[role=button]` or `<button>`):
```tsx
<div
  role="button"
  ref={isDraggable ? setNodeRef : undefined}
  style={dragStyle}
  data-dragging={isDragging ? 'true' : undefined}
  {...(isDraggable ? attributes : {})}
  {...(isDraggable ? listeners : {})}
  onClick={() => {
    if (justDragged?.current) return;   // D-12: guard from BacklogRow.tsx:263
    onOpenIssue(issue.key);
  }}
>
```

**justDragged guard pattern** (BacklogRow.tsx lines 263-264):
```typescript
onClick={() => {
  if (justDragged?.current) return;
  (onOpenIssue ?? onIssueClick)(issue.key);
}}
```
Pass `justDragged: React.MutableRefObject<boolean>` as a prop to `TaskCard` (same as `BacklogRow.tsx:132` `justDragged?: React.MutableRefObject<boolean>`).

**New prop to add to `TaskCardProps`:**
```typescript
/** When true, the card is draggable (D-04: only non-story cards). */
isDraggable?: boolean;
/** Ref set for 50ms after a drag drop to suppress the onClick (D-12). */
justDragged?: React.MutableRefObject<boolean>;
/** When true, renders the card as the DragOverlay ghost (no drag handle). */
isOverlay?: boolean;
```

---

### `src/services/jira/greenhopper/transitions.test.ts` (test extend)

**Analog:** self — existing `describe('__adaptToJiraTransition', ...)` at lines 211-281.

**Test fixture pattern** (transitions.test.ts lines 236-257):
```typescript
it('status hit: populates to.name + to.statusCategory and stringifies ids', () => {
  const gh: GhTransition = {
    transitionId: 11,
    name: 'Start',
    toStatusId: 3,
    hasScreen: false,
    hasConditions: false,
    hasValidators: false,
    isInitial: false,
    isGlobal: false,
  };
  expect(__adaptToJiraTransition(gh, map())).toEqual({
    id: '11',
    name: 'Start',
    to: { id: '3', name: 'In Progress', statusCategory: { ... } },
    // NOTE: hasScreen / hasValidators currently NOT in the expected output
    // (they are dropped). D-08 adds them — extend these two tests to assert:
    // hasScreen: false, hasValidators: false
  });
});
```
**Add two new `it` cases** inside the existing `describe('__adaptToJiraTransition', ...)`:
```typescript
it('D-08: propagates hasScreen:true through the status-hit branch', () => {
  const gh: GhTransition = { transitionId: 31, name: 'Start Progress', toStatusId: 3,
    hasScreen: true, hasConditions: false, hasValidators: false,
    isInitial: false, isGlobal: false };
  const result = __adaptToJiraTransition(gh, map());
  expect(result.hasScreen).toBe(true);
  expect(result.hasValidators).toBe(false);
});

it('D-08: propagates hasValidators:true through the status-miss (fallback) branch', () => {
  const gh: GhTransition = { transitionId: 41, name: 'Approve', toStatusId: 999,
    hasScreen: false, hasConditions: false, hasValidators: true,
    isInitial: false, isGlobal: false };
  const result = __adaptToJiraTransition(gh, map());
  expect(result.hasScreen).toBe(false);
  expect(result.hasValidators).toBe(true);
});
```
Also update the two existing `it` tests (`status hit` and `status miss`) to include `hasScreen: false, hasValidators: false` in the `toEqual` expected object — they currently omit those fields (which will start failing once D-08 adds the fields and the adapter copies them through).

---

## Shared Patterns

### Collision detection (pointerWithin-first)
**Source:** `src/routes/dashboard/BacklogPage.tsx` lines 287-314
**Apply to:** `SprintBoardTab.tsx` DndContext
```typescript
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  // pointer-distance fallback → rectIntersection → closestCenter
  ...
};
```
Copy verbatim, rename only. Required for split-zone nested droppables where closestCenter biases wrong.

### autoScroll={false} guard
**Source:** `src/routes/dashboard/BacklogPage.tsx` line 1313 (with rationale comment lines 1302-1312)
**Apply to:** `SprintBoardTab.tsx` DndContext
Mandatory — dnd-kit#1108 desync. Copy the full JSDoc comment explaining the tradeoff.

### justDragged 50ms click guard
**Source:** `src/routes/dashboard/BacklogPage.tsx` lines 975-979 + `BacklogRow.tsx` line 263
**Apply to:** `TaskCard.tsx` onClick, `SprintBoardTab.tsx` handleDragEnd
```typescript
justDragged.current = true;
setTimeout(() => { justDragged.current = false; }, 50);
// ... in onClick:
if (justDragged?.current) return;
```

### Optimistic mutation + rollback + cardErrors
**Source:** `src/routes/dashboard/SprintBoardTab.tsx` lines 816-870 (`handleTransition`)
**Apply to:** drag drop handler in `SprintBoardTab.tsx` — call `handleTransition` directly
The drag path selects a `transitionId` from `resolveDropTransitionId` and passes it to the existing `handleTransition` function. No new mutation function needed — D-09 says "mirror it", which means reuse.

### MeasuringStrategy.Always
**Source:** `src/routes/dashboard/BacklogPage.tsx` line 1301
**Apply to:** `SprintBoardTab.tsx` DndContext
```typescript
measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
```
Robustness measure for virtualized layouts (cards near viewport edge).

### dropAnimation={null}
**Source:** `src/routes/dashboard/BacklogPage.tsx` line 1348
**Apply to:** `SprintBoardTab.tsx` DragOverlay
Disables float-back animation on release; the optimistic state update is already visible.

---

## No Analog Found

All files have analogs. No entries.

---

## Metadata

**Analog search scope:** `taskflow/src/routes/dashboard/`, `taskflow/src/services/jira/`, `taskflow/src/services/jira/greenhopper/`
**Files scanned:** 9 source files + 2 test files
**Pattern extraction date:** 2026-06-04
