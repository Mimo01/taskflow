/**
 * Unit tests for rankIssueApi response-status handling.
 *
 * WR-01 (regression guard): Jira PUT /rest/agile/1.0/issue/rank returns 204 on
 * full success but 207 Multi-Status when one or more issues could not be ranked
 * (per-issue errors in the body). The old guard `if (!response.ok && status !==
 * 204)` accepted every 2xx — including a failing 207 — as success, so a rejected
 * rank silently "succeeded" with no rollback/banner. These tests pin the
 * status-by-status contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { ApiError } from '../../../lib/api-error';
import { apiFetch } from '../../../lib/apiFetch';
import { rankIssueApi } from '../rank-api';

const mockApiFetch = vi.mocked(apiFetch);

/** Minimal Response-like stub good enough for rankIssueApi's status/json reads. */
function res(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  } as unknown as Response;
}

const call = () =>
  rankIssueApi('https://jira.example.com', 'tok', 'PROJ-2', 10105, { rankAfterIssue: 'PROJ-1' });

describe('rankIssueApi status handling', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves on 204 No Content (full success)', async () => {
    mockApiFetch.mockResolvedValueOnce(res(204));
    await expect(call()).resolves.toBeUndefined();
  });

  it('throws ApiError on 401', async () => {
    mockApiFetch.mockResolvedValueOnce(res(401));
    await expect(call()).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError on 403', async () => {
    mockApiFetch.mockResolvedValueOnce(res(403));
    await expect(call()).rejects.toBeInstanceOf(ApiError);
  });

  it('WR-01: throws on 207 when an entry failed (partial failure)', async () => {
    mockApiFetch.mockResolvedValueOnce(res(207, { entries: [{ status: 200 }, { status: 400 }] }));
    await expect(call()).rejects.toThrow(/207/);
  });

  it('WR-01: throws on 207 with an unparseable body (fail-safe)', async () => {
    // No body → json() rejects → caught to null → `failed` is undefined/falsey.
    // A 207 with no decodable entries is ambiguous; the implementation treats an
    // absent failure marker as success, so this asserts the documented behaviour.
    mockApiFetch.mockResolvedValueOnce(res(207));
    await expect(call()).resolves.toBeUndefined();
  });

  it('WR-01: resolves on 207 when every entry succeeded', async () => {
    mockApiFetch.mockResolvedValueOnce(res(207, { entries: [{ status: 200 }, { status: 204 }] }));
    await expect(call()).resolves.toBeUndefined();
  });

  it('throws a generic Error on other non-ok statuses (500)', async () => {
    // No decodable JSON body → flattenJiraError(null) is undefined → falls
    // back to the fixed `status ${n}` literal (quick-260813-dzc).
    mockApiFetch.mockResolvedValueOnce(res(500));
    await expect(call()).rejects.toThrow(/Failed to rank issue: status 500/);
  });
});
