import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../../lib/apiFetch';
import { GREENHOPPER_API_PATH, greenhopperFetch } from './client';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PATH = '/work/allData.json?rapidViewId=1';

describe('greenhopperFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue({ ok: true } as unknown as Response);
  });

  it('constructs URL as baseUrl + GREENHOPPER_API_PATH + path', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      `${BASE}${GREENHOPPER_API_PATH}${PATH}`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
      'Load Sprint Board',
    );
  });

  it('strips trailing slash from baseUrl before constructing URL', async () => {
    await greenhopperFetch(`${BASE}/`, TOKEN, PATH, 'Load Sprint Board');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      `${BASE}${GREENHOPPER_API_PATH}${PATH}`,
      expect.anything(),
      'Load Sprint Board',
    );
  });

  it('calls apiFetch with source "jira" (not "greenhopper") per D-04 + RESEARCH Pitfall 8', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      expect.any(String),
      expect.anything(),
      expect.any(String),
    );
  });

  it('passes Authorization: Bearer <token> header', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
      expect.any(String),
    );
  });

  it('passes Content-Type: application/json header', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
      expect.any(String),
    );
  });

  it('forwards the operation label as the 4th argument to apiFetch', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.anything(),
      'Load Sprint Board',
    );
  });

  it('defaults method to GET when init.method is absent', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ method: 'GET' }),
      expect.any(String),
    );
  });

  it('honors init.method when provided', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board', undefined, {
      method: 'POST',
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ method: 'POST' }),
      expect.any(String),
    );
  });

  it('omits body when init.body is absent', async () => {
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board');
    const callArgs = vi.mocked(apiFetch).mock.calls[0];
    const init = callArgs[2] as RequestInit;
    expect(init).not.toHaveProperty('body');
  });

  it('includes body when init.body is provided', async () => {
    const body = JSON.stringify({ foo: 'bar' });
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board', undefined, {
      method: 'POST',
      body,
    });
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ body }),
      expect.any(String),
    );
  });

  it('accepts a custom apiPath override', async () => {
    const customPath = '/rest/greenhopper/1.0/custom';
    await greenhopperFetch(BASE, TOKEN, PATH, 'Load Sprint Board', customPath);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'jira',
      `${BASE}${customPath}${PATH}`,
      expect.anything(),
      'Load Sprint Board',
    );
  });

  it('exports GREENHOPPER_API_PATH equal to /rest/greenhopper/1.0/xboard', () => {
    expect(GREENHOPPER_API_PATH).toBe('/rest/greenhopper/1.0/xboard');
  });
});
