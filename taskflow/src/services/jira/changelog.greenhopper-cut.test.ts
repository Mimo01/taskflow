/**
 * GH-CUT-01: changelog fetcher stays on Jira REST v2 — no GreenHopper endpoint.
 *
 * Asserts that fetchIssueChangelog:
 *   - targets /rest/api/2/issue/ in the constructed URL
 *   - does NOT reference 'greenhopper' or '/agile/' in the URL
 *
 * Scope: strictly the detail-panel changelog fetcher (src/services/jira/changelog.ts).
 * GreenHopper IS used elsewhere in the app — this test does not scan the whole repo.
 */

// --- Mocks (hoisted before imports) ---

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

// --- Imports ---

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFetch } from '../../lib/apiFetch';
import { fetchIssueChangelog } from './changelog';

// --- Helpers ---

const mockApiFetch = vi.mocked(apiFetch);

const BASE_URL = 'https://jira.example.com';
const TOKEN = 'mock-token';
const ISSUE_KEY = 'PROJ-99';

function makeOkResponse(histories: unknown[] = []): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ changelog: { histories } }),
  } as unknown as Response;
}

// --- Tests ---

describe('fetchIssueChangelog — GH-CUT-01: REST v2, no GreenHopper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockResolvedValue(makeOkResponse());
  });

  it('calls apiFetch with a URL containing /rest/api/2/issue/', async () => {
    await fetchIssueChangelog(BASE_URL, TOKEN, ISSUE_KEY);

    expect(mockApiFetch).toHaveBeenCalledOnce();
    const calledUrl = mockApiFetch.mock.calls[0][1] as string;
    expect(calledUrl).toContain('/rest/api/2/issue/');
  });

  it('URL does NOT contain "greenhopper"', async () => {
    await fetchIssueChangelog(BASE_URL, TOKEN, ISSUE_KEY);

    const calledUrl = mockApiFetch.mock.calls[0][1] as string;
    expect(calledUrl).not.toContain('greenhopper');
  });

  it('URL does NOT contain "/agile/"', async () => {
    await fetchIssueChangelog(BASE_URL, TOKEN, ISSUE_KEY);

    const calledUrl = mockApiFetch.mock.calls[0][1] as string;
    expect(calledUrl).not.toContain('/agile/');
  });

  it('URL includes the issueKey and expand=changelog parameter', async () => {
    await fetchIssueChangelog(BASE_URL, TOKEN, ISSUE_KEY);

    const calledUrl = mockApiFetch.mock.calls[0][1] as string;
    expect(calledUrl).toContain(ISSUE_KEY);
    expect(calledUrl).toContain('expand=changelog');
  });

  it('returns the changelog histories array from the response', async () => {
    const history = {
      id: 'h1',
      created: '2026-01-01T00:00:00.000Z',
      author: { displayName: 'Alice', name: 'alice' },
      items: [],
    };
    mockApiFetch.mockResolvedValue(makeOkResponse([history]));

    const result = await fetchIssueChangelog(BASE_URL, TOKEN, ISSUE_KEY);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'h1' });
  });
});
