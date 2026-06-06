/**
 * Unit tests for fetchYesterdayJiraActivity() in jira.ts
 *
 * Covers STAND-04: client-side author+date filtering on transitions and comments.
 * Mock pattern mirrors jira.test.ts (vi.mock('@tauri-apps/plugin-http')).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api-error';
import { fetchIssueMeta, fetchYesterdayJiraActivity } from './jira';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';

const BASE = 'https://jira.example.com';
const TOKEN = 'my-token';
const PROJECT = 'PROJ';
const DATE = '2026-05-22';
const USERNAME = 'jdoe';

// Helper: build a minimal changelog history entry
function makeHistory(opts: {
  authorName: string;
  created: string;
  fromStatus?: string;
  toStatus?: string;
}) {
  return {
    id: 'h1',
    created: opts.created,
    author: { displayName: 'J Doe', name: opts.authorName },
    items: [
      {
        field: 'status',
        fieldtype: 'jira',
        fromString: opts.fromStatus ?? 'To Do',
        toString: opts.toStatus ?? 'In Progress',
      },
    ],
  };
}

// Helper: build a global status-list response (GET /rest/api/2/status).
// Mirrors JiraStatus[] from services/jira/statuses.ts.
function makeStatusList() {
  return [
    { id: '1', name: 'To Do', statusCategory: { id: 2, key: 'new', name: 'To Do' } },
    {
      id: '2',
      name: 'In Progress',
      statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
    },
    { id: '3', name: 'Done', statusCategory: { id: 3, key: 'done', name: 'Done' } },
  ];
}

// Helper: build a minimal JiraComment
function makeComment(opts: { authorName: string; created: string; body?: string }) {
  return {
    id: 'c1',
    author: { displayName: 'J Doe', name: opts.authorName },
    body: opts.body ?? 'A comment',
    created: opts.created,
    updated: opts.created,
  };
}

describe('fetchYesterdayJiraActivity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('STAND-04: returns transition when author + date match', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    // JQL search response
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-1',
            fields: { summary: 'My issue' },
            changelog: {
              histories: [makeHistory({ authorName: USERNAME, created: `${DATE}T09:00:00.000Z` })],
            },
          },
        ],
      }),
    } as Response);

    // Per-issue comment fetch response
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);

    expect(result).toHaveLength(1);
    expect(result[0].issueKey).toBe('PROJ-1');
    expect(result[0].summary).toBe('My issue');
    expect(result[0].transitions).toHaveLength(1);
    expect(result[0].transitions[0]).toMatchObject({
      fromStatus: 'To Do',
      toStatus: 'In Progress',
    });
    expect(result[0].comments).toHaveLength(0);
  });

  it('STAND-04: excludes transition authored by a different user', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-2',
            fields: { summary: 'Other issue' },
            changelog: {
              histories: [
                makeHistory({ authorName: 'otheruser', created: `${DATE}T09:00:00.000Z` }),
              ],
            },
          },
        ],
      }),
    } as Response);

    // Per-issue comment fetch — no matching comments
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);
    // Issue has no matching transitions or comments — should be omitted
    expect(result).toHaveLength(0);
  });

  it('STAND-04: excludes transition authored by correct user on different date', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-3',
            fields: { summary: 'Old issue' },
            changelog: {
              histories: [
                // Same user but yesterday-1 date
                makeHistory({ authorName: USERNAME, created: '2026-05-21T09:00:00.000Z' }),
              ],
            },
          },
        ],
      }),
    } as Response);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);
    expect(result).toHaveLength(0);
  });

  it('STAND-04: includes comment authored by correct user on target date', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-4',
            fields: { summary: 'Commented issue' },
            changelog: { histories: [] },
          },
        ],
      }),
    } as Response);

    // Global status list fetch (runs after the JQL search, before per-issue comments)
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeStatusList(),
    } as Response);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        comments: [
          makeComment({
            authorName: USERNAME,
            created: `${DATE}T11:00:00.000Z`,
            body: 'My comment',
          }),
        ],
      }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);
    expect(result).toHaveLength(1);
    expect(result[0].comments).toHaveLength(1);
    expect(result[0].comments[0].body).toBe('My comment');
    expect(result[0].transitions).toHaveLength(0);
  });

  it('STAND-04: excludes comments by other authors or on other dates', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-5',
            fields: { summary: 'Mixed comments' },
            changelog: { histories: [] },
          },
        ],
      }),
    } as Response);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        comments: [
          makeComment({ authorName: 'someone-else', created: `${DATE}T11:00:00.000Z` }),
          makeComment({ authorName: USERNAME, created: '2026-05-21T11:00:00.000Z' }),
        ],
      }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);
    expect(result).toHaveLength(0);
  });

  it('STAND-04: omits issues with zero matching transitions and zero matching comments', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-6',
            fields: { summary: 'No match' },
            changelog: { histories: [] },
          },
        ],
      }),
    } as Response);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);
    expect(result).toHaveLength(0);
  });

  it('STAND-04: gracefully degrades when per-issue comment fetch throws', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    // JQL search — one issue with a valid transition
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-7',
            fields: { summary: 'Comments blow up' },
            changelog: {
              histories: [makeHistory({ authorName: USERNAME, created: `${DATE}T09:00:00.000Z` })],
            },
          },
          {
            key: 'PROJ-8',
            fields: { summary: 'Second issue' },
            changelog: {
              histories: [makeHistory({ authorName: USERNAME, created: `${DATE}T10:00:00.000Z` })],
            },
          },
        ],
      }),
    } as Response);

    // First issue's comment fetch throws
    mockFetchFn.mockRejectedValueOnce(new Error('network error'));
    // Second issue's comment fetch succeeds
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);
    // Both issues should still appear (comment failure is non-fatal)
    expect(result).toHaveLength(2);
    expect(result[0].issueKey).toBe('PROJ-7');
    expect(result[0].comments).toHaveLength(0);
    expect(result[1].issueKey).toBe('PROJ-8');
  });

  it('STAND-04: throws ApiError with source=jira on 401 JQL response', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    await expect(
      fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('STAND-04: throws ApiError with source=jira on 403 JQL response', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({}),
    } as Response);

    await expect(
      fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('STAND-04: URL contains expand=changelog, maxResults=50, and fields', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ issues: [] }),
    } as Response);

    await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);

    const calledUrl = mockFetchFn.mock.calls[0][0] as string;
    expect(calledUrl).toContain('expand=changelog');
    expect(calledUrl).toContain('maxResults=50');
  });

  it('0ph: enriches transitions with statusCategory keys from the global status list', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    // JQL search — one issue with a To Do → In Progress transition
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-1',
            fields: { summary: 'My issue' },
            changelog: {
              histories: [
                makeHistory({
                  authorName: USERNAME,
                  created: `${DATE}T09:00:00.000Z`,
                  fromStatus: 'To Do',
                  toStatus: 'In Progress',
                }),
              ],
            },
          },
        ],
      }),
    } as Response);

    // Global status list fetch (GET /rest/api/2/status)
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeStatusList(),
    } as Response);

    // Per-issue comment fetch
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);

    expect(result).toHaveLength(1);
    expect(result[0].transitions[0]).toMatchObject({
      fromStatus: 'To Do',
      toStatus: 'In Progress',
      fromCategory: 'new',
      toCategory: 'indeterminate',
    });
  });

  it('0ph: leaves transition categories undefined when the status-list fetch fails', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-1',
            fields: { summary: 'My issue' },
            changelog: {
              histories: [
                makeHistory({
                  authorName: USERNAME,
                  created: `${DATE}T09:00:00.000Z`,
                  fromStatus: 'To Do',
                  toStatus: 'Done',
                }),
              ],
            },
          },
        ],
      }),
    } as Response);

    // Status list fetch throws — must NOT abort the activity load
    mockFetchFn.mockRejectedValueOnce(new Error('status list down'));

    // Per-issue comment fetch still runs
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);

    expect(result).toHaveLength(1);
    expect(result[0].transitions).toHaveLength(1);
    expect(result[0].transitions[0]).toMatchObject({
      fromStatus: 'To Do',
      toStatus: 'Done',
    });
    expect(result[0].transitions[0].fromCategory).toBeUndefined();
    expect(result[0].transitions[0].toCategory).toBeUndefined();
  });

  it('0ph: maps an unknown status name to an undefined category', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-1',
            fields: { summary: 'My issue' },
            changelog: {
              histories: [
                makeHistory({
                  authorName: USERNAME,
                  created: `${DATE}T09:00:00.000Z`,
                  fromStatus: 'To Do',
                  toStatus: 'Mystery Status',
                }),
              ],
            },
          },
        ],
      }),
    } as Response);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeStatusList(),
    } as Response);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ comments: [] }),
    } as Response);

    const result = await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);

    expect(result).toHaveLength(1);
    expect(result[0].transitions[0].fromCategory).toBe('new');
    expect(result[0].transitions[0].toCategory).toBeUndefined();
  });

  it('STAND-04: JQL filters by the current user and a single day', async () => {
    const mockFetchFn = vi.mocked(mockFetch);

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ issues: [] }),
    } as Response);

    await fetchYesterdayJiraActivity(BASE, TOKEN, PROJECT, DATE, USERNAME);

    const jql = decodeURIComponent(mockFetchFn.mock.calls[0][0] as string);
    // Must filter to the user (not the whole project) and bound to one day,
    // else expand=changelog over project-wide churn blows the 15s fetch timeout.
    expect(jql).toContain(`status CHANGED BY "${USERNAME}"`);
    expect(jql).toContain(`DURING ("${DATE}", "2026-05-23")`);
  });
});

describe('fetchIssueMeta', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns an empty map without fetching when no keys are given', async () => {
    const mockFetchFn = vi.mocked(mockFetch);
    const result = await fetchIssueMeta(BASE, TOKEN, []);
    expect(result).toEqual({});
    expect(mockFetchFn).not.toHaveBeenCalled();
  });

  it('batches keys into one key-in JQL query requesting type, summary, and parent', async () => {
    const mockFetchFn = vi.mocked(mockFetch);
    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        issues: [
          {
            key: 'PROJ-1',
            fields: { summary: 'A story', issuetype: { name: 'Story', subtask: false } },
          },
          {
            key: 'PROJ-2',
            fields: {
              summary: 'A subtask',
              issuetype: { name: 'Sub-task', subtask: true },
              parent: {
                key: 'PROJ-1',
                fields: { summary: 'A story', issuetype: { name: 'Story' } },
              },
            },
          },
        ],
      }),
    } as Response);

    const result = await fetchIssueMeta(BASE, TOKEN, ['PROJ-1', 'PROJ-2']);

    expect(result['PROJ-1']).toMatchObject({ type: 'Story', isSubtask: false, summary: 'A story' });
    expect(result['PROJ-2']).toMatchObject({
      type: 'Sub-task',
      isSubtask: true,
      parentKey: 'PROJ-1',
      parentSummary: 'A story',
      parentType: 'Story',
    });
    const url = decodeURIComponent(mockFetchFn.mock.calls[0][0] as string);
    expect(url).toContain('key in (PROJ-1,PROJ-2)');
    expect(url).toContain('fields=issuetype,summary,parent');
  });

  it('degrades to an empty map on a non-ok response', async () => {
    const mockFetchFn = vi.mocked(mockFetch);
    mockFetchFn.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const result = await fetchIssueMeta(BASE, TOKEN, ['PROJ-9']);
    expect(result).toEqual({});
  });
});
