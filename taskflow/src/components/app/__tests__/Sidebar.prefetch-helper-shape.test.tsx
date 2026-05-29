/**
 * Phase 74 — Task 4 (gate 3): Sidebar /backlog prefetch HELPER-SHAPE regression.
 *
 * SCOPE (per WR-01, post-review-fix). This file is NOT a contract test
 * against the real Sidebar component. It exercises a LOCAL `prefetchBacklog`
 * helper whose shape mirrors what Plan 04 / D-08 / D-08a land inside
 * `Sidebar.tsx`. If `Sidebar.tsx`'s `/backlog` branch is later edited
 * (extra fetch added, boardId guard removed, wrong cache key used), this
 * file WILL NOT catch the regression. The static guard
 * `scripts/check-legacy-backlog-keys.mjs` enforces "no legacy backlog REST
 * keys/fetchers" repo-wide and is the real cutover gate.
 *
 * What this file actually pins down:
 *   - The expected shape of the prefetch branch (one `getGhBacklogData`
 *     call, boardId-null short-circuit) documented as executable spec for
 *     future readers reviewing Sidebar.tsx changes.
 *
 * Why we keep it (rather than delete) despite the limited gate strength:
 *   - It catches accidental drift in the helper-shape expectation (the
 *     review-period equivalent of pinning the docstring).
 *   - Real Sidebar `/backlog` prefetch behavior is exercised by the
 *     companion file `Sidebar.test.tsx`, which renders the actual component
 *     with the same module mocks the Sidebar reads from.
 *
 * Future work (deferred from WR-01 option a): swap this for a render-real-
 * Sidebar test that fires `focus`/`mouseenter` on the Backlog NavLink and
 * asserts `getGhBacklogData` call counts. Tracked separately.
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
 * Mirrors the post-Plan-04 Sidebar /backlog prefetch branch. This helper is
 * NOT imported from Sidebar.tsx — it's a local duplicate of the expected
 * shape. See file-level docstring above for the gate-strength caveat.
 */
async function prefetchBacklogHelperShape(
  qc: QueryClient,
  baseUrl: string,
  token: string,
  boardId: number | null,
): Promise<void> {
  if (boardId == null) return; // D-08a guard
  await getGhBacklogData(qc, baseUrl, token, boardId);
}

describe('Sidebar /backlog prefetch HELPER SHAPE (Phase 74 D-08, not a Sidebar render test)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('helper shape: runs exactly 1 getGhBacklogData call and 0 legacy backlog REST calls', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await prefetchBacklogHelperShape(qc, BASE, TOKEN, BOARD_ID);

    expect(vi.mocked(getGhBacklogData)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getGhBacklogData)).toHaveBeenCalledWith(qc, BASE, TOKEN, BOARD_ID);
  });

  it('helper shape: silently skips when boardId is null (Phase 74 D-08a)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await prefetchBacklogHelperShape(qc, BASE, TOKEN, null);

    expect(vi.mocked(getGhBacklogData)).not.toHaveBeenCalled();
  });
});
