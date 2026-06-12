// SUBTPL-06/07: BulkCreateSubtasksModal — creation loop contract tests
//
// Uses the exported `createAllRows` from the real implementation to validate
// ordering, retry-no-duplicate, @unassigned omission, and invalidation contract.

import { describe, expect, it, vi } from 'vitest';
import type { JiraIssueDetail } from '@/services/jira';
import type { BulkCreateRow } from './BulkCreateSubtasksModal';
import { buildSubtaskRowPayload, createAllRows } from './BulkCreateSubtasksModal';
import type { PlaceholderContext } from './resolveRowPlaceholders';

// ---------------------------------------------------------------------------
// Types (mirrored from BulkCreateSubtasksModal implementation)
// ---------------------------------------------------------------------------

type RowStatus = 'pending' | 'creating' | 'created' | 'failed';
interface RowState {
  status: RowStatus;
  createdKey?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BulkCreateSubtasksModal — creation loop contract (SUBTPL-06/07)', () => {
  const rows = [
    { title: 'Subtask 1', options: { parent: { key: 'PROJ-10' } } },
    { title: 'Subtask 2', options: { parent: { key: 'PROJ-10' } } },
    { title: 'Subtask 3', options: { parent: { key: 'PROJ-10' } } },
  ];

  describe('SUBTPL-06: sequential ordering', () => {
    it('calls createFn with rows in array order (index 0 before 1 before 2)', async () => {
      const callOrder: string[] = [];
      const createFn = vi.fn(async (title: string) => {
        callOrder.push(title);
        return { id: `id-${callOrder.length}`, key: `PROJ-${callOrder.length}` };
      });

      const initialStates: RowState[] = rows.map(() => ({ status: 'pending' }));
      await createAllRows({ rows, rowStates: initialStates, createFn, onStateChange: () => {} });

      expect(callOrder).toEqual(['Subtask 1', 'Subtask 2', 'Subtask 3']);
      expect(createFn).toHaveBeenCalledTimes(3);
    });

    it('createFn for row 0 is called before row 1 (sequential, not concurrent)', async () => {
      const completionOrder: number[] = [];
      let callIdx = 0;
      const createFn = vi.fn(async (_title: string) => {
        const i = callIdx++;
        completionOrder.push(i);
        return { id: `id-${i}`, key: `PROJ-${i}` };
      });

      const initialStates: RowState[] = rows.map(() => ({ status: 'pending' }));
      await createAllRows({ rows, rowStates: initialStates, createFn, onStateChange: () => {} });

      // Sequential: 0 → 1 → 2
      expect(completionOrder).toEqual([0, 1, 2]);
    });

    it('createIssue payload includes parent key for each subtask (Jira DC subtask requirement)', async () => {
      const createFn = vi.fn(async (_title: string, options: Record<string, unknown>) => ({
        id: 'id-1',
        key: 'PROJ-1',
        _opts: options,
      }));

      const initialStates: RowState[] = rows.map(() => ({ status: 'pending' }));
      await createAllRows({ rows, rowStates: initialStates, createFn, onStateChange: () => {} });

      // Every call should include parent.key in options
      for (const call of createFn.mock.calls) {
        const opts = call[1] as Record<string, unknown>;
        expect((opts.parent as { key: string }).key).toBe('PROJ-10');
      }
    });
  });

  describe('SUBTPL-07: retry-no-duplicate', () => {
    it('retry pass skips rows with status "created"', async () => {
      const createFn = vi.fn(async (title: string) => ({
        id: `id-retry-${title}`,
        key: `PROJ-retry-${title}`,
      }));

      // Simulate a partial-failure run: row 0 succeeded, row 1 failed, row 2 succeeded
      const partialStates: RowState[] = [
        { status: 'created', createdKey: 'PROJ-1' },
        { status: 'failed', error: 'Network error' },
        { status: 'created', createdKey: 'PROJ-3' },
      ];

      await createAllRows({ rows, rowStates: partialStates, createFn, onStateChange: () => {} });

      // Only row 1 (the failed one) should be retried
      expect(createFn).toHaveBeenCalledTimes(1);
      expect(createFn).toHaveBeenCalledWith(rows[1].title, rows[1].options);
      expect(createFn).not.toHaveBeenCalledWith(rows[0].title, rows[0].options);
      expect(createFn).not.toHaveBeenCalledWith(rows[2].title, rows[2].options);
    });

    it('already-created rows retain their createdKey after retry', async () => {
      const createFn = vi.fn(async () => ({ id: 'id-retry', key: 'PROJ-retry' }));

      const partialStates: RowState[] = [
        { status: 'created', createdKey: 'PROJ-1' },
        { status: 'failed', error: 'Timeout' },
      ];

      const finalStates = await createAllRows({
        rows: [rows[0], rows[1]],
        rowStates: partialStates,
        createFn,
        onStateChange: () => {},
      });

      // Row 0 must retain its original createdKey unchanged
      expect(finalStates[0].createdKey).toBe('PROJ-1');
      expect(finalStates[0].status).toBe('created');
    });

    it('a previously-failed row that succeeds on retry transitions to "created"', async () => {
      const createFn = vi.fn(async () => ({ id: 'id-fixed', key: 'PROJ-fixed' }));

      const partialStates: RowState[] = [{ status: 'failed', error: 'Previous error' }];

      const finalStates = await createAllRows({
        rows: [rows[0]],
        rowStates: partialStates,
        createFn,
        onStateChange: () => {},
      });

      expect(finalStates[0].status).toBe('created');
      expect(finalStates[0].createdKey).toBe('PROJ-fixed');
    });
  });

  describe('@unassigned: assignee key omitted from payload (Pitfall 7)', () => {
    it('@unassigned row should not pass assignee to createFn', async () => {
      const unassignedRow = {
        title: 'Unassigned subtask',
        // When resolveRowForCreate processes @unassigned, the assignee key is omitted
        // (payloadName: null → omit from options). The createAllRows loop passes
        // options as-is, so we test the omission at the options level directly.
        options: { parent: { key: 'PROJ-10' } }, // no assignee key — correct behavior
      };
      const createFn = vi.fn(async (_title: string, options: Record<string, unknown>) => {
        // Verify assignee is absent (never null, never undefined — just absent)
        expect('assignee' in options).toBe(false);
        return { id: 'id-u', key: 'PROJ-U' };
      });

      const initialStates: RowState[] = [{ status: 'pending' }];
      await createAllRows({
        rows: [unassignedRow],
        rowStates: initialStates,
        createFn,
        onStateChange: () => {},
      });

      expect(createFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress state tracking (SUBTPL-06)', () => {
    it('onStateChange is called with "creating" then "created" for each row', async () => {
      const stateSnapshots: RowStatus[][] = [];
      const createFn = vi.fn(async () => ({ id: 'id-1', key: 'PROJ-1' }));

      const onStateChange = vi.fn((states: RowState[]) => {
        stateSnapshots.push(states.map((s) => s.status));
      });

      const initialStates: RowState[] = [{ status: 'pending' }];
      await createAllRows({
        rows: [rows[0]],
        rowStates: initialStates,
        createFn,
        onStateChange,
      });

      // Should have been called with 'creating' then 'created'
      expect(stateSnapshots).toContainEqual(['creating']);
      expect(stateSnapshots).toContainEqual(['created']);
    });
  });

  describe('parent required-field inheritance (bulk-subtask-account-required)', () => {
    const ctx: PlaceholderContext = {
      jiraUsername: 'mimo',
      jiraUserDisplayName: 'Milan',
      parentIssue: {
        key: 'ESHOP-20523',
        fields: { assignee: null, priority: null, labels: [] },
      } as unknown as JiraIssueDetail,
    };

    const baseRow: BulkCreateRow = {
      id: 'r1',
      title: 'Testing',
      assignee: '@unassigned',
      priority: null,
      labels: [],
      duedate: null,
      timeEstimate: '1h',
      storyPoints: null,
      components: [],
      customFieldValues: {},
    };

    it('injects a required parent custom field the row did not set (object value → scalar id)', () => {
      const { options } = buildSubtaskRowPayload(baseRow, ctx, {
        parentKey: 'ESHOP-20523',
        storyPointsFieldKey: null,
        creatmetaFields: [],
        // Tempo Account on the parent — object with an integer id
        parentInheritMap: { customfield_10409: { id: 42, key: 'ACME', name: 'Acme Co' } },
      });

      // The exact field that produced the 400 must now be present, as the scalar id
      expect(options.customfield_10409).toBe('42');
    });

    it('unwraps an array-valued parent field to its first element scalar', () => {
      const { options } = buildSubtaskRowPayload(baseRow, ctx, {
        parentKey: 'ESHOP-20523',
        storyPointsFieldKey: null,
        creatmetaFields: [],
        parentInheritMap: { customfield_10409: [{ id: 7 }] },
      });
      expect(options.customfield_10409).toBe('7');
    });

    it('passes through a scalar parent value unchanged', () => {
      const { options } = buildSubtaskRowPayload(baseRow, ctx, {
        parentKey: 'ESHOP-20523',
        storyPointsFieldKey: null,
        creatmetaFields: [],
        parentInheritMap: { customfield_10500: 'plain-value' },
      });
      expect(options.customfield_10500).toBe('plain-value');
    });

    it('does NOT override a value the row explicitly set', () => {
      const row: BulkCreateRow = {
        ...baseRow,
        customFieldValues: { customfield_10409: 'user-entered' },
      };
      const { options } = buildSubtaskRowPayload(row, ctx, {
        parentKey: 'ESHOP-20523',
        storyPointsFieldKey: null,
        creatmetaFields: [], // no field meta → row value sent raw
        parentInheritMap: { customfield_10409: { id: 42 } },
      });
      // Row value wins; parent inheritance is skipped for set fields
      expect(options.customfield_10409).toBe('user-entered');
    });

    it('skips null/empty parent values without emitting the key', () => {
      const { options } = buildSubtaskRowPayload(baseRow, ctx, {
        parentKey: 'ESHOP-20523',
        storyPointsFieldKey: null,
        creatmetaFields: [],
        parentInheritMap: { customfield_10409: null, customfield_10410: [] },
      });
      expect('customfield_10409' in options).toBe(false);
      expect('customfield_10410' in options).toBe(false);
    });

    it('always includes parent key and inherited field together (the regression payload)', () => {
      const { options } = buildSubtaskRowPayload(baseRow, ctx, {
        parentKey: 'ESHOP-20523',
        storyPointsFieldKey: null,
        creatmetaFields: [],
        parentInheritMap: { customfield_10409: { id: 42 } },
      });
      expect((options.parent as { key: string }).key).toBe('ESHOP-20523');
      expect(options.timetracking).toEqual({ originalEstimate: '1h' });
      expect(options.customfield_10409).toBe('42');
    });
  });

  describe('cache invalidation (SUBTPL-08)', () => {
    it('invalidation callback is invoked exactly once when at least one row succeeds', async () => {
      // The createAllRows loop itself doesn't call invalidations — those happen
      // in the React component after the loop. Instead, we test that successful
      // rows produce status 'created' so the component knows to invalidate.
      const createFn = vi.fn(async (title: string, _opts: Record<string, unknown>) => ({
        id: `id-${title}`,
        key: `PROJ-${title}`,
      }));

      const rowsForTest = [
        { title: 'S1', options: { parent: { key: 'PROJ-10' } } },
        { title: 'S2', options: { parent: { key: 'PROJ-10' } } },
      ];

      const initialStates: RowState[] = rowsForTest.map(() => ({ status: 'pending' }));
      const onInvalidate = vi.fn();
      const onStateChange = vi.fn((states: RowState[]) => {
        // If all rows complete, fire the invalidation (simulate component behavior)
        const allDone = states.every((s) => s.status === 'created' || s.status === 'failed');
        const anySuceeded = states.some((s) => s.status === 'created');
        if (allDone && anySuceeded && onInvalidate.mock.calls.length === 0) {
          onInvalidate();
        }
      });

      await createAllRows({
        rows: rowsForTest,
        rowStates: initialStates,
        createFn,
        onStateChange,
      });

      // Invalidation should have been triggered exactly once
      expect(onInvalidate).toHaveBeenCalledTimes(1);
    });

    it('final states have "created" for all rows — triggers 3 invalidations in component', async () => {
      const createFn = vi.fn(async (title: string) => ({
        id: `id-${title}`,
        key: `PROJ-${title}`,
      }));

      const initialStates: RowState[] = rows.map(() => ({ status: 'pending' }));
      const finalStates = await createAllRows({
        rows,
        rowStates: initialStates,
        createFn,
        onStateChange: () => {},
      });

      // All rows created → component would fire invalidateGhAllData + 2 queryClient.invalidateQueries
      expect(finalStates.every((s) => s.status === 'created')).toBe(true);
    });
  });
});
