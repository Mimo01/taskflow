import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({
  tempoFetch: vi.fn(),
  TEMPO_API_PATH: '/rest/tempo-timesheets/3',
}));

import { tempoFetch } from './client';
import type { TempoWorklog } from './types';
import { fetchWorklogs } from './worklogs';

const mockedTempoFetch = vi.mocked(tempoFetch);

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';
const FROM = '2026-05-01';
const TO = '2026-05-07';
const USERNAMES = ['jsmith', 'jdoe'];

function makeWorklog(id: number, dateStarted: string): TempoWorklog {
  return {
    tempoWorklogId: id,
    jiraWorklogId: id + 1000,
    issue: { key: `PROJ-${id}`, summary: `Issue ${id}` },
    author: { name: 'jsmith', key: 'JIRAUSER001', displayName: 'John Smith' },
    timeSpentSeconds: 3600,
    dateStarted,
  };
}

describe('fetchWorklogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all worklogs from the flat array response', async () => {
    const worklogs = [
      makeWorklog(1, '2026-05-01T09:00:00.000+0000'),
      makeWorklog(2, '2026-05-02T10:00:00.000+0000'),
      makeWorklog(3, '2026-05-03T11:00:00.000+0000'),
    ];
    mockedTempoFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => worklogs,
    } as unknown as Response);

    const result = await fetchWorklogs(BASE, TOKEN, USERNAMES, FROM, TO);
    expect(result).toHaveLength(3);
    expect(mockedTempoFetch).toHaveBeenCalledTimes(1);
  });

  it('normalizes dateStarted to YYYY-MM-DD via .slice(0, 10)', async () => {
    const worklogs = [makeWorklog(1, '2026-05-01T09:00:00.000+0200')];
    mockedTempoFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => worklogs,
    } as unknown as Response);

    const result = await fetchWorklogs(BASE, TOKEN, USERNAMES, FROM, TO);
    expect(result[0].dateStarted).toBe('2026-05-01');
  });

  it('does not use new Date() for date normalization (timezone-safe .slice)', async () => {
    // A datetime at end-of-day UTC+0 that new Date().toLocaleDateString() would
    // shift to the previous day in UTC+2 timezones.
    const worklogs = [makeWorklog(1, '2026-05-07T23:30:00.000+0000')];
    mockedTempoFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => worklogs,
    } as unknown as Response);

    const result = await fetchWorklogs(BASE, TOKEN, USERNAMES, FROM, TO);
    // .slice(0, 10) always returns exactly the first 10 chars — no TZ shift
    expect(result[0].dateStarted).toBe('2026-05-07');
  });

  it('includes username query params for each user in USERNAMES', async () => {
    mockedTempoFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);

    await fetchWorklogs(BASE, TOKEN, USERNAMES, FROM, TO);
    const callArg = mockedTempoFetch.mock.calls[0][2] as string;
    expect(callArg).toContain('username=jsmith');
    expect(callArg).toContain('username=jdoe');
    expect(callArg).toContain('dateFrom=2026-05-01');
    expect(callArg).toContain('dateTo=2026-05-07');
  });

  it('returns empty array on 404', async () => {
    mockedTempoFetch.mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await fetchWorklogs(BASE, TOKEN, USERNAMES, FROM, TO);
    expect(result).toEqual([]);
  });

  it('throws ApiError with status 401 on authentication failure', async () => {
    mockedTempoFetch.mockResolvedValue({
      ok: false,
      status: 401,
    } as unknown as Response);

    await expect(fetchWorklogs(BASE, TOKEN, USERNAMES, FROM, TO)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('throws ApiError on other non-ok responses', async () => {
    mockedTempoFetch.mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    await expect(fetchWorklogs(BASE, TOKEN, USERNAMES, FROM, TO)).rejects.toMatchObject({
      status: 500,
    });
  });

  it('returns empty array when API returns empty array', async () => {
    mockedTempoFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as unknown as Response);

    const result = await fetchWorklogs(BASE, TOKEN, [], FROM, TO);
    expect(result).toEqual([]);
  });
});
