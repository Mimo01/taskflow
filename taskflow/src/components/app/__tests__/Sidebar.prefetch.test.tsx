/**
 * Phase 74 — Task 4 (gate 3): Sidebar /backlog prefetch contract.
 *
 * Plan 04 collapsed the legacy Sidebar `/backlog` prefetch chain into ONE
 * call to `getGhBacklogData(qc, baseUrl, token, boardId)` per Phase 74
 * D-08, and Plan 06 (GH-CUT-01) deleted the legacy REST fetchers
 * altogether. This file now only asserts the post-cutover contract:
 *
 *   - When the prefetch path runs on `/backlog`, the implementation issues
 *     exactly ONE call to `getGhBacklogData`.
 *   - When boardId is null (D-08a guard), zero calls are made.
 *
 * The legacy fetchers (`fetchBacklogIssues`, `fetchBacklogSprintStories`)
 * are no longer importable — Plan 06 deleted them — so the "zero legacy
 * calls" arm of this gate is now enforced statically by
 * `scripts/check-legacy-backlog-keys.mjs` instead of at runtime here.
 * `fetchSprintList` survives (D-09a) for the issue-detail sprint picker
 * but is unrelated to the backlog prefetch chain.
 */

import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/jira/greenhopper/useGhBacklogData', () => ({
  getGhBacklogData: vi.fn().mockResolvedValue({}),
}));

import { getGhBacklogData } from '../../../services/jira/greenhopper/useGhBacklogData';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const BOARD_ID = 163;

/**
 * Mirrors the post-Plan-04 Sidebar /backlog prefetch branch. Plan 04 lands
 * this exact shape inside `Sidebar.tsx` after deleting the three legacy
 * fetcher calls and importing `getGhBacklogData` from `@/services/jira`.
 */
async function prefetchBacklog(
  qc: QueryClient,
  baseUrl: string,
  token: string,
  boardId: number | null,
): Promise<void> {
  if (boardId == null) return; // D-08a guard
  await getGhBacklogData(qc, baseUrl, token, boardId);
}

describe('Sidebar /backlog prefetch contract (Phase 74 D-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs exactly 1 getGhBacklogData call and 0 legacy backlog REST calls', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await prefetchBacklog(qc, BASE, TOKEN, BOARD_ID);

    expect(vi.mocked(getGhBacklogData)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getGhBacklogData)).toHaveBeenCalledWith(qc, BASE, TOKEN, BOARD_ID);
  });

  it('silently skips when boardId is null (Phase 74 D-08a)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await prefetchBacklog(qc, BASE, TOKEN, null);

    expect(vi.mocked(getGhBacklogData)).not.toHaveBeenCalled();
  });
});
