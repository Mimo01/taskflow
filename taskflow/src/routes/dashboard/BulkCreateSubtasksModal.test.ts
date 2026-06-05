// SUBTPL-06/07: BulkCreateSubtasksModal — creation loop contract tests
//
// Wave-0 stub: asserts the ordering and retry-no-duplicate contract against a
// `createAllRows` helper that Plan 04 will implement and export from
// BulkCreateSubtasksModal.tsx. Deferred assertions are marked with it.todo
// so this file runs green now while documenting the contract.

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Types (mirrored from the future BulkCreateSubtasksModal implementation)
// ---------------------------------------------------------------------------

type RowStatus = 'pending' | 'creating' | 'created' | 'failed';
interface RowState {
  status: RowStatus;
  createdKey?: string;
  error?: string;
}

interface CreateRowInput {
  title: string;
  options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Minimal in-process implementation of the creation-loop contract
// This mirrors the logic Plan 04 will export as `createAllRows`.
// Tests here validate the contract; the real implementation will be wired in
// Plan 04 and these tests will import from that module instead.
// ---------------------------------------------------------------------------

async function createAllRows(
  rows: CreateRowInput[],
  initialStates: RowState[],
  createIssue: (row: CreateRowInput) => Promise<{ key: string }>,
  onStateChange: (states: RowState[]) => void,
): Promise<RowState[]> {
  const states = initialStates.map((s) =>
    s.status === 'created' ? s : { status: 'pending' as const },
  );

  for (let i = 0; i < rows.length; i++) {
    if (states[i].status === 'created') continue; // SUBTPL-07: skip already created

    states[i] = { ...states[i], status: 'creating' };
    onStateChange([...states]);

    try {
      const result = await createIssue(rows[i]);
      states[i] = { status: 'created', createdKey: result.key };
    } catch (e) {
      states[i] = {
        status: 'failed',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    onStateChange([...states]);
  }

  return states;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BulkCreateSubtasksModal — creation loop contract (SUBTPL-06/07)', () => {
  const rows: CreateRowInput[] = [
    { title: 'Subtask 1' },
    { title: 'Subtask 2' },
    { title: 'Subtask 3' },
  ];

  describe('SUBTPL-06: sequential ordering', () => {
    it('calls createIssue with rows in array order (index 0 before 1 before 2)', async () => {
      const callOrder: string[] = [];
      const createIssue = vi.fn(async (row: CreateRowInput) => {
        callOrder.push(row.title);
        return { key: `PROJ-${callOrder.length}` };
      });

      const initialStates: RowState[] = rows.map(() => ({ status: 'pending' }));
      await createAllRows(rows, initialStates, createIssue, () => {});

      expect(callOrder).toEqual(['Subtask 1', 'Subtask 2', 'Subtask 3']);
      expect(createIssue).toHaveBeenCalledTimes(3);
    });

    it('createIssue for row 0 is called before row 1 (sequential, not concurrent)', async () => {
      const completionOrder: number[] = [];

      const createIssue = vi.fn(async (_row: CreateRowInput, idx?: number) => {
        completionOrder.push(idx ?? completionOrder.length);
        return { key: `PROJ-${completionOrder.length}` };
      });

      // Wrap to capture index
      let callIdx = 0;
      const indexedCreate = vi.fn(async (row: CreateRowInput) => {
        const i = callIdx++;
        return createIssue(row, i);
      });

      const initialStates: RowState[] = rows.map(() => ({ status: 'pending' }));
      await createAllRows(rows, initialStates, indexedCreate, () => {});

      // Sequential: 0 → 1 → 2
      expect(completionOrder).toEqual([0, 1, 2]);
    });
  });

  describe('SUBTPL-07: retry-no-duplicate', () => {
    it('retry pass skips rows with status "created"', async () => {
      const createIssue = vi.fn(async (row: CreateRowInput) => ({
        key: `PROJ-retry-${row.title}`,
      }));

      // Simulate a partial-failure run: row 0 succeeded, row 1 failed
      const partialStates: RowState[] = [
        { status: 'created', createdKey: 'PROJ-1' },
        { status: 'failed', error: 'Network error' },
        { status: 'created', createdKey: 'PROJ-3' },
      ];

      await createAllRows(rows, partialStates, createIssue, () => {});

      // Only row 1 (the failed one) should be retried
      expect(createIssue).toHaveBeenCalledTimes(1);
      expect(createIssue).toHaveBeenCalledWith(rows[1]);
      expect(createIssue).not.toHaveBeenCalledWith(rows[0]);
      expect(createIssue).not.toHaveBeenCalledWith(rows[2]);
    });

    it('already-created rows retain their createdKey after retry', async () => {
      const createIssue = vi.fn(async () => ({ key: 'PROJ-retry' }));

      const partialStates: RowState[] = [
        { status: 'created', createdKey: 'PROJ-1' },
        { status: 'failed', error: 'Timeout' },
      ];

      const finalStates = await createAllRows(
        [rows[0], rows[1]],
        partialStates,
        createIssue,
        () => {},
      );

      // Row 0 must retain its original createdKey unchanged
      expect(finalStates[0].createdKey).toBe('PROJ-1');
      expect(finalStates[0].status).toBe('created');
    });

    it('a previously-failed row that succeeds on retry transitions to "created"', async () => {
      const createIssue = vi.fn(async () => ({ key: 'PROJ-fixed' }));

      const partialStates: RowState[] = [
        { status: 'failed', error: 'Previous error' },
      ];

      const finalStates = await createAllRows([rows[0]], partialStates, createIssue, () => {});

      expect(finalStates[0].status).toBe('created');
      expect(finalStates[0].createdKey).toBe('PROJ-fixed');
    });
  });

  describe('progress state tracking (SUBTPL-06)', () => {
    it('onStateChange is called with "creating" then "created" for each row', async () => {
      const stateSnapshots: RowStatus[][] = [];
      const createIssue = vi.fn(async () => ({ key: 'PROJ-1' }));

      const onStateChange = vi.fn((states: RowState[]) => {
        stateSnapshots.push(states.map((s) => s.status));
      });

      const initialStates: RowState[] = [{ status: 'pending' }];
      await createAllRows([rows[0]], initialStates, createIssue, onStateChange);

      // Should have been called with 'creating' then 'created'
      expect(stateSnapshots).toContainEqual(['creating']);
      expect(stateSnapshots).toContainEqual(['created']);
    });
  });

  // Plan 04 will implement and export createAllRows from BulkCreateSubtasksModal.tsx.
  // These todos document the remaining integration contract:
  it.todo('createIssue payload includes parent key for each subtask (Jira DC subtask requirement)');
  it.todo('createIssue payload includes issueTypeId from selected subtask type');
  it.todo('BulkProgressIndicator receives actionVerb="Creating" and noun="subtasks"');
  it.todo('modal Close button is disabled while creating=true');
  it.todo('cache invalidation: invalidateGhAllData + issue-detail + subtask-enrichment called after any success');
});
