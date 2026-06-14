import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllSearchPages,
  fetchAllWorklogPages,
  isResponseLikeError,
  PAGE_SIZE,
} from './client';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';

const HEADERS = { Authorization: 'Bearer test-token' };
const SEARCH_URL = 'https://jira.example.com/rest/api/2/search?jql=project=PROJ';
const WORKLOG_URL = 'https://jira.example.com/rest/api/2/issue/PROJ-1/worklog';

describe('client service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- isResponseLikeError ---
  describe('isResponseLikeError', () => {
    it('returns true for object with numeric status', () => {
      expect(isResponseLikeError({ status: 401 })).toBe(true);
    });

    it('returns true for object with status and text method', () => {
      expect(isResponseLikeError({ status: 400, text: async () => 'error body' })).toBe(true);
    });

    it('returns false for plain Error', () => {
      expect(isResponseLikeError(new Error('nope'))).toBe(false);
    });

    it('returns false for null', () => {
      expect(isResponseLikeError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isResponseLikeError(undefined)).toBe(false);
    });

    it('returns false for object with non-numeric status', () => {
      expect(isResponseLikeError({ status: 'bad' })).toBe(false);
    });
  });

  // --- fetchAllSearchPages ---
  describe('fetchAllSearchPages', () => {
    it('fetches multiple pages when total exceeds PAGE_SIZE', async () => {
      const page1Issues = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        key: `PROJ-${i + 1}`,
        fields: { summary: `Issue ${i + 1}` },
      }));
      const page2Issues = Array.from({ length: 50 }, (_, i) => ({
        key: `PROJ-${PAGE_SIZE + i + 1}`,
        fields: { summary: `Issue ${PAGE_SIZE + i + 1}` },
      }));

      vi.mocked(apiFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            issues: page1Issues,
            total: 250,
            startAt: 0,
            maxResults: PAGE_SIZE,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            issues: page2Issues,
            total: 250,
            startAt: PAGE_SIZE,
            maxResults: PAGE_SIZE,
          }),
        } as Response);

      const result = await fetchAllSearchPages(SEARCH_URL, HEADERS);
      expect(result).toHaveLength(250);
      expect(result[0].key).toBe('PROJ-1');
      expect(result[249].key).toBe('PROJ-250');
    });

    it('returns single page when total fits in one request', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          issues: [{ key: 'PROJ-1', fields: { summary: 'Only' } }],
          total: 1,
          startAt: 0,
          maxResults: PAGE_SIZE,
        }),
      } as Response);

      const result = await fetchAllSearchPages(SEARCH_URL, HEADERS);
      expect(result).toHaveLength(1);
    });

    it('throws raw response on first-page non-ok non-auth status', async () => {
      const mockResponse = { ok: false, status: 400 };
      vi.mocked(apiFetch).mockResolvedValueOnce(mockResponse as Response);

      await expect(fetchAllSearchPages(SEARCH_URL, HEADERS)).rejects.toBe(mockResponse);
    });

    it('throws ApiError on first-page 401', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(fetchAllSearchPages(SEARCH_URL, HEADERS)).rejects.toThrow('Token expired');
    });

    it('throws ApiError on first-page 403', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      await expect(fetchAllSearchPages(SEARCH_URL, HEADERS)).rejects.toThrow(
        'Insufficient permissions',
      );
    });

    it('returns all 250 results when total=250 and first page returns 50', async () => {
      // Criterion 6: proves pagination continues past an under-full first page.
      // Page 1 (startAt=0): server returns only 50 issues (< PAGE_SIZE=200) but total=250.
      // Page 2 (startAt=200): server returns the remaining 50 issues (250-200=50 window).
      // The loop must fetch page 2 because startAt(200) < total(250).
      const page1Issues = Array.from({ length: 50 }, (_, i) => ({
        key: `PROJ-${i + 1}`,
        fields: { summary: `Issue ${i + 1}` },
      }));
      const page2Issues = Array.from({ length: 200 }, (_, i) => ({
        key: `PROJ-${50 + i + 1}`,
        fields: { summary: `Issue ${50 + i + 1}` },
      }));

      vi.mocked(apiFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            issues: page1Issues,
            total: 250,
            startAt: 0,
            maxResults: PAGE_SIZE,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            issues: page2Issues,
            total: 250,
            startAt: PAGE_SIZE,
            maxResults: PAGE_SIZE,
          }),
        } as Response);

      const result = await fetchAllSearchPages(SEARCH_URL, HEADERS);
      expect(result).toHaveLength(250);
      expect(result[0].key).toBe('PROJ-1');
      expect(result[249].key).toBe('PROJ-250');
    });

    it('returns partial results when subsequent page fails', async () => {
      vi.mocked(apiFetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            issues: [{ key: 'PROJ-1', fields: { summary: 'First' } }],
            total: 500,
            startAt: 0,
            maxResults: PAGE_SIZE,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response);

      const result = await fetchAllSearchPages(SEARCH_URL, HEADERS);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('PROJ-1');
    });
  });

  // --- fetchAllWorklogPages ---
  describe('fetchAllWorklogPages', () => {
    it('fetches all worklog pages', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          worklogs: [{ author: { displayName: 'Alice' } }, { author: { displayName: 'Bob' } }],
          total: 2,
          startAt: 0,
          maxResults: PAGE_SIZE,
        }),
      } as Response);

      const result = await fetchAllWorklogPages(WORKLOG_URL, HEADERS);
      expect(result).toHaveLength(2);
      expect(result[0].author?.displayName).toBe('Alice');
    });

    it('returns empty array on first-page non-ok response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await fetchAllWorklogPages(WORKLOG_URL, HEADERS);
      expect(result).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new Error('timeout'));

      const result = await fetchAllWorklogPages(WORKLOG_URL, HEADERS);
      expect(result).toEqual([]);
    });
  });
});
