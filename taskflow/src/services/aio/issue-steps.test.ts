import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock apiFetch at the lowest level (aioFetch wraps it)
vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import {
  fetchAioTestCasesForIssue,
  fetchAioTestRunDetail,
  fetchAioTestRunSteps,
} from './issue-steps';

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
// Raw AIO API uses uppercase 'ID' fields.
const STEP_FIXTURE = {
  ID: 37989,
  stepID: 18016,
  stepOrder: 0,
  testStepType: 'TEXT',
  step: 'Click login', // probe-confirmed field name
  expectedResult: 'Login page appears', // probe-confirmed field name
  actualResult: 'Login page appeared', // probe-confirmed field name
  testRunStepStatus: {
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

// Fixture mirrors LIVE P3 (261013-mnc-PROBE-RESULTS.md): no testCase, no testData,
// stepOrder present (out of order here), per-step jiraDefectIDs, status IDs.
describe('fetchAioTestRunDetail — live P3 shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const P3 = (statusID: number, statusName: string) => ({
    ID: 555,
    createdDate: 1777900000000,
    updatedDate: 1778000000000,
    executedByID: 'ext11111',
    jiraDefectIDs: [186300],
    testRunStatus: { ID: statusID, name: statusName, description: '' },
    testRunSteps: [
      {
        ID: 2,
        stepID: 20,
        stepOrder: 1,
        step: 'Second',
        expectedResult: 'B',
        actualResult: 'b',
        jiraDefectIDs: [186300],
        testStepType: 'TEXT',
        testRunStepStatus: { ID: 3, name: 'Failed', description: '' },
      },
      {
        ID: 1,
        stepID: 10,
        stepOrder: 0,
        step: 'First',
        expectedResult: 'A',
        jiraDefectIDs: [],
        testStepType: 'TEXT',
        testRunStepStatus: { ID: 1, name: 'Not Run', description: '' },
      },
    ],
  });

  const load = async (statusID: number, statusName: string) => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => P3(statusID, statusName),
    } as unknown as Response);
    return fetchAioTestRunDetail(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID);
  };

  it('maps run fields, sorts steps by stepOrder and reads no testCase', async () => {
    const result = await load(52, 'In Progress');
    expect(result).not.toBeNull();
    const run = result?.run;
    const steps = result?.steps ?? [];
    expect(run?.id).toBe('555');
    expect(run?.testCaseKey).toBe('');
    expect(run?.testCase).toBeUndefined();
    expect(run?.executedByID).toBe('ext11111');
    expect(run?.createdDate).toBe(new Date(1777900000000).toISOString());
    expect(run?.executedDate).toBe(new Date(1778000000000).toISOString());
    expect(run?.jiraDefectIDs).toEqual([186300]);
    expect(steps.map((s) => s.step)).toEqual(['First', 'Second']);
    expect(steps[1].jiraDefectIDs).toEqual([186300]);
    expect(steps[1].stepOrder).toBe(1);
    expect(steps[1].testStepType).toBe('TEXT');
    expect(steps[1]).not.toHaveProperty('testData');
  });

  it('maps status via testRunStatus.ID: 52 → IN_PROGRESS, 901 → PASS', async () => {
    expect((await load(52, 'In Progress'))?.run.status).toBe('IN_PROGRESS');
    expect((await load(901, 'N/A'))?.run.status).toBe('PASS');
  });

  it('prefers the ID over a conflicting name', async () => {
    expect((await load(54, 'Passed'))?.run.status).toBe('FAIL');
  });

  it('falls back to the name only when the ID is absent', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ID: 1, testRunStatus: { name: 'In Progress' }, testRunSteps: [] }),
    } as unknown as Response);
    const r = await fetchAioTestRunDetail(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID);
    expect(r?.run.status).toBe('IN_PROGRESS');
  });

  it('optional-field: includes testData only when a non-empty string', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ID: 1,
        testRunStatus: { ID: 53, name: 'Passed' },
        testRunSteps: [
          { ID: 1, stepOrder: 0, step: 'S', testData: 'user=admin' },
          { ID: 2, stepOrder: 1, step: 'T', testData: '' },
        ],
      }),
    } as unknown as Response);
    const r = await fetchAioTestRunDetail(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID);
    expect(r?.steps[0].testData).toBe('user=admin');
    expect(r?.steps[1]).not.toHaveProperty('testData');
  });

  it('404 → null, 401 → ApiError', async () => {
    mockedApiFetch.mockResolvedValueOnce({ ok: false, status: 404 } as unknown as Response);
    expect(await fetchAioTestRunDetail(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID)).toBeNull();
    mockedApiFetch.mockResolvedValueOnce({ ok: false, status: 401 } as unknown as Response);
    await expect(
      fetchAioTestRunDetail(BASE, TOKEN, PROJECT_KEY, CYCLE_KEY, RUN_ID),
    ).rejects.toMatchObject({ status: 401 });
  });
});
