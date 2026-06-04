/**
 * Unit tests for the sprint-board drop-model helpers.
 *
 * These are extracted so the transition-filter / drop-model build /
 * drop-resolution logic can be asserted without simulating a real dnd-kit
 * pointer drag (which jsdom cannot do). Mirrors the backlogDragHelpers test
 * seam pattern established in Phase 78.
 *
 * Design decisions under test:
 *   D-01  >=2 reachable transitions in a column → split model
 *   D-02  ==1 reachable transition in a column  → single model
 *   D-03  Split zones labelled by transition NAME, not status name
 *   D-05  filterDroppableTransitions: only reachable-from-current-status transitions
 *   D-06  0 reachable transitions in a column   → invalid model (snap-back)
 *   D-07  Transitions with hasScreen/hasValidators excluded from drop targets
 *   TRAN-01 resolveDropTransitionId: zone:<id> / col:<key> → transitionId | null
 */

import { describe, expect, it } from 'vitest';
import type { JiraTransition } from '../../services/jira/types';
import {
  buildDropModel,
  filterDroppableTransitions,
  resolveDropTransitionId,
} from './sprintBoardDragHelpers';

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

const makeTransition = (
  id: string,
  name: string,
  toStatusCategoryKey: string,
  opts?: {
    hasScreen?: boolean;
    hasValidators?: boolean;
    fromStatusId?: string;
  },
): JiraTransition => ({
  id,
  name,
  to: {
    id: `s-${id}`,
    name: `Status ${name}`,
    statusCategory: { id: 0, key: toStatusCategoryKey, name: '' },
  },
  ...opts,
});

// ---------------------------------------------------------------------------
// describe: filterDroppableTransitions
// ---------------------------------------------------------------------------

describe('filterDroppableTransitions', () => {
  it('keeps transitions reachable from the given currentStatusId', () => {
    const all = [
      makeTransition('1', 'Start', 'indeterminate', { fromStatusId: 'status-10' }),
      makeTransition('2', 'Done', 'done', { fromStatusId: 'status-20' }),
    ];
    // Only transition 1 is reachable from status-10
    const result = filterDroppableTransitions(all, 'status-10');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('REGRESSION: drops a transition with hasScreen:true (D-07)', () => {
    const all = [
      makeTransition('1', 'Screened', 'indeterminate', {
        fromStatusId: 'status-10',
        hasScreen: true,
      }),
      makeTransition('2', 'Clean', 'done', { fromStatusId: 'status-10' }),
    ];
    const result = filterDroppableTransitions(all, 'status-10');
    expect(result.map((t) => t.id)).not.toContain('1');
    expect(result.map((t) => t.id)).toContain('2');
  });

  it('REGRESSION: drops a transition with hasValidators:true (D-07)', () => {
    const all = [
      makeTransition('1', 'Validated', 'indeterminate', {
        fromStatusId: 'status-10',
        hasValidators: true,
      }),
      makeTransition('2', 'Clean', 'done', { fromStatusId: 'status-10' }),
    ];
    const result = filterDroppableTransitions(all, 'status-10');
    expect(result.map((t) => t.id)).not.toContain('1');
    expect(result.map((t) => t.id)).toContain('2');
  });

  it('keeps a transition where both flags are false/undefined (D-07)', () => {
    const all = [
      makeTransition('1', 'Clean', 'indeterminate', {
        fromStatusId: 'status-10',
        hasScreen: false,
        hasValidators: false,
      }),
      makeTransition('2', 'Also Clean', 'done', { fromStatusId: 'status-10' }),
    ];
    const result = filterDroppableTransitions(all, 'status-10');
    expect(result).toHaveLength(2);
  });

  it('returns [] when input is empty', () => {
    expect(filterDroppableTransitions([], 'status-10')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// describe: buildDropModel
// ---------------------------------------------------------------------------

describe('buildDropModel', () => {
  it('a category with >=2 transitions yields kind:split with zones labelled by transition NAME (D-01, D-03)', () => {
    const transitions = [
      makeTransition('10', 'In Review', 'indeterminate'),
      makeTransition('11', 'In Dev', 'indeterminate'),
    ];
    const model = buildDropModel(transitions);
    const col = model.get('indeterminate');
    expect(col).toBeDefined();
    expect(col?.kind).toBe('split');
    if (col?.kind === 'split') {
      expect(col.zones).toHaveLength(2);
      // D-03: label is transition NAME, not the status name
      expect(col.zones.map((z) => z.transitionName)).toContain('In Review');
      expect(col.zones.map((z) => z.transitionName)).toContain('In Dev');
      expect(col.zones.map((z) => z.transitionId)).toContain('10');
      expect(col.zones.map((z) => z.transitionId)).toContain('11');
    }
  });

  it('a category with exactly 1 transition yields kind:single (D-02)', () => {
    const transitions = [makeTransition('20', 'Done', 'done')];
    const model = buildDropModel(transitions);
    const col = model.get('done');
    expect(col?.kind).toBe('single');
    if (col?.kind === 'single') {
      expect(col.zone.transitionId).toBe('20');
      expect(col.zone.transitionName).toBe('Done');
    }
  });

  it('a category with 0 transitions yields kind:invalid (D-06)', () => {
    // Only transitions for 'indeterminate' — 'done' gets nothing
    const transitions = [makeTransition('10', 'In Progress', 'indeterminate')];
    const model = buildDropModel(transitions);
    const doneCol = model.get('done');
    // Either absent or invalid
    if (doneCol !== undefined) {
      expect(doneCol.kind).toBe('invalid');
    }
  });

  it('buckets transitions by to.statusCategory.key into the three CATEGORY keys', () => {
    const transitions = [
      makeTransition('1', 'To Do', 'new'),
      makeTransition('2', 'In Progress', 'indeterminate'),
      makeTransition('3', 'Done', 'done'),
    ];
    const model = buildDropModel(transitions);
    expect(model.get('new')?.kind).toBe('single');
    expect(model.get('indeterminate')?.kind).toBe('single');
    expect(model.get('done')?.kind).toBe('single');
  });
});

// ---------------------------------------------------------------------------
// describe: resolveDropTransitionId
// ---------------------------------------------------------------------------

describe('resolveDropTransitionId', () => {
  // Build a model with a split column ('indeterminate'), a single column ('done'),
  // and an invalid column ('new' — no transitions).
  const transitions = [
    makeTransition('10', 'In Review', 'indeterminate'),
    makeTransition('11', 'In Dev', 'indeterminate'),
    makeTransition('20', 'Done', 'done'),
  ];
  const model = buildDropModel(transitions);

  it('a split-zone over.id zone:<transitionId> resolves to that transitionId (TRAN-01)', () => {
    expect(resolveDropTransitionId('zone:10', model)).toBe('10');
    expect(resolveDropTransitionId('zone:11', model)).toBe('11');
  });

  it("a single-column over.id col:<categoryKey> resolves to that column's single transitionId (TRAN-01)", () => {
    expect(resolveDropTransitionId('col:done', model)).toBe('20');
  });

  it('an over.id for an invalid/absent column resolves to null (snap-back, D-06)', () => {
    // 'new' has no transitions in our model
    expect(resolveDropTransitionId('col:new', model)).toBeNull();
  });

  it('a null over.id resolves to null (snap-back)', () => {
    expect(resolveDropTransitionId(null, model)).toBeNull();
  });

  it('an unknown over.id resolves to null (snap-back, D-06)', () => {
    expect(resolveDropTransitionId('garbage', model)).toBeNull();
    expect(resolveDropTransitionId('zone:9999', model)).toBeNull();
    expect(resolveDropTransitionId('col:unknown', model)).toBeNull();
  });
});
