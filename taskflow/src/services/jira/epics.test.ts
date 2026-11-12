import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { buildEpicSearchJql, fetchEpicSummary, searchOpenEpics } from './epics';

const mockApi = vi.mocked(apiFetch);
const OPTS = { epicNameFieldKey: 'cf_name', epicColorFieldKey: 'cf_color' };

function res(ok: boolean, body: unknown = {}) {
  return { ok, json: async () => body } as unknown as Response;
}
function jqlOf(call: number): string {
  const url = String(mockApi.mock.calls[call][1]);
  return decodeURIComponent(new URL(url).searchParams.get('jql') ?? '');
}

beforeEach(() => mockApi.mockReset());

describe('buildEpicSearchJql', () => {
  it('lists recent open epics for an empty query', () => {
    expect(buildEpicSearchJql('PROJ', '')).toBe(
      'project = "PROJ" AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC',
    );
  });

  it('ANDs tokens and wildcards the last one', () => {
    const jql = buildEpicSearchJql('PROJ', 'pay rev');
    expect(jql).toContain('text ~ "pay" AND text ~ "rev*"');
    expect(jql).toContain('statusCategory != Done');
    expect(jql.endsWith('ORDER BY updated DESC')).toBe(true);
  });

  it('never emits raw quotes, backslashes or reserved characters from input', () => {
    const jql = buildEpicSearchJql('PROJ', 'a"b\\c (x)');
    expect(jql).not.toContain('a"b');
    expect(jql).not.toContain('\\c');
    expect(jql).toContain('text ~ "a" AND text ~ "b" AND text ~ "c" AND text ~ "x*"');
  });

  it('escapes the project key', () => {
    expect(buildEpicSearchJql('P"X', '')).toContain('project = "P\\"X"');
  });

  it('ORs in the key for key-shaped terms', () => {
    expect(buildEpicSearchJql('PROJ', 'proj-12')).toContain('OR key = "PROJ-12")');
  });

  it('expands a bare number to a project key', () => {
    expect(buildEpicSearchJql('PROJ', '12')).toContain('key = "PROJ-12"');
  });

  it('omits the key clause when withKey is false', () => {
    expect(buildEpicSearchJql('PROJ', '12', { withKey: false })).not.toContain('key =');
  });
});

describe('searchOpenEpics', () => {
  it('maps name (fallback summary) and colour', async () => {
    mockApi.mockResolvedValueOnce(
      res(true, {
        issues: [
          { key: 'P-1', fields: { summary: 'Sum', cf_name: 'Name', cf_color: 'ghx-label-4' } },
          { key: 'P-2', fields: { summary: 'Only' } },
        ],
      }),
    );
    expect(await searchOpenEpics('https://j/', 't', 'P', '', OPTS)).toEqual([
      { key: 'P-1', name: 'Name', summary: 'Sum', color: 'ghx-label-4' },
      { key: 'P-2', name: 'Only', summary: 'Only', color: null },
    ]);
  });

  it('tolerates a missing issues array', async () => {
    mockApi.mockResolvedValueOnce(res(true, {}));
    expect(await searchOpenEpics('https://j', 't', 'P', '', OPTS)).toEqual([]);
  });

  it('retries once without the key clause when the request fails', async () => {
    mockApi.mockResolvedValueOnce(res(false)).mockResolvedValueOnce(res(true, { issues: [] }));
    await searchOpenEpics('https://j', 't', 'P', '12', OPTS);
    expect(mockApi).toHaveBeenCalledTimes(2);
    expect(jqlOf(0)).toContain('key =');
    expect(jqlOf(1)).not.toContain('key =');
  });

  it('returns [] without retry when there was no key clause', async () => {
    mockApi.mockResolvedValueOnce(res(false));
    expect(await searchOpenEpics('https://j', 't', 'P', 'abc', OPTS)).toEqual([]);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });
});

describe('fetchEpicSummary', () => {
  it('returns null on a non-ok response', async () => {
    mockApi.mockResolvedValueOnce(res(false));
    expect(await fetchEpicSummary('https://j', 't', 'P-1', 'n', 'c')).toBeNull();
  });
});
