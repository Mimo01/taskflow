import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../lib/apiFetch';
import { TEMPO_API_PATH, tempoFetch } from './client';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const PATH = '/worklogs?dateFrom=2026-05-01&dateTo=2026-05-07';

describe('tempoFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue(new Response() as unknown as Response);
  });

  it('constructs URL as baseUrl + TEMPO_API_PATH + path', async () => {
    await tempoFetch(BASE, TOKEN, PATH, 'Load Tempo Worklogs');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'tempo',
      `${BASE}${TEMPO_API_PATH}${PATH}`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
      'Load Tempo Worklogs',
    );
  });

  it('strips trailing slash from baseUrl before constructing URL', async () => {
    await tempoFetch(`${BASE}/`, TOKEN, PATH, 'Load Tempo Worklogs');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'tempo',
      `${BASE}${TEMPO_API_PATH}${PATH}`,
      expect.anything(),
      'Load Tempo Worklogs',
    );
  });

  it('calls apiFetch with source "tempo" (not "jira") to avoid false Jira disconnect', async () => {
    await tempoFetch(BASE, TOKEN, PATH, 'Load Tempo Worklogs');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'tempo',
      expect.any(String),
      expect.anything(),
      expect.any(String),
    );
  });

  it('passes Authorization: Bearer <token> header', async () => {
    await tempoFetch(BASE, TOKEN, PATH, 'Load Tempo Worklogs');
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
    await tempoFetch(BASE, TOKEN, PATH, 'Load Tempo Worklogs');
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
    await tempoFetch(BASE, TOKEN, PATH, 'Load Tempo Worklogs');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.anything(),
      'Load Tempo Worklogs',
    );
  });

  it('accepts a custom apiPath override', async () => {
    const customPath = '/rest/tempo-timesheets/4';
    await tempoFetch(BASE, TOKEN, PATH, 'Load Tempo Worklogs', customPath);
    expect(vi.mocked(apiFetch)).toHaveBeenCalledWith(
      'tempo',
      `${BASE}${customPath}${PATH}`,
      expect.anything(),
      'Load Tempo Worklogs',
    );
  });
});
