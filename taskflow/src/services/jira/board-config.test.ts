import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../lib/apiFetch';
import { fetchBoardQuickFilters } from './board-config';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

const mockApiFetch = vi.mocked(apiFetch);

const QUICK_FILTERS = [
  { id: 1, boardId: 6708, name: 'My Issues', jql: 'assignee = currentUser()', description: '', position: 0 },
  { id: 2, boardId: 6708, name: 'Bugs Only', jql: 'issuetype = Bug', description: '', position: 1 },
];

// GreenHopper editmodel quick filters use `query` (not `jql`) and omit `boardId`.
const EDIT_MODEL = {
  quickFilterConfig: {
    quickFilters: [
      { id: 1, name: 'My Issues', query: 'assignee = currentUser()', description: '', position: 0 },
      { id: 2, name: 'Bugs Only', query: 'issuetype = Bug', description: '', position: 1 },
    ],
  },
};

const EDIT_MODEL_URL =
  'https://jira.example.com/rest/greenhopper/1.0/rapidviewconfig/editmodel.json?rapidViewId=6708';

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

describe('board-config service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchBoardQuickFilters', () => {
    it('returns quick filters from the GreenHopper edit model, normalising query→jql and injecting boardId', async () => {
      mockApiFetch.mockResolvedValueOnce(makeOkResponse(EDIT_MODEL));
      const result = await fetchBoardQuickFilters('https://jira.example.com', 'tok', 6708);
      expect(result).toEqual(QUICK_FILTERS);
      expect(mockApiFetch).toHaveBeenCalledOnce();
      expect(mockApiFetch).toHaveBeenCalledWith(
        'jira',
        EDIT_MODEL_URL,
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
        'Load Board Quick Filters',
      );
    });

    it('does not call the non-existent /quickfilter endpoint', async () => {
      mockApiFetch.mockResolvedValueOnce(makeOkResponse(EDIT_MODEL));
      await fetchBoardQuickFilters('https://jira.example.com', 'tok', 6708);
      const calledUrls = mockApiFetch.mock.calls.map((c) => c[1]);
      expect(calledUrls.some((u) => String(u).includes('/agile/1.0/board/6708/quickfilter'))).toBe(
        false,
      );
    });

    it('returns empty array when the board has no quick filters configured', async () => {
      mockApiFetch.mockResolvedValueOnce(
        makeOkResponse({ quickFilterConfig: { quickFilters: [] } }),
      );
      const result = await fetchBoardQuickFilters('https://jira.example.com', 'tok', 6708);
      expect(result).toEqual([]);
    });

    it('returns empty array when the edit model omits quickFilterConfig', async () => {
      mockApiFetch.mockResolvedValueOnce(makeOkResponse({}));
      const result = await fetchBoardQuickFilters('https://jira.example.com', 'tok', 6708);
      expect(result).toEqual([]);
    });

    it('returns empty array when the edit model request fails (401/403/500)', async () => {
      mockApiFetch.mockResolvedValueOnce(makeErrorResponse(403));
      const result = await fetchBoardQuickFilters('https://jira.example.com', 'tok', 6708);
      expect(result).toEqual([]);
      expect(mockApiFetch).toHaveBeenCalledOnce();
    });

    it('defaults missing query to an empty jql', async () => {
      mockApiFetch.mockResolvedValueOnce(
        makeOkResponse({
          quickFilterConfig: { quickFilters: [{ id: 9, name: 'No JQL', position: 0 }] },
        }),
      );
      const result = await fetchBoardQuickFilters('https://jira.example.com', 'tok', 6708);
      expect(result).toEqual([
        { id: 9, boardId: 6708, name: 'No JQL', jql: '', description: undefined, position: 0 },
      ]);
    });

    it('strips trailing slash from baseUrl', async () => {
      mockApiFetch.mockResolvedValueOnce(makeOkResponse({ quickFilterConfig: { quickFilters: [] } }));
      await fetchBoardQuickFilters('https://jira.example.com/', 'tok', 6708);
      expect(mockApiFetch).toHaveBeenCalledWith(
        'jira',
        EDIT_MODEL_URL,
        expect.any(Object),
        expect.any(String),
      );
    });
  });
});
