/**
 * Unit tests for the Backlog cross-section drag container resolution.
 *
 * Gap-closure for Phase 78-04 Defect 2 (D-03/D-04/D-05): cross-section drag
 * previously never resolved a target because `handleDragEnd` only read
 * `over.data.current.sortable.containerId`, which is undefined when the drop
 * lands on a section header, a gap, or an empty section. The resolution logic
 * is now extracted into pure helpers so the cross-section path can be asserted
 * without a real dnd-kit pointer drag (jsdom cannot simulate one).
 *
 * These tests assert the seam that ultimately decides whether
 * ConfirmSprintMoveDialog opens: a non-null `resolveCrossSectionDrop` result
 * with a `targetContainer` in a DIFFERENT section is exactly what makes
 * BacklogPage set `pendingDragMove` (→ dialog open).
 */

import { describe, expect, it } from 'vitest';
import {
  buildTargetOrder,
  computeInsertIndex,
  computeLiveReorder,
  keyOrderEquals,
  type OverState,
  overStateEquals,
  resolveCrossSectionDrop,
  resolveSourceContainer,
  resolveTargetContainer,
} from '../backlogDragHelpers';

const SECTION_IDS = new Set(['sprint-1', 'sprint-2', 'backlog']);

const rowData = (containerId: string) => ({ sortable: { containerId } });

describe('resolveSourceContainer', () => {
  it('returns the dragged row container id', () => {
    expect(resolveSourceContainer(rowData('sprint-1'))).toBe('sprint-1');
  });
  it('returns null when no sortable data', () => {
    expect(resolveSourceContainer(undefined)).toBeNull();
    expect(resolveSourceContainer({})).toBeNull();
  });
});

describe('resolveTargetContainer', () => {
  it('prefers the over-row sortable containerId', () => {
    expect(resolveTargetContainer('PROJ-9', rowData('sprint-2'), SECTION_IDS)).toBe('sprint-2');
  });

  it('falls back to a section droppable id when over is NOT a row (header/gap/empty)', () => {
    // over.id is the section id itself, no sortable data — the previously-broken case.
    expect(resolveTargetContainer('sprint-2', undefined, SECTION_IDS)).toBe('sprint-2');
    expect(resolveTargetContainer('backlog', undefined, SECTION_IDS)).toBe('backlog');
  });

  it('returns null for an unknown over id with no row container', () => {
    expect(resolveTargetContainer('not-a-section', undefined, SECTION_IDS)).toBeNull();
    expect(resolveTargetContainer(null, undefined, SECTION_IDS)).toBeNull();
  });
});

describe('computeInsertIndex / buildTargetOrder', () => {
  it('inserts at the over-row index', () => {
    const keys = ['A', 'B', 'C'];
    expect(computeInsertIndex('B', keys)).toBe(1);
    expect(buildTargetOrder(keys, 'X', 1)).toEqual(['A', 'X', 'B', 'C']);
  });

  it('appends when over id is not a row in the section', () => {
    const keys = ['A', 'B'];
    expect(computeInsertIndex('sprint-2', keys)).toBe(2);
    expect(buildTargetOrder(keys, 'X', 2)).toEqual(['A', 'B', 'X']);
  });

  it('inserts at index 0 for an empty section', () => {
    expect(computeInsertIndex('sprint-2', [])).toBe(0);
    expect(buildTargetOrder([], 'X', 0)).toEqual(['X']);
  });

  it('removes the active key if it somehow already exists before re-inserting', () => {
    expect(buildTargetOrder(['A', 'X', 'B'], 'X', 0)).toEqual(['X', 'A', 'B']);
  });
});

describe('resolveCrossSectionDrop — the dialog-opening seam', () => {
  const keysBySection: Record<string, string[]> = {
    'sprint-1': ['A1', 'A2', 'A3'],
    'sprint-2': ['B1', 'B2'],
    backlog: [],
  };
  const getTargetKeys = (id: string) => keysBySection[id] ?? [];

  it('resolves a cross-section drop when dropping directly ON a row in another section', () => {
    const res = resolveCrossSectionDrop({
      activeKey: 'A2',
      activeData: rowData('sprint-1'),
      overId: 'B1',
      overData: rowData('sprint-2'),
      sectionIds: SECTION_IDS,
      getTargetKeys,
    });
    expect(res).not.toBeNull();
    expect(res?.sourceContainer).toBe('sprint-1');
    expect(res?.targetContainer).toBe('sprint-2');
    // inserted at B1's index (0)
    expect(res?.newTargetOrder).toEqual(['A2', 'B1', 'B2']);
  });

  it('resolves a cross-section drop when dropping on a section HEADER/GAP (no row under pointer)', () => {
    const res = resolveCrossSectionDrop({
      activeKey: 'A1',
      activeData: rowData('sprint-1'),
      overId: 'sprint-2',
      overData: undefined, // section droppable, not a row
      sectionIds: SECTION_IDS,
      getTargetKeys,
    });
    expect(res).not.toBeNull();
    expect(res?.targetContainer).toBe('sprint-2');
    // appended to end of section-2
    expect(res?.newTargetOrder).toEqual(['B1', 'B2', 'A1']);
  });

  it('resolves a drop into an EMPTY section at index 0', () => {
    const res = resolveCrossSectionDrop({
      activeKey: 'A1',
      activeData: rowData('sprint-1'),
      overId: 'backlog',
      overData: undefined,
      sectionIds: SECTION_IDS,
      getTargetKeys,
    });
    expect(res).not.toBeNull();
    expect(res?.targetContainer).toBe('backlog');
    expect(res?.newTargetOrder).toEqual(['A1']);
  });

  it('returns null for an intra-section drop (same container) — handled by the rank path, not the dialog', () => {
    const res = resolveCrossSectionDrop({
      activeKey: 'A1',
      activeData: rowData('sprint-1'),
      overId: 'A3',
      overData: rowData('sprint-1'),
      sectionIds: SECTION_IDS,
      getTargetKeys,
    });
    expect(res).toBeNull();
  });

  it('returns null when nothing resolvable is under the pointer', () => {
    const res = resolveCrossSectionDrop({
      activeKey: 'A1',
      activeData: rowData('sprint-1'),
      overId: 'garbage',
      overData: undefined,
      sectionIds: SECTION_IDS,
      getTargetKeys,
    });
    expect(res).toBeNull();
  });
});

describe('overStateEquals — the per-frame re-render gate (Defect-A smoothness)', () => {
  const make = (overSectionId: string | null): OverState => ({ overSectionId });

  it('is true for identical over-states (steady-state pointer movement → no re-render)', () => {
    expect(overStateEquals(make('sprint-1'), make('sprint-1'))).toBe(true);
    expect(overStateEquals(make(null), make(null))).toBe(true);
  });

  it('is false when the section changes (cross-section hover)', () => {
    expect(overStateEquals(make('sprint-1'), make('sprint-2'))).toBe(false);
    expect(overStateEquals(make(null), make('sprint-1'))).toBe(false);
  });
});

describe('computeLiveReorder — intra-section ghost placeholder live reorder (D-07)', () => {
  it('moves the active key down to the over-row index', () => {
    expect(computeLiveReorder(['A', 'B', 'C', 'D'], 'A', 'C')).toEqual(['B', 'C', 'A', 'D']);
  });

  it('moves the active key up to the over-row index', () => {
    expect(computeLiveReorder(['A', 'B', 'C', 'D'], 'D', 'B')).toEqual(['A', 'D', 'B', 'C']);
  });

  it('returns the SAME array reference when active === over (gate → no re-render)', () => {
    const keys = ['A', 'B', 'C'];
    expect(computeLiveReorder(keys, 'B', 'B')).toBe(keys);
  });

  it('returns the SAME array reference when a key is missing (gate)', () => {
    const keys = ['A', 'B', 'C'];
    expect(computeLiveReorder(keys, 'X', 'B')).toBe(keys);
    expect(computeLiveReorder(keys, 'A', 'X')).toBe(keys);
  });
});

describe('keyOrderEquals — the live-reorder setState gate', () => {
  it('is true for the same reference', () => {
    const a = ['A', 'B'];
    expect(keyOrderEquals(a, a)).toBe(true);
  });

  it('is true for element-wise identical arrays', () => {
    expect(keyOrderEquals(['A', 'B', 'C'], ['A', 'B', 'C'])).toBe(true);
  });

  it('is false when an element differs', () => {
    expect(keyOrderEquals(['A', 'B', 'C'], ['A', 'C', 'B'])).toBe(false);
  });

  it('is false when lengths differ', () => {
    expect(keyOrderEquals(['A', 'B'], ['A', 'B', 'C'])).toBe(false);
  });
});
