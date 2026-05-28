import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  greenhopperFetch: vi.fn(),
  GREENHOPPER_API_PATH: '/rest/greenhopper/1.0/xboard',
}));

import { greenhopperFetch } from './client';
import { fetchIssueDetails } from './details';

const mockedGhFetch = vi.mocked(greenhopperFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const BOARD_ID = 42;
const ISSUE_KEY = 'PROJ-1';

const minimalDetailsPayload = {
  key: 'PROJ-1',
  id: 1,
  editable: true,
  canCreateComment: true,
  isSubtask: false,
  totalComments: 0,
  flagged: false,
  projectName: 'PROJ',
  projectAvatarUrl: '',
  isAssigned: false,
  primaryStatisticFieldId: '',
  trackingStatisticFieldId: '',
  sprint: {
    id: 0,
    sequence: 0,
    rapidViewId: 42,
    name: '',
    state: 'ACTIVE' as const,
    autoStartStop: false,
    synced: false,
  },
  operations: { issueKey: 'PROJ-1', sections: [] },
  tabs: { defaultTabs: [] },
};

describe('fetchIssueDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed response on 200', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalDetailsPayload,
    } as unknown as Response);

    const result = await fetchIssueDetails(BASE, TOKEN, BOARD_ID, ISSUE_KEY, true);
    expect(result.key).toBe('PROJ-1');
  });

  it('forwards issueKey and loadSubtasks into the URL', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalDetailsPayload,
    } as unknown as Response);

    await fetchIssueDetails(BASE, TOKEN, BOARD_ID, ISSUE_KEY, true);
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('issueIdOrKey=PROJ-1'),
      expect.any(String),
    );
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('loadSubtasks=true'),
      expect.any(String),
    );
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('rapidViewId=42'),
      expect.any(String),
    );
  });

  it('URL-encodes issueKey to prevent path injection (T-71-07)', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalDetailsPayload,
    } as unknown as Response);

    await fetchIssueDetails(BASE, TOKEN, BOARD_ID, 'PROJ-1/../evil', false);
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('issueIdOrKey=PROJ-1%2F..%2Fevil'),
      expect.any(String),
    );
  });

  it('throws ApiError with "Invalid token" on 401', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchIssueDetails(BASE, TOKEN, BOARD_ID, ISSUE_KEY, true)).rejects.toThrow(
      'Invalid token',
    );
  });

  it('throws ApiError with "Invalid token" on 403', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 403 } as unknown as Response);
    await expect(fetchIssueDetails(BASE, TOKEN, BOARD_ID, ISSUE_KEY, true)).rejects.toThrow(
      'Invalid token',
    );
  });

  it('throws "Cannot reach" on network error', async () => {
    mockedGhFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchIssueDetails(BASE, TOKEN, BOARD_ID, ISSUE_KEY, true)).rejects.toThrow(
      'Cannot reach',
    );
  });

  it('throws with status on other non-ok response', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
    await expect(fetchIssueDetails(BASE, TOKEN, BOARD_ID, ISSUE_KEY, true)).rejects.toThrow('500');
  });
});
