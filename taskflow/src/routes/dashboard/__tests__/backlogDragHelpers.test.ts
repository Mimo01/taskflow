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
  computeTargetGhostIndex,
  keyOrderEquals,
  type OverState,
  overStateEquals,
  resolveCrossSectionDrop,
  resolveIntraSectionRank,
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
  const make = (overSectionId: string | null, overRowKey: string | null = null): OverState => ({
    overSectionId,
    overRowKey,
  });

  it('is true for identical over-states (steady-state pointer movement → no re-render)', () => {
    expect(overStateEquals(make('sprint-1'), make('sprint-1'))).toBe(true);
    expect(overStateEquals(make(null), make(null))).toBe(true);
    expect(overStateEquals(make('sprint-1', 'B2'), make('sprint-1', 'B2'))).toBe(true);
  });

  it('is false when the section changes (cross-section hover)', () => {
    expect(overStateEquals(make('sprint-1'), make('sprint-2'))).toBe(false);
    expect(overStateEquals(make(null), make('sprint-1'))).toBe(false);
  });

  it('is false when only the over-row key changes (ghost slot moves within a section)', () => {
    // Same target section but the ghost should reposition → must re-render.
    expect(overStateEquals(make('sprint-2', 'B1'), make('sprint-2', 'B2'))).toBe(false);
    expect(overStateEquals(make('sprint-2', null), make('sprint-2', 'B1'))).toBe(false);
  });
});

describe('computeTargetGhostIndex — cross-section ghost placeholder slot (D-05/D-07)', () => {
  const TARGET = ['B1', 'B2', 'B3'];

  it('places the ghost AT the over-row index (pushing that row down)', () => {
    expect(computeTargetGhostIndex(TARGET, 'B1', 'A1')).toBe(0);
    expect(computeTargetGhostIndex(TARGET, 'B2', 'A1')).toBe(1);
    expect(computeTargetGhostIndex(TARGET, 'B3', 'A1')).toBe(2);
  });

  it('appends to the end when over the section header/gap (overRowKey null)', () => {
    expect(computeTargetGhostIndex(TARGET, null, 'A1')).toBe(3);
  });

  it('appends to the end for an empty target section', () => {
    expect(computeTargetGhostIndex([], null, 'A1')).toBe(0);
    expect(computeTargetGhostIndex([], 'whatever', 'A1')).toBe(0);
  });

  it('appends when the over-row key is not found in the target keys', () => {
    expect(computeTargetGhostIndex(TARGET, 'ZZZ', 'A1')).toBe(3);
  });

  it('appends defensively when the over row is the dragged key itself', () => {
    // Cross-section the active key should never be in the target, but if the
    // pointer somehow resolves to it, fall back to the end rather than index it.
    expect(computeTargetGhostIndex(['A1', 'B1'], 'A1', 'A1')).toBe(2);
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

describe('resolveIntraSectionRank — persist decision after a ghost-placeholder drop', () => {
  const SERVER = ['A', 'B', 'C', 'D'];

  it('REGRESSION: a fresh drag (no pre-drag override) still persists — previousOrder falls back to SERVER, not newOrder', () => {
    // Live-reorder moved A to slot index 2. preDragOrder is undefined because
    // this section had no localOrder entry until the drag started. The buggy
    // `?? newOrder` fallback made previousOrder === newOrder → no-movement guard
    // tripped → no PUT → snap-back. With the server-order fallback it persists.
    const rank = resolveIntraSectionRank({
      activeKey: 'A',
      liveOrder: ['B', 'C', 'A', 'D'],
      preDragOrder: undefined,
      serverKeys: SERVER,
    });
    expect(rank).not.toBeNull();
    expect(rank?.newOrder).toEqual(['B', 'C', 'A', 'D']);
    expect(rank?.previousOrder).toEqual(SERVER);
    // A now sits after C → rank it after its upstairs neighbour.
    expect(rank?.position).toEqual({ rankAfterIssue: 'C' });
  });

  it('returns null (no PUT) when the drop produced no net movement', () => {
    expect(
      resolveIntraSectionRank({
        activeKey: 'A',
        liveOrder: SERVER,
        preDragOrder: undefined,
        serverKeys: SERVER,
      }),
    ).toBeNull();
  });

  it('uses rankBeforeIssue when the item lands at the top of the section', () => {
    const rank = resolveIntraSectionRank({
      activeKey: 'C',
      liveOrder: ['C', 'A', 'B', 'D'],
      preDragOrder: undefined,
      serverKeys: SERVER,
    });
    expect(rank?.position).toEqual({ rankBeforeIssue: 'A' });
  });

  it('honours an existing pre-drag override (second drag in the same section)', () => {
    const rank = resolveIntraSectionRank({
      activeKey: 'A',
      liveOrder: ['B', 'A', 'C', 'D'],
      preDragOrder: ['A', 'B', 'C', 'D'],
      serverKeys: ['D', 'C', 'B', 'A'], // server stale; override is the truth
    });
    expect(rank?.previousOrder).toEqual(['A', 'B', 'C', 'D']);
    expect(rank?.position).toEqual({ rankAfterIssue: 'B' });
  });
});
