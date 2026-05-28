import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  greenhopperFetch: vi.fn(),
  GREENHOPPER_API_PATH: '/rest/greenhopper/1.0/xboard',
}));

import { greenhopperFetch } from './client';
import { fetchGhTransitions } from './transitions';

const mockedGhFetch = vi.mocked(greenhopperFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_ID = 10001;

const minimalTransitionsPayload = {
  projectAndIssueTypeToWorkflow: {},
  workflowToTransitions: {},
};

describe('fetchGhTransitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the whole envelope on 200 (no .transitions unwrap)', async () => {
    const payload = {
      projectAndIssueTypeToWorkflow: { '10001': { '10000': 'Default WF' } },
      workflowToTransitions: {
        'Default WF': [
          {
            transitionId: 11,
            name: 'Start',
            toStatusId: 3,
            hasScreen: false,
            hasConditions: false,
            hasValidators: false,
            isInitial: false,
            isGlobal: false,
          },
        ],
      },
    };
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response);

    const result = await fetchGhTransitions(BASE, TOKEN, PROJECT_ID);
    expect(result).toEqual(payload);
    expect(result.workflowToTransitions['Default WF']).toHaveLength(1);
  });

  it('calls greenhopperFetch with projectId in URL', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => minimalTransitionsPayload,
    } as unknown as Response);

    await fetchGhTransitions(BASE, TOKEN, PROJECT_ID);
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining(`projectId=${PROJECT_ID}`),
      expect.any(String),
    );
    expect(mockedGhFetch).toHaveBeenCalledWith(
      BASE,
      TOKEN,
      expect.stringContaining('/work/transitions.json'),
      expect.any(String),
    );
  });

  it('throws ApiError with "Invalid token" on 401', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchGhTransitions(BASE, TOKEN, PROJECT_ID)).rejects.toThrow('Invalid token');
  });

  it('throws ApiError with "Invalid token" on 403', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 403 } as unknown as Response);
    await expect(fetchGhTransitions(BASE, TOKEN, PROJECT_ID)).rejects.toThrow('Invalid token');
  });

  it('throws "Cannot reach" on network error', async () => {
    mockedGhFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchGhTransitions(BASE, TOKEN, PROJECT_ID)).rejects.toThrow('Cannot reach');
  });

  it('throws with status on other non-ok response', async () => {
    mockedGhFetch.mockResolvedValue({ ok: false, status: 500 } as unknown as Response);
    await expect(fetchGhTransitions(BASE, TOKEN, PROJECT_ID)).rejects.toThrow('500');
  });
});
