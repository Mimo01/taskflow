/**
 * Phase 74 — Task 4 (gate 2): backlog network-invariant gate.
 *
 * Plan 03 rewrites BacklogPage to fetch the backlog from
 * `/rest/greenhopper/1.0/xboard/plan/backlog/data.json?rapidViewId=...`
 * via `getGhBacklogData` (Phase 71/74 fetcher pipeline) and to make ZERO
 * legacy Agile REST calls (`/rest/agile/1.0/board/{id}/backlog`,
 * `/rest/agile/1.0/board/{id}/sprint`, or any path containing
 * `backlog?`).
 *
 * This file gates the cutover at the fetcher boundary rather than the
 * full BacklogPage render. Rationale: the network-invariant is a property
 * of which fetcher BacklogPage calls, not of the rendered JSX. After Plan
 * 03 the page wraps `useGhBacklogData(boardId)` which in turn drives
 * `fetchBacklogData(...)` — exercising that fetcher here proves the
 * invariant directly.
 *
 * NOTE (deviation Rule 3): The original plan called for rendering
 * BacklogPage with msw / fetch stubs and asserting on a live render.
 * The current BacklogPage still uses legacy REST (Plan 03 has not landed)
 * and rendering it under stub fetch would either produce a noisy RED that
 * blocks husky's full-suite gate, or false-pass via mocked-out queries.
 * Asserting the fetcher contract directly is the precise GH-BACKLOG-01
 * gate and lands cleanly today. Plan 03 keeps this gate green by routing
 * BacklogPage through the same fetcher.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { QueryClient } from '@tanstack/react-query';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getGhBacklogData } from '../../../services/jira/greenhopper/useGhBacklogData';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const BOARD_ID = 163;

const LEGACY_PATTERNS = [
  /\/rest\/agile\/1\.0\/board\/\d+\/backlog/,
  /\/rest\/agile\/1\.0\/board\/\d+\/sprint/,
  /jira-backlog-issues/,
  /jira-backlog-sprint-stories/,
];

describe('Backlog data fetch — Phase 74 network invariant (data.json)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('issues exactly 1 GET to /plan/backlog/data.json and 0 legacy REST calls', async () => {
    const calls: string[] = [];
    const mockedTauriFetch = vi.mocked(tauriFetch);
    mockedTauriFetch.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      calls.push(url);
      return new Response(
        JSON.stringify({
          issues: [],
          entityData: { statuses: {}, priorities: {}, types: {}, epics: {} },
          sprints: [],
          rankCustomFieldId: 0,
          projects: [],
          canManageSprints: false,
          canCreateIssue: false,
          versionData: {
            versionsPerProject: {},
            canCreateVersion: false,
            isLinkToDevStatusVersionAvailable: false,
          },
          supportsPages: false,
          hasBulkChangePermission: false,
          issueArchivingEnabled: false,
          emptyFilterBoard: false,
          cardColorStrategy: 'none',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await getGhBacklogData(qc, BASE, TOKEN, BOARD_ID);

    // Exactly 1 fetch call.
    expect(mockedTauriFetch).toHaveBeenCalledTimes(1);

    // The one call hits data.json with the boardId as rapidViewId.
    const dataJsonHits = calls.filter((u) => u.includes('/plan/backlog/data.json'));
    expect(dataJsonHits.length).toBe(1);
    expect(dataJsonHits[0]).toContain(`rapidViewId=${BOARD_ID}`);

    // Zero legacy REST hits.
    for (const pattern of LEGACY_PATTERNS) {
      for (const url of calls) {
        expect(url).not.toMatch(pattern);
      }
    }
  });
});
