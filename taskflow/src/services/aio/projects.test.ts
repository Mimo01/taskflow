import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('./client', () => ({
  aioFetch: vi.fn(),
  AIO_PROJECTS_API_PATH: '/rest/aio-tcms/1.0',
}));

import { apiFetch } from '../../lib/apiFetch';
import { aioFetch } from './client';
import { fetchAioProjects, fetchAioTraceabilityTestCases } from './projects';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedAioFetch = vi.mocked(aioFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('fetchAioProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns project list on 200', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ ID: 1, jiraProjectKey: 'PROJ' }],
    } as unknown as Response);

    const result = await fetchAioProjects(BASE, TOKEN);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].projectKey).toBe('PROJ');
    expect(result[0].name).toBe('PROJ');
  });

  it('throws ApiError with "Invalid token or token has expired" on 401', async () => {
    mockedAioFetch.mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioProjects(BASE, TOKEN)).rejects.toThrow(
      'Invalid token or token has expired',
    );
  });

  it('returns empty array on 404', async () => {
    mockedAioFetch.mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await fetchAioProjects(BASE, TOKEN);
    expect(result).toEqual([]);
  });

  it('throws "Cannot reach AIO" on network error', async () => {
    mockedAioFetch.mockRejectedValue(new Error('timeout'));
    await expect(fetchAioProjects(BASE, TOKEN)).rejects.toThrow('Cannot reach AIO');
  });
});

// Reference mockedApiFetch so unused-import lint doesn't fire — kept for
// future tests that may exercise the apiFetch shim directly.
void mockedApiFetch;

// Plan 54-08 Task 3 (Gap 1 supporting): shape-lock tests for the
// traceability mapper. The widened return shape (testRun.ID -> runs[0].runId
// stringified, testCycle.detail.key -> runs[0].cycleKey, latestTestRun.ID
// fallback, test.detail.key filter, title/name resolution, 404 / non-array /
// network-error empty-array fallbacks) is verified verbatim against the
// Probe C1 shape recorded in 54-PROBE-FINDINGS.md ## Probe C.
const AIO_PROJECT_ID = 13806;
const JIRA_ISSUE_NUMERIC_ID = 393120;

describe('fetchAioTraceabilityTestCases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps testRun.ID + testCycle.detail.key to runs[0] with stringified runId', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          test: { ID: 100, detail: { key: 'PROJ-TC-1', title: 'My test' } },
          testRun: { ID: 263794 },
          testCycle: { detail: { key: 'ESHOP-CY-1011' } },
        },
      ],
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toEqual([
      {
        id: 100,
        key: 'PROJ-TC-1',
        title: 'My test',
        runs: [{ runId: '263794', cycleKey: 'ESHOP-CY-1011' }],
      },
    ]);
  });

  it('falls back to latestTestRun.ID when testRun is absent', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          test: { ID: 101, detail: { key: 'PROJ-TC-2' } },
          latestTestRun: { ID: 100 },
          testCycle: { detail: { key: 'CY-A' } },
        },
      ],
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toHaveLength(1);
    expect(result[0].runs).toEqual([{ runId: '100', cycleKey: 'CY-A' }]);
  });

  it('produces empty runs[] when both testRun and latestTestRun are absent', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          test: { ID: 102, detail: { key: 'PROJ-TC-3' } },
        },
      ],
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toHaveLength(1);
    expect(result[0].runs).toEqual([]);
  });

  it('produces empty runs[] when cycleKey is missing (testRun.ID present but no testCycle)', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          test: { ID: 103, detail: { key: 'PROJ-TC-4' } },
          testRun: { ID: 999 },
          // testCycle absent — line 81 ternary requires both runId and cycleKey.
        },
      ],
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toHaveLength(1);
    expect(result[0].runs).toEqual([]);
  });

  it('filters out items missing test.detail.key', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { test: { ID: 50, detail: { name: 'no key here' } } },
        { test: { ID: 51, detail: { key: 'PROJ-TC-VALID' } } },
      ],
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('PROJ-TC-VALID');
  });

  it('uses test.detail.title; falls back to test.detail.name; empty string if both absent', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { test: { ID: 60, detail: { key: 'K1', title: 'Has Title' } } },
        { test: { ID: 61, detail: { key: 'K2', name: 'Has Name' } } },
        { test: { ID: 62, detail: { key: 'K3' } } },
      ],
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('Has Title');
    expect(result[1].title).toBe('Has Name');
    expect(result[2].title).toBe('');
  });

  it('returns [] on 404', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toEqual([]);
  });

  it('returns [] on non-array JSON', async () => {
    mockedAioFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ error: 'foo' }),
    } as unknown as Response);

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toEqual([]);
  });

  it('returns [] when aioFetch throws (network error)', async () => {
    mockedAioFetch.mockRejectedValue(new Error('network'));

    const result = await fetchAioTraceabilityTestCases(
      BASE,
      TOKEN,
      AIO_PROJECT_ID,
      JIRA_ISSUE_NUMERIC_ID,
      'defect',
    );

    expect(result).toEqual([]);
  });
});
