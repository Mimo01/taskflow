import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRmPackage, fetchRmWeekChildren, fetchRmWeekList } from './jira';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));
import { fetch as mockFetch } from '@tauri-apps/plugin-http';

const TOKEN = 'tok';
let n = 0;
// Distinct base URL per test: link-field discovery is cached per base URL.
const nextBase = () => `https://jira-${++n}.example.com`;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as never;
const bad = (status = 400) => ({ ok: false, status, json: async () => ({}) }) as never;
const FIELDS = [
  {
    id: 'customfield_10014',
    name: 'Epic Link',
    schema: { custom: 'com.pyxis.greenhopper.jira:gh-epic-link' },
  },
  {
    id: 'customfield_10500',
    name: 'Parent Link',
    schema: { custom: 'com.atlassian.jpo:jpo-custom-field-parent' },
  },
];
const jqlOf = (url: string) => decodeURIComponent(new URL(url).searchParams.get('jql') ?? '');

describe('Release Management lookups', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetchRmWeekList: prefix search, summary only, non-padded dates parsed', async () => {
    const base = nextBase();
    vi.mocked(mockFetch).mockResolvedValue(
      ok({
        total: 2,
        issues: [
          { key: 'RM-1', fields: { summary: 'WEEK45 (2.11.2026 - 8.11.2026) STANDARD' } },
          { key: 'RM-9', fields: { summary: 'not a week' } },
        ],
      }),
    );
    const weeks = await fetchRmWeekList(base, TOKEN, 'RM');
    expect(weeks).toHaveLength(1);
    expect(weeks[0]).toMatchObject({
      key: 'RM-1',
      start: '2026-11-02',
      end: '2026-11-08',
      children: [],
    });
    const url = vi.mocked(mockFetch).mock.calls[0][0] as string;
    expect(jqlOf(url)).toContain('summary ~ "WEEK*"');
    expect(new URL(url).searchParams.get('fields')).toBe('summary');
  });

  it('fetchRmWeekList: falls back to a plain scan when the prefix search fails', async () => {
    const base = nextBase();
    vi.mocked(mockFetch)
      .mockResolvedValueOnce(bad())
      .mockResolvedValueOnce(
        ok({
          total: 1,
          issues: [{ key: 'RM-1', fields: { summary: 'WEEK1 (1.1.2026 - 7.1.2026)' } }],
        }),
      );
    const weeks = await fetchRmWeekList(base, TOKEN, 'RM');
    expect(weeks.map((w) => w.key)).toEqual(['RM-1']);
    expect(jqlOf(vi.mocked(mockFetch).mock.calls[1][0] as string)).not.toContain('WEEK*');
  });

  it('fetchRmWeekChildren: ORs parent, discovered link fields and linked issues; skips the week itself', async () => {
    const base = nextBase();
    vi.mocked(mockFetch).mockImplementation((async (url: string) => {
      if (url.includes('/rest/api/2/field')) return ok(FIELDS);
      return ok({
        total: 3,
        issues: [
          { key: 'RM-11', fields: { summary: 'Core' } },
          { key: 'RM-1', fields: { summary: 'the week' } },
          { key: 'RM-11', fields: { summary: 'Core' } },
        ],
      });
    }) as never);
    const kids = await fetchRmWeekChildren(base, TOKEN, 'RM-1');
    expect(kids).toEqual([{ key: 'RM-11', summary: 'Core' }]);
    const searchUrl = vi
      .mocked(mockFetch)
      .mock.calls.map((c) => c[0] as string)
      .find((u) => u.includes('/search')) as string;
    const jql = jqlOf(searchUrl);
    expect(jql).toContain('parent = "RM-1"');
    expect(jql).toContain('cf[10500] = "RM-1"');
    expect(jql).toContain('cf[10014] = "RM-1"');
    expect(jql).toContain('issue in linkedIssues("RM-1")');
  });

  it('fetchRmWeekChildren: runs clauses separately when the combined query is rejected', async () => {
    const base = nextBase();
    vi.mocked(mockFetch).mockImplementation((async (url: string) => {
      if (url.includes('/rest/api/2/field')) return ok(FIELDS);
      const jql = jqlOf(url);
      if (jql.includes(' OR ')) return bad();
      if (jql.startsWith('cf[10500]')) {
        return ok({ total: 1, issues: [{ key: 'RM-12', fields: { summary: 'Shop' } }] });
      }
      return ok({ total: 0, issues: [] });
    }) as never);
    expect(await fetchRmWeekChildren(base, TOKEN, 'RM-1')).toEqual([
      { key: 'RM-12', summary: 'Shop' },
    ]);
  });

  it('fetchRmPackage: resolves the WEEK parent through a Parent Link string key', async () => {
    const base = nextBase();
    vi.mocked(mockFetch).mockImplementation((async (url: string) => {
      if (url.includes('/rest/api/2/field')) return ok(FIELDS);
      if (url.includes('/issue/RM-11')) {
        return ok({ key: 'RM-11', fields: { summary: 'Core', customfield_10500: 'RM-1' } });
      }
      if (url.includes('/issue/RM-1?')) {
        return ok({ key: 'RM-1', fields: { summary: 'WEEK43 (19.10.2026 - 25.10.2026) X' } });
      }
      return bad(404);
    }) as never);
    const r = await fetchRmPackage(base, TOKEN, 'RM-11');
    expect(r.child).toEqual({ key: 'RM-11', summary: 'Core' });
    expect(r.week).toMatchObject({ key: 'RM-1', weekNo: 43, start: '2026-10-19' });
    expect(r.week?.children).toEqual([{ key: 'RM-11', summary: 'Core' }]);
  });

  it('fetchRmPackage: week is null when no parent parses as a WEEK', async () => {
    const base = nextBase();
    vi.mocked(mockFetch).mockImplementation((async (url: string) => {
      if (url.includes('/rest/api/2/field')) return ok(FIELDS);
      return ok({ key: 'RM-11', fields: { summary: 'Core' } });
    }) as never);
    expect((await fetchRmPackage(base, TOKEN, 'RM-11')).week).toBeNull();
  });
});
