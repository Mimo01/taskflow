import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchVersionsStatusBreakdown } from './jira';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
import { fetch as mockFetch } from '@tauri-apps/plugin-http';

const BASE = 'https://jira.example.com';
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as never;
type Person = { name?: string; displayName: string; avatarUrls?: { '48x48'?: string } } | null;
const issue = (cat: string | undefined, ids: string[], assignee?: Person) => ({
  fields: {
    status: cat ? { statusCategory: { key: cat } } : {},
    fixVersions: ids.map((id) => ({ id })),
    ...(assignee === undefined ? {} : { assignee }),
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
    expect(r['101']).toEqual({ new: 1, indeterminate: 0, done: 1, assignees: [] });
    expect(r['102']).toEqual({ new: 0, indeterminate: 1, done: 0, assignees: [] });
  });

  it('builds the expected request', async () => {
    vi.mocked(mockFetch).mockResolvedValue(ok({ total: 0, issues: [] }));
    await fetchVersionsStatusBreakdown(BASE, 't', ['101', '102']);
    const u = urlOf(0);
    expect(jqlOf(u)).toBe('fixVersion in (101,102)');
    expect(u).toContain('fields=status,fixVersions,assignee');
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
    expect(r['101']).toEqual({ new: 2, indeterminate: 0, done: 0, assignees: [] });
    expect(r['103']).toEqual({ new: 0, indeterminate: 0, done: 0, assignees: [] });
  });

  describe('assignees', () => {
    const alex = {
      name: 'alex',
      displayName: 'Alex Placeholder',
      avatarUrls: { '48x48': 'a.png' },
    };
    const sam = { name: 'sam', displayName: 'Sam Example' };

    it('dedupes by name, counts issues, sorts by count desc then name', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        ok({
          total: 4,
          issues: [
            issue('done', ['101'], sam),
            issue('new', ['101'], alex),
            issue('new', ['101'], alex),
            issue('new', ['101'], { displayName: 'Zed Nameless' }),
          ],
        }),
      );
      const r = await fetchVersionsStatusBreakdown(BASE, 't', ['101']);
      expect(r['101'].assignees).toEqual([
        { key: 'alex', displayName: 'Alex Placeholder', avatarUrl: 'a.png', count: 2 },
        { key: 'sam', displayName: 'Sam Example', avatarUrl: undefined, count: 1 },
        { key: 'Zed Nameless', displayName: 'Zed Nameless', avatarUrl: undefined, count: 1 },
      ]);
    });

    it('breaks count ties by display name ascending', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        ok({ total: 2, issues: [issue('new', ['101'], sam), issue('new', ['101'], alex)] }),
      );
      const r = await fetchVersionsStatusBreakdown(BASE, 't', ['101']);
      expect(r['101'].assignees.map((a) => a.key)).toEqual(['alex', 'sam']);
    });

    it('adds the assignee to every requested version of a multi-version issue', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        ok({ total: 1, issues: [issue('done', ['101', '102'], alex)] }),
      );
      const r = await fetchVersionsStatusBreakdown(BASE, 't', ['101', '102']);
      expect(r['101'].assignees).toHaveLength(1);
      expect(r['102'].assignees).toHaveLength(1);
    });

    it('unassigned issues count toward status but add no assignee', async () => {
      vi.mocked(mockFetch).mockResolvedValue(
        ok({ total: 2, issues: [issue('done', ['101'], null), issue('new', ['101'])] }),
      );
      const r = await fetchVersionsStatusBreakdown(BASE, 't', ['101']);
      expect(r['101']).toEqual({ new: 1, indeterminate: 0, done: 1, assignees: [] });
    });
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
});
