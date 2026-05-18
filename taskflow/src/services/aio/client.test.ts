import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';
import { AIO_API_PATH, AIO_PROJECTS_API_PATH, aioFetch } from './client';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PATH = '/project';

describe('aioFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue(new Response() as unknown as Response);
  });

  it('constructs URL as baseUrl + AIO_API_PATH + path (default)', async () => {
    await aioFetch(BASE, TOKEN, PATH, 'Test Operation');
    const expectedUrl = `${BASE}${AIO_API_PATH}${PATH}`;
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'aio',
      expectedUrl,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
      'Test Operation',
    );
  });

  it('strips trailing slash from baseUrl before constructing URL', async () => {
    await aioFetch(`${BASE}/`, TOKEN, PATH, 'Test Operation');
    const expectedUrl = `${BASE}${AIO_API_PATH}${PATH}`;
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'aio',
      expectedUrl,
      expect.anything(),
      'Test Operation',
    );
  });

  it('calls apiFetch with source "aio" (not "jira" or "gitlab")', async () => {
    await aioFetch(BASE, TOKEN, PATH, 'Test Operation');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'aio',
      expect.any(String),
      expect.anything(),
      'Test Operation',
    );
  });

  it('passes Authorization: Bearer <token> header', async () => {
    await aioFetch(BASE, TOKEN, PATH, 'Test Operation');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'aio',
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
      'Test Operation',
    );
  });

  it('passes Content-Type: application/json header', async () => {
    await aioFetch(BASE, TOKEN, PATH, 'Test Operation');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'aio',
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
      'Test Operation',
    );
  });

  it('forwards the operation label as the 4th argument to apiFetch', async () => {
    await aioFetch(BASE, TOKEN, PATH, 'Load AIO Cycles');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'aio',
      expect.any(String),
      expect.anything(),
      'Load AIO Cycles',
    );
  });

  it('uses AIO_PROJECTS_API_PATH when passed as apiPath', async () => {
    await aioFetch(BASE, TOKEN, PATH, 'Load AIO Projects', AIO_PROJECTS_API_PATH);
    const expectedUrl = `${BASE}${AIO_PROJECTS_API_PATH}${PATH}`;
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'aio',
      expectedUrl,
      expect.anything(),
      'Load AIO Projects',
    );
  });
});
