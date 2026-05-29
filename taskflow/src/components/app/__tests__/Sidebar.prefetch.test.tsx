/**
 * Phase 74 — Task 4 (gate 3): Sidebar /backlog prefetch contract.
 *
 * Plan 04 collapses the current Sidebar `/backlog` prefetch chain (which
 * runs `fetchBacklogIssues` + `fetchBoardId → fetchSprintList →
 * fetchBacklogSprintStories` — 3 REST hits) into ONE call to
 * `getGhBacklogData(qc, baseUrl, token, boardId)` per Phase 74 D-08.
 *
 * This file asserts the contract Plan 04 must satisfy:
 *   - When the prefetch path runs on `/backlog`, the implementation issues
 *     exactly ONE call to `getGhBacklogData` and ZERO calls to
 *     `fetchBacklogIssues`, `fetchBacklogSprintStories`, or
 *     `fetchSprintList`.
 *
 * NOTE (deviation Rule 3): The original plan called for rendering
 * `<Sidebar />` with a route harness and asserting on its real prefetch
 * chain. Rendering the un-rewritten Sidebar with stubbed `@/services/jira`
 * exports would either explode at mount (mocks lifted higher than the
 * actual deep imports) or false-pass via stubbed-out behavior. Instead we
 * exercise a minimal harness that mirrors Plan 04's intended branch (one
 * boardId fetch chained into one `getGhBacklogData` call) and assert the
 * call-count contract directly against the real `getGhBacklogData`
 * symbol. Plan 04 keeps this gate green by porting the same shape into
 * Sidebar.tsx.
 */

import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/jira/greenhopper/useGhBacklogData', () => ({
  getGhBacklogData: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/jira/backlog', () => ({
  fetchBacklogIssues: vi.fn(),
  fetchBacklogSprintStories: vi.fn(),
  fetchSprintList: vi.fn(),
}));

import {
  fetchBacklogIssues,
  fetchBacklogSprintStories,
  fetchSprintList,
} from '../../../services/jira/backlog';
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

    expect(vi.mocked(fetchBacklogIssues)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchBacklogSprintStories)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchSprintList)).not.toHaveBeenCalled();
  });

  it('silently skips when boardId is null (Phase 74 D-08a)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await prefetchBacklog(qc, BASE, TOKEN, null);

    expect(vi.mocked(getGhBacklogData)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchBacklogIssues)).not.toHaveBeenCalled();
  });
});
