import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import { fetchAioTestCaseDetail } from './testcases';

const mockedApiFetch = vi.mocked(apiFetch);
const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

// Mirrors LIVE P4 (261013-mnc-PROBE-RESULTS.md): GET /project/{pk}/testcase/{tcKey}/detail
const P4_FIXTURE = {
  ID: 9,
  key: 'SHOP-TC-5',
  title: 'Login flow',
  description: 'Verifies the login flow end to end',
  ownedByID: 'ext94772',
  createdDate: 1777700000000,
  folder: { ID: 3, name: 'Auth', parentID: 1 },
  status: { ID: 2, name: 'Published', description: '' },
  type: { ID: 4, name: 'System Test' },
  scriptType: { name: 'Classic' },
  version: 3,
  versions: [{ ID: 1 }],
  steps: [{ ID: 1, step: 'ignored', expectedResult: 'ignored', stepType: 'TEXT' }],
  customFields: [
    { ID: 1, name: 'Platform', value: { ID: 1, value: 'Web' } },
    {
      ID: 2,
      name: 'Browsers',
      value: [
        { ID: 2, value: 'Chrome' },
        { ID: 3, value: 'Firefox' },
      ],
    },
    { ID: 3, name: 'Empty', value: [] },
  ],
};

describe('fetchAioTestCaseDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalises the live /detail shape', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => P4_FIXTURE,
    } as unknown as Response);
    const result = await fetchAioTestCaseDetail(BASE, TOKEN, 'SHOP', 'SHOP-TC-5');
    expect(result).toEqual({
      key: 'SHOP-TC-5',
      title: 'Login flow',
      description: 'Verifies the login flow end to end',
      statusName: 'Published',
      typeName: 'System Test',
      folderName: 'Auth',
      ownedByID: 'ext94772',
      createdDate: new Date(1777700000000).toISOString(),
      version: '3',
      customFields: [
        { name: 'Platform', value: 'Web' },
        { name: 'Browsers', value: 'Chrome, Firefox' },
      ],
    });
  });

  it('requests the URL-encoded /detail path', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => P4_FIXTURE,
    } as unknown as Response);
    await fetchAioTestCaseDetail(BASE, TOKEN, 'ES HOP', 'SHOP-TC-5');
    const url = String(mockedApiFetch.mock.calls[0][1]);
    expect(url).toContain('/project/ES%20HOP/testcase/SHOP-TC-5/detail');
  });

  it('404 → null', async () => {
    mockedApiFetch.mockResolvedValueOnce({ ok: false, status: 404 } as unknown as Response);
    expect(await fetchAioTestCaseDetail(BASE, TOKEN, 'SHOP', 'SHOP-TC-5')).toBeNull();
  });

  it('401 → ApiError', async () => {
    mockedApiFetch.mockResolvedValueOnce({ ok: false, status: 401 } as unknown as Response);
    await expect(fetchAioTestCaseDetail(BASE, TOKEN, 'SHOP', 'SHOP-TC-5')).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
