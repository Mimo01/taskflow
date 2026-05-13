import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock apiFetch at the lowest level (aioFetch wraps it)
vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchAioTestCasesForIssue, fetchAioTestRunSteps } from './issue-steps';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PROJECT_KEY = 'PROJ';
const ISSUE_KEY = 'PROJ-123';
const CYCLE_KEY = 'PROJ-CY-4';
const RUN_ID = '12131';

/** Build an AioPage<T> fixture. */
function makePageResponse<T>(items: T[], isLast = true): Record<string, unknown> {
  return { items, startAt: 0, maxResults: 50, isLast };
}

// Probe-confirmed fixture — field names from Phase 54 probe finding A
const TEST_CASE_FIXTURE = {
  id: 1,
  key: 'PROJ-TC-1',
  title: 'Login flow test',
  projectKey: 'PROJ',
  jiraRequirementIDs: ['186227'],
};

// Probe-confirmed fixture — field names from Phase 54 probe finding B.
// 'step' is the confirmed field name for action text (not 'stepAction').
// Raw AIO API uses uppercase 'ID' fields — biome-ignore applied per-line.
const STEP_FIXTURE = {
  // biome-ignore lint/style/useNamingConvention: Raw AIO API field name is uppercase ID
  ID: 37989,
  stepID: 18016,
  stepOrder: 0,
  testStepType: 'TEXT',
  step: 'Click login', // probe-confirmed field name
  expectedResult: 'Login page appears', // probe-confirmed field name
  actualResult: 'Login page appeared', // probe-confirmed field name
  testRunStepStatus: {
    // biome-ignore lint/style/useNamingConvention: Raw AIO API field name is uppercase ID
    ID: 53,
    name: 'Passed',
    description: 'The test step has passed',
  },
};

describe('fetchAioTestCasesForIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 with AioPage wrapper containing one test case → returns AioTestCase[] of length 1 with correct key/title', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makePageResponse([TEST_CASE_FIXTURE]),
    } as unknown as Response);

    const result = await fetchAioTestCasesForIssue(BASE, TOKEN, PROJECT_KEY, ISSUE_KEY);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('PROJ-TC-1');
    expect(result[0].title).toBe('Login flow test');
    expect(result[0].id).toBe(1);
  });

  it('200 with direct array (no pagination wrapper) → returns AioTestCase[]', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [TEST_CASE_FIXTURE],
    } as unknown as Response);

    const result = await fetchAioTestCasesForIssue(BASE, TOKEN, PROJECT_KEY, ISSUE_KEY);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('PROJ-TC-1');
  });

  it('200 with empty items array → returns []', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makePageResponse([]),
    } as unknown as Response);

    const result = await fetchAioTestCasesForIssue(BASE, TOKEN, PROJECT_KEY, ISSUE_KEY);

    expect(result).toEqual([]);
  });

  it('401 → throws ApiError with status 401', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as unknown as Response);

    let caughtError: unknown;
    try {
      await fetchAioTestCasesForIssue(BASE, TOKEN, PROJECT_KEY, ISSUE_KEY);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect((caughtError as { status?: number }).status).toBe(401);
  });

  it('404 → returns []', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await fetchAioTestCasesForIssue(BASE, TOKEN, PROJECT_KEY, ISSUE_KEY);

    expect(result).toEqual([]);
  });
});

describe('fetchAioTestRunSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('200 with steps at testRunSteps[] (probe-confirmed path) → returns AioTestRunStep[] with correct length and field values', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ testRunSteps: [STEP_FIXTURE] }),
    } as unknown as Response);

    const result = await fetchAioTestRunSteps(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID);

    expect(result).toHaveLength(1);
    expect(result[0].step).toBe('Click login'); // probe-confirmed field name
    expect(result[0].expectedResult).toBe('Login page appears');
    expect(result[0].actualResult).toBe('Login page appeared');
    expect(result[0].status).toBe('PASS'); // normalized from 'Passed'
  });

  it('404 → returns []', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await fetchAioTestRunSteps(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID);

    expect(result).toEqual([]);
  });

  it('step with no actualResult → AioTestRunStep.actualResult is undefined', async () => {
    const stepNoActual = { ...STEP_FIXTURE, actualResult: undefined };
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ testRunSteps: [stepNoActual] }),
    } as unknown as Response);

    const result = await fetchAioTestRunSteps(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID);

    expect(result).toHaveLength(1);
    expect(result[0].actualResult).toBeUndefined();
  });
});
