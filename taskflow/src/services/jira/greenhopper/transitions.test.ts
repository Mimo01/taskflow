import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  greenhopperFetch: vi.fn(),
  GREENHOPPER_API_PATH: '/rest/greenhopper/1.0/xboard',
}));

vi.mock('../statuses', () => ({
  fetchAllJiraStatuses: vi.fn(),
}));

vi.mock('../../stronghold', () => ({
  readSecret: vi.fn(),
}));

import { useAuthStore } from '../../../stores/auth.store';
import { readSecret } from '../../stronghold';
import { fetchAllJiraStatuses } from '../statuses';
import { greenhopperFetch } from './client';
import {
  __adaptToJiraTransition,
  __ensureStatusMap,
  __indexTransitions,
  fetchGhTransitions,
  getGhTransitions,
  invalidateGhTransitions,
  peekGhTransitions,
  useGhTransitions,
} from './transitions';
import type { GhTransition, GhTransitionsResponse } from './types';
import { __resetWarnOnce } from './warnOnce';

const mockedGhFetch = vi.mocked(greenhopperFetch);
const mockedFetchStatuses = vi.mocked(fetchAllJiraStatuses);
const mockedReadSecret = vi.mocked(readSecret);

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_ID = 10001;

const minimalTransitionsPayload: GhTransitionsResponse = {
  projectAndIssueTypeToWorkflow: {},
  workflowToTransitions: {},
};

// ---------------------------------------------------------------------------
// fetchGhTransitions (existing — preserved)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Phase 72 cache layer
// ---------------------------------------------------------------------------

function makeEnvelope(): GhTransitionsResponse {
  return {
    projectAndIssueTypeToWorkflow: { '10001': { '10000': 'Default WF', '10001': 'Default WF' } },
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
        {
          transitionId: 21,
          name: 'Done',
          toStatusId: 5,
          hasScreen: false,
          hasConditions: false,
          hasValidators: false,
          isInitial: false,
          isGlobal: true,
        },
      ],
    },
  };
}

function makeStatuses() {
  return [
    {
      id: '3',
      name: 'In Progress',
      statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
    },
    { id: '5', name: 'Done', statusCategory: { id: 6, key: 'done', name: 'Done' } },
  ];
}

describe('__indexTransitions', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    __resetWarnOnce();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('hit: returns GhTransition[] for the (project, type) pair', () => {
    const env = makeEnvelope();
    const result = __indexTransitions(env, 10001, '10000');
    expect(result).toHaveLength(2);
    expect(result[0].transitionId).toBe(11);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('miss: returns [] when workflow mapping is absent', () => {
    const env = makeEnvelope();
    const result = __indexTransitions(env, 99999, 'nope');
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warns ONCE for two misses of the same (pid, tid)', () => {
    const env = makeEnvelope();
    __indexTransitions(env, 99999, 'nope');
    __indexTransitions(env, 99999, 'nope');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('__adaptToJiraTransition', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    __resetWarnOnce();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function map() {
    return new Map([
      [
        '3',
        {
          name: 'In Progress',
          statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
        },
      ],
    ]);
  }

  it('status hit: populates to.name + to.statusCategory and stringifies ids', () => {
    const gh: GhTransition = {
      transitionId: 11,
      name: 'Start',
      toStatusId: 3,
      hasScreen: false,
      hasConditions: false,
      hasValidators: false,
      isInitial: false,
      isGlobal: false,
    };
    expect(__adaptToJiraTransition(gh, map())).toEqual({
      id: '11',
      name: 'Start',
      to: {
        id: '3',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
      },
      hasScreen: false,
      hasValidators: false,
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('status miss: synthesizes Status N + Unknown fallback and warns', () => {
    const gh: GhTransition = {
      transitionId: 21,
      name: 'Done',
      toStatusId: 999,
      hasScreen: false,
      hasConditions: false,
      hasValidators: false,
      isInitial: false,
      isGlobal: false,
    };
    expect(__adaptToJiraTransition(gh, map())).toEqual({
      id: '21',
      name: 'Done',
      to: {
        id: '999',
        name: 'Status 999',
        statusCategory: { id: 0, key: 'indeterminate', name: 'Unknown' },
      },
      hasScreen: false,
      hasValidators: false,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('D-08: propagates hasScreen:true through the status-hit branch', () => {
    const gh: GhTransition = {
      transitionId: 31,
      name: 'Start Progress',
      toStatusId: 3,
      hasScreen: true,
      hasConditions: false,
      hasValidators: false,
      isInitial: false,
      isGlobal: false,
    };
    const result = __adaptToJiraTransition(gh, map());
    expect(result.hasScreen).toBe(true);
    expect(result.hasValidators).toBe(false);
  });

  it('D-08: propagates hasValidators:true through the status-miss (fallback) branch', () => {
    const gh: GhTransition = {
      transitionId: 41,
      name: 'Approve',
      toStatusId: 999,
      hasScreen: false,
      hasConditions: false,
      hasValidators: true,
      isInitial: false,
      isGlobal: false,
    };
    const result = __adaptToJiraTransition(gh, map());
    expect(result.hasScreen).toBe(false);
    expect(result.hasValidators).toBe(true);
  });
});

describe('__ensureStatusMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caches the status list under ['jira-statuses'] with staleTime+gcTime: Infinity", async () => {
    mockedFetchStatuses.mockResolvedValue(makeStatuses());
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'ensureQueryData');

    const result = await __ensureStatusMap(qc, BASE, TOKEN);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['jira-statuses'],
        staleTime: Infinity,
        gcTime: Infinity,
      }),
    );
    expect(result.get('3')?.name).toBe('In Progress');
    expect(result.get('5')?.statusCategory.key).toBe('done');
  });
});

describe('getGhTransitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetWarnOnce();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('caches the envelope across multiple typeIds (one fetch per project)', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeEnvelope(),
    } as unknown as Response);
    mockedFetchStatuses.mockResolvedValue(makeStatuses());

    const qc = new QueryClient();
    const a = await getGhTransitions(qc, BASE, TOKEN, 10001, '10000');
    const b = await getGhTransitions(qc, BASE, TOKEN, 10001, '10001');

    expect(mockedGhFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetchStatuses).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(a[0].id).toBe('11');
  });

  it('returns adapted JiraTransition[] with hydrated to.statusCategory', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeEnvelope(),
    } as unknown as Response);
    mockedFetchStatuses.mockResolvedValue(makeStatuses());

    const qc = new QueryClient();
    const result = await getGhTransitions(qc, BASE, TOKEN, 10001, '10000');

    expect(result[0]).toEqual({
      id: '11',
      name: 'Start',
      to: {
        id: '3',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
      },
    });
  });
});

describe('peekGhTransitions', () => {
  beforeEach(() => {
    __resetWarnOnce();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns undefined when envelope is not cached yet', () => {
    const qc = new QueryClient();
    qc.setQueryData(['jira-statuses'], makeStatuses());
    expect(peekGhTransitions(qc, 10001, '10000')).toBeUndefined();
  });

  it('returns undefined when status list is not cached yet', () => {
    const qc = new QueryClient();
    qc.setQueryData(['gh-transitions-envelope', 10001], makeEnvelope());
    expect(peekGhTransitions(qc, 10001, '10000')).toBeUndefined();
  });

  it('resolves any (projectId, issueTypeId) sync once both layers are cached', () => {
    const qc = new QueryClient();
    qc.setQueryData(['gh-transitions-envelope', 10001], makeEnvelope());
    qc.setQueryData(['jira-statuses'], makeStatuses());

    // Story type — warmed via sentinel.
    const storyResult = peekGhTransitions(qc, 10001, '10000');
    // Subtask type — never registered as a per-type query, but envelope
    // covers it: the bug fix that motivated this helper.
    const subtaskResult = peekGhTransitions(qc, 10001, '10001');

    expect(storyResult).toHaveLength(2);
    expect(subtaskResult).toHaveLength(2);
    expect(subtaskResult?.[0]).toEqual({
      id: '11',
      name: 'Start',
      to: {
        id: '3',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
      },
    });
  });

  it('returns [] on workflow miss (issuetype not in projectAndIssueTypeToWorkflow)', () => {
    const qc = new QueryClient();
    qc.setQueryData(['gh-transitions-envelope', 10001], makeEnvelope());
    qc.setQueryData(['jira-statuses'], makeStatuses());

    expect(peekGhTransitions(qc, 10001, 'no-such-type')).toEqual([]);
  });
});

describe('invalidateGhTransitions', () => {
  it('with projectId: invalidates envelope + per-type for that project only', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());

    invalidateGhTransitions(qc, 7);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, { queryKey: ['gh-transitions-envelope', 7] });
    expect(spy).toHaveBeenNthCalledWith(2, { queryKey: ['gh-transitions', 7] });
  });

  it('without projectId: invalidates the entire namespaces', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries').mockImplementation(() => Promise.resolve());

    invalidateGhTransitions(qc);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, { queryKey: ['gh-transitions-envelope'] });
    expect(spy).toHaveBeenNthCalledWith(2, { queryKey: ['gh-transitions'] });
  });
});

describe('useGhTransitions (hook dedupe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetWarnOnce();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.setState({ jiraBaseUrl: BASE });
    mockedReadSecret.mockResolvedValue(TOKEN);
  });

  function makeWrapper(qc: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client: qc }, children);
    };
  }

  it('two consumers of the same projectId but different typeIds → ONE fetchGhTransitions call', async () => {
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeEnvelope(),
    } as unknown as Response);
    mockedFetchStatuses.mockResolvedValue(makeStatuses());

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = makeWrapper(qc);

    const a = renderHook(() => useGhTransitions(10001, '10000'), { wrapper });
    const b = renderHook(() => useGhTransitions(10001, '10001'), { wrapper });

    await waitFor(() => {
      expect(a.result.current.data).toBeDefined();
      expect(b.result.current.data).toBeDefined();
    });

    expect(mockedGhFetch).toHaveBeenCalledTimes(1);
    expect(a.result.current.data).toHaveLength(2);
    expect(b.result.current.data).toHaveLength(2);
  });

  it('is disabled until token is loaded', async () => {
    mockedReadSecret.mockResolvedValue('');
    mockedGhFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => makeEnvelope(),
    } as unknown as Response);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useGhTransitions(10001, '10000'), { wrapper });

    // With empty token the query should remain disabled and never fetch.
    await new Promise((r) => setTimeout(r, 20));
    expect(mockedGhFetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
