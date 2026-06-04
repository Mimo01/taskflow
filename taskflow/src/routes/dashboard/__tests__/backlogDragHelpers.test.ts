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
  resolveIntraRankFromDrop,
  resolveIntraSectionRank,
  resolveSourceContainer,
  resolveTargetContainer,
  sortByKeyOrder,
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

describe('resolveIntraRankFromDrop — canonical dnd-kit "reorder only on drop" (Phase 78-04 jump fix)', () => {
  const KEYS = ['A', 'B', 'C', 'D'];

  it('moves DOWN and ranks after the new upstairs neighbour', () => {
    // Drag A onto C → arrayMove(A, idx0 → idx2) → [B, C, A, D]; A now sits after C.
    const rank = resolveIntraRankFromDrop(KEYS, 'A', 'C');
    expect(rank).not.toBeNull();
    expect(rank?.newOrder).toEqual(['B', 'C', 'A', 'D']);
    expect(rank?.previousOrder).toEqual(KEYS);
    expect(rank?.position).toEqual({ rankAfterIssue: 'C' });
  });

  it('moves UP to the TOP and ranks BEFORE the issue below (no upstairs neighbour)', () => {
    // Drag D onto A → [D, A, B, C]; D lands at the top → rankBeforeIssue A.
    const rank = resolveIntraRankFromDrop(KEYS, 'D', 'A');
    expect(rank?.newOrder).toEqual(['D', 'A', 'B', 'C']);
    expect(rank?.position).toEqual({ rankBeforeIssue: 'A' });
  });

  it('returns null when active and over are the same index (no movement → no PUT)', () => {
    expect(resolveIntraRankFromDrop(KEYS, 'B', 'B')).toBeNull();
  });

  it('returns null when a key is missing from the section (e.g. dropped on the section droppable, not a row)', () => {
    expect(resolveIntraRankFromDrop(KEYS, 'A', 'sprint-1')).toBeNull();
    expect(resolveIntraRankFromDrop(KEYS, 'X', 'B')).toBeNull();
  });
});

// WR-02: the localOrder-driven re-sort of displayIssues. The old inline
// comparator returned `Infinity - Infinity = NaN` when both keys were absent
// from the override (stale override + active filter), giving an unstable sort.
describe('sortByKeyOrder (WR-02 displayIssues comparator)', () => {
  const item = (key: string) => ({ key });

  it('orders items by their position in orderedKeys', () => {
    const out = sortByKeyOrder([item('A'), item('B'), item('C')], ['C', 'A', 'B']);
    expect(out.map((i) => i.key)).toEqual(['C', 'A', 'B']);
  });

  it('pushes keys absent from orderedKeys to the end, sorted by key (no NaN)', () => {
    // A and B are NOT in the override — the old comparator did Infinity-Infinity=NaN.
    const out = sortByKeyOrder([item('B'), item('A'), item('Z')], ['Z']);
    expect(out.map((i) => i.key)).toEqual(['Z', 'A', 'B']);
  });

  it('is a TOTAL order when orderedKeys contains NONE of the rendered keys', () => {
    // Pure NaN trigger: every key falls to the MAX_SAFE_INTEGER fallback.
    const out = sortByKeyOrder([item('C'), item('A'), item('B')], ['X', 'Y']);
    expect(out.map((i) => i.key)).toEqual(['A', 'B', 'C']); // deterministic key tie-break
  });

  it('does not mutate the input array', () => {
    const input = [item('B'), item('A')];
    sortByKeyOrder(input, ['A', 'B']);
    expect(input.map((i) => i.key)).toEqual(['B', 'A']);
  });

  it('keeps known keys ahead of unknown keys', () => {
    const out = sortByKeyOrder([item('new-1'), item('A'), item('new-2')], ['A']);
    expect(out[0].key).toBe('A');
    expect(out.slice(1).map((i) => i.key)).toEqual(['new-1', 'new-2']);
  });
});

// WR-03: SortableContext `items` must equal the rendered rows. The fix makes
// sortableItems = displayIssues.map(i => i.key). This asserts the seam that
// produces that list: under an active filter the sortable keys are exactly the
// filtered+ordered rendered keys, never the unfiltered section keys.
describe('sortableItems derivation (WR-03 filtered SortableContext)', () => {
  const item = (key: string) => ({ key });
  // Mirror BacklogPage: displayIssues = override ? sortByKeyOrder(filtered) : filtered
  const deriveSortableItems = (
    filtered: ReadonlyArray<{ key: string }>,
    orderedKeys: readonly string[] | undefined,
  ): string[] =>
    (orderedKeys ? sortByKeyOrder(filtered, orderedKeys) : [...filtered]).map((i) => i.key);

  it('matches the filtered rendered rows when no override is set (RANK-01)', () => {
    const all = [item('A'), item('B'), item('C')];
    const filtered = all.filter((i) => i.key !== 'B'); // a filter hid B
    expect(deriveSortableItems(filtered, undefined)).toEqual(['A', 'C']);
  });

  it('never references non-rendered (filtered-out) rows under an override', () => {
    const filtered = [item('A'), item('C')]; // B filtered out
    const override = ['C', 'B', 'A']; // override still mentions B
    const sortable = deriveSortableItems(filtered, override);
    expect(sortable).toEqual(['C', 'A']); // B not present — indices line up with DOM
    expect(sortable).not.toContain('B');
  });
});
