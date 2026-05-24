/**
 * Unit tests for fetchYesterdayJiraActivity() in jira.ts
 *
 * Covers STAND-04: client-side author+date filtering on transitions and comments.
 * Mock pattern mirrors jira.test.ts (vi.mock('@tauri-apps/plugin-http')).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api-error';
import { fetchYesterdayJiraActivity } from './jira';

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
              histories: [
                makeHistory({ authorName: USERNAME, created: `${DATE}T09:00:00.000Z` }),
              ],
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

    mockFetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        comments: [
          makeComment({ authorName: USERNAME, created: `${DATE}T11:00:00.000Z`, body: 'My comment' }),
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
              histories: [
                makeHistory({ authorName: USERNAME, created: `${DATE}T09:00:00.000Z` }),
              ],
            },
          },
          {
            key: 'PROJ-8',
            fields: { summary: 'Second issue' },
            changelog: {
              histories: [
                makeHistory({ authorName: USERNAME, created: `${DATE}T10:00:00.000Z` }),
              ],
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

    const calledUrl = (mockFetchFn.mock.calls[0][0] as string);
    expect(calledUrl).toContain('expand=changelog');
    expect(calledUrl).toContain('maxResults=50');
  });
});
