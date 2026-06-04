/**
 * Pure helpers for the Sprint Board drag-to-transition drop-model resolution.
 *
 * These are extracted from SprintBoardTab's drag handlers so the drop-model
 * build, transition filtering, and drop-id resolution logic can be unit-tested
 * without simulating a real dnd-kit pointer drag (which jsdom cannot do). The
 * board uses plain `useDroppable` columns/zones (not `SortableContext`) so the
 * model is a column-keyed Map rather than an ordered array.
 *
 * Droppable id scheme:
 *   - `zone:<transitionId>` — a split sub-zone inside a column with >=2 transitions
 *   - `col:<categoryKey>`   — the whole column when it has exactly 1 transition
 *
 * Phase 79 (D-01/D-02/D-06): split/single/invalid column model.
 * Phase 79 (D-05/D-07): filter reachable + exclude screen/validator transitions.
 * Phase 79 (TRAN-01): resolveDropTransitionId maps over.id → transitionId | null.
 */

import { filterTransitionsForStatus } from '../../services/jira/greenhopper/transitions';
import type { JiraTransition } from '../../services/jira/types';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** The three Jira status category keys used to bucket board columns. */
export type CategoryKey = 'new' | 'indeterminate' | 'done';

/** A single droppable sub-zone within a split column. */
export interface DropZone {
  transitionId: string;
  /** D-03: The transition NAME (not the destination status name). */
  transitionName: string;
}

/**
 * Per-column drop model discriminated union.
 *
 * - `split`   — >=2 reachable transitions (D-01): column renders sub-zones
 * - `single`  — ==1 reachable transition  (D-02): whole column is the target
 * - `invalid` — ==0 reachable transitions (D-06): column is not a valid target
 */
export type ColumnDropModel =
  | { kind: 'split'; zones: DropZone[] }
  | { kind: 'single'; zone: DropZone }
  | { kind: 'invalid' };

/** Map from category key to its per-column drop model. */
export type DropModel = Map<CategoryKey, ColumnDropModel>;

// ---------------------------------------------------------------------------
// filterDroppableTransitions
// ---------------------------------------------------------------------------

/**
 * Filter the full workflow transition list to only those reachable from
 * `currentStatusId` AND safe for drag-to-transition.
 *
 * Two-stage filter (D-05 + D-07):
 *   1. `filterTransitionsForStatus` narrows to reachable transitions (global +
 *      those whose `fromStatusId` matches the current status).
 *   2. Drop any transition with `hasScreen` or `hasValidators` — a drag cannot
 *      satisfy a workflow screen or post-function validator (D-07, TRAN-03).
 */
export function filterDroppableTransitions(
  all: JiraTransition[],
  currentStatusId: string | undefined,
): JiraTransition[] {
  return filterTransitionsForStatus(all, currentStatusId).filter(
    (t) => !t.hasScreen && !t.hasValidators,
  );
}

// ---------------------------------------------------------------------------
// buildDropModel
// ---------------------------------------------------------------------------

/**
 * Bucket an already-filtered transition list into a per-column `DropModel`.
 *
 * Transitions are bucketed by `to.statusCategory.key` into the three category
 * keys (`new`, `indeterminate`, `done`). For each category:
 *   - >=2 transitions → `{ kind: 'split', zones: [...] }` (D-01)
 *   - ==1 transition  → `{ kind: 'single', zone }` (D-02)
 *   - ==0 transitions → `{ kind: 'invalid' }` (D-06)
 *
 * Pass only droppable transitions (output of `filterDroppableTransitions`).
 */
export function buildDropModel(transitions: JiraTransition[]): DropModel {
  const CATEGORY_KEYS: CategoryKey[] = ['new', 'indeterminate', 'done'];

  // Bucket transitions by their destination status category
  const buckets = new Map<CategoryKey, JiraTransition[]>(CATEGORY_KEYS.map((k) => [k, []]));
  for (const t of transitions) {
    const key = t.to.statusCategory?.key as CategoryKey | undefined;
    if (key && buckets.has(key)) {
      buckets.get(key)?.push(t);
    }
  }

  const model: DropModel = new Map();
  for (const categoryKey of CATEGORY_KEYS) {
    const bucket = buckets.get(categoryKey) ?? [];
    if (bucket.length >= 2) {
      model.set(categoryKey, {
        kind: 'split',
        zones: bucket.map((t) => ({ transitionId: t.id, transitionName: t.name })),
      });
    } else if (bucket.length === 1) {
      model.set(categoryKey, {
        kind: 'single',
        zone: { transitionId: bucket[0].id, transitionName: bucket[0].name },
      });
    } else {
      model.set(categoryKey, { kind: 'invalid' });
    }
  }
  return model;
}

// ---------------------------------------------------------------------------
// resolveDropTransitionId
// ---------------------------------------------------------------------------

/**
 * Decode a dnd-kit `over.id` against the current `DropModel` and return the
 * `transitionId` to fire, or `null` for a silent snap-back.
 *
 * Decoding rules (TRAN-01):
 *   - `null`               → null (no over target)
 *   - `zone:<transitionId>`→ the embedded transitionId (split sub-zone hit)
 *   - `col:<categoryKey>`  → the single zone's transitionId when the column is
 *                            `kind:'single'`; null otherwise (invalid/split)
 *   - anything else        → null (unknown id — snap-back per D-06)
 */
export function resolveDropTransitionId(
  overId: string | null,
  dropModel: DropModel,
): string | null {
  if (overId === null) return null;

  if (overId.startsWith('zone:')) {
    const transitionId = overId.slice('zone:'.length);
    // Validate the transitionId exists in the model (prevents forged ids
    // from resolving to an arbitrary transition — T-79-03)
    for (const col of dropModel.values()) {
      if (col.kind === 'split') {
        if (col.zones.some((z) => z.transitionId === transitionId)) {
          return transitionId;
        }
      }
    }
    return null;
  }

  if (overId.startsWith('col:')) {
    const key = overId.slice('col:'.length) as CategoryKey;
    const col = dropModel.get(key);
    if (col?.kind === 'single') {
      return col.zone.transitionId;
    }
    return null;
  }

  return null;
}
