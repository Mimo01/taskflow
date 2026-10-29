import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchVersionIssueCounts, fetchVersionsStatusBreakdown } from './jira';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
import { fetch as mockFetch } from '@tauri-apps/plugin-http';

const BASE = 'https://jira.example.com';
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as never;
const issue = (cat: string | undefined, ids: string[]) => ({
  fields: {
    status: cat ? { statusCategory: { key: cat } } : {},
    fixVersions: ids.map((id) => ({ id })),
  },
});
const urlOf = (i: number) => vi.mocked(mockFetch).mock.calls[i][0] as string;
const jqlOf = (u: string) => decodeURIComponent(new URL(u).searchParams.get('jql') ?? '');

describe('fetchVersionsStatusBreakdown', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('paginates until total is read and sums across pages', async () => {
    vi.mocked(mockFetch)
      .mockResolvedValueOnce(
        ok({ total: 3, issues: [issue('done', ['101']), issue('new', ['101'])] }),
      )
      .mockResolvedValueOnce(ok({ total: 3, issues: [issue('indeterminate', ['102'])] }));
    const r = await fetchVersionsStatusBreakdown(BASE, 't', ['101', '102']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(urlOf(1)).toContain('startAt=2');
    expect(r['101']).toEqual({ new: 1, indeterminate: 0, done: 1 });
    expect(r['102']).toEqual({ new: 0, indeterminate: 1, done: 0 });
  });

  it('builds the expected request', async () => {
    vi.mocked(mockFetch).mockResolvedValue(ok({ total: 0, issues: [] }));
    await fetchVersionsStatusBreakdown(BASE, 't', ['101', '102']);
    const u = urlOf(0);
    expect(jqlOf(u)).toBe('fixVersion in (101,102)');
    expect(u).toContain('fields=status,fixVersions');
    expect(u).toContain('maxResults=200');
    expect(jqlOf(u).toLowerCase()).not.toContain('subtask');
  });

  it('counts a multi-version issue toward each and ignores unrequested ids', async () => {
    vi.mocked(mockFetch).mockResolvedValue(
      ok({ total: 1, issues: [issue('done', ['101', '102', '999'])] }),
    );
    const r = await fetchVersionsStatusBreakdown(BASE, 't', ['101', '102']);
    expect(r['101'].done).toBe(1);
    expect(r['102'].done).toBe(1);
    expect(r['999']).toBeUndefined();
  });

  it('maps unknown or missing category to new and prefills zero ids', async () => {
    vi.mocked(mockFetch).mockResolvedValue(
      ok({ total: 2, issues: [issue('wat', ['101']), issue(undefined, ['101'])] }),
    );
    const r = await fetchVersionsStatusBreakdown(BASE, 't', ['101', '103']);
    expect(r['101']).toEqual({ new: 2, indeterminate: 0, done: 0 });
    expect(r['103']).toEqual({ new: 0, indeterminate: 0, done: 0 });
  });

  it('rejects invalid ids without fetching', async () => {
    await expect(fetchVersionsStatusBreakdown(BASE, 't', ['abc'])).rejects.toThrow(
      'Invalid versionId: abc',
    );
    await expect(
      fetchVersionsStatusBreakdown(BASE, 't', ['101', '1) OR project=X']),
    ).rejects.toThrow('Invalid versionId');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('terminates on an empty page before total is reached', async () => {
    vi.mocked(mockFetch)
      .mockResolvedValueOnce(ok({ total: 10, issues: [issue('done', ['101'])] }))
      .mockResolvedValueOnce(ok({ total: 10, issues: [] }));
    await fetchVersionsStatusBreakdown(BASE, 't', ['101']);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('rejects on a non-ok response mentioning the status', async () => {
    vi.mocked(mockFetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as never);
    await expect(fetchVersionsStatusBreakdown(BASE, 't', ['101'])).rejects.toThrow('500');
  });

  it('resolves {} for an empty id array with no fetch', async () => {
    expect(await fetchVersionsStatusBreakdown(BASE, 't', [])).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('agrees with fetchVersionIssueCounts on a shared fixture', async () => {
    const fixture = [
      issue('done', ['101']),
      issue('done', ['101']),
      issue('new', ['101']),
      issue('indeterminate', ['101']),
    ];
    vi.mocked(mockFetch).mockImplementation((async (url: string) => {
      if (url.includes('maxResults=0')) {
        const done = decodeURIComponent(url).includes('statusCategory = Done');
        return ok({ total: done ? 2 : fixture.length });
      }
      return ok({ total: fixture.length, issues: fixture });
    }) as never);
    const b = (await fetchVersionsStatusBreakdown(BASE, 't', ['101']))['101'];
    const c = await fetchVersionIssueCounts(BASE, 't', '101');
    expect(b.done).toBe(c.issuesFixed);
    expect(b.done + b.indeterminate + b.new).toBe(c.issuesTotal);
  });
});
