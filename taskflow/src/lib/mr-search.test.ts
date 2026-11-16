import { describe, expect, it } from 'vitest';
import type { GitLabMR } from '@/services/gitlab';
import { searchMRs } from './mr-search';

let nextId = 1;
function mr(over: Partial<GitLabMR> & { title: string }): GitLabMR {
  const id = nextId++;
  return {
    id,
    iid: id,
    project_id: 1,
    source_branch: `branch-${id}`,
    target_branch: 'main',
    state: 'opened',
    draft: false,
    author: { id: 1, name: 'Jane Doe', username: 'jdoe', avatar_url: '' },
    reviewers: [],
    updated_at: '2026-11-01T00:00:00Z',
    web_url: '',
    labels: [],
    milestone: null,
    ...over,
  } as GitLabMR;
}

const titles = (list: GitLabMR[]) => list.map((m) => m.title);

describe('searchMRs', () => {
  const login = mr({ title: 'ABC-12 Fix login redirect loop' });
  const export_ = mr({ title: 'Add CSV export to reports', source_branch: 'feature/csv-export' });
  const refactor = mr({
    title: 'Refactor worklog store',
    author: { id: 2, name: 'Max Power', username: 'mpower', avatar_url: '' },
    labels: [{ name: 'backend', color: '#000', text_color: '#fff' }],
  });
  const all = [login, export_, refactor];

  it('returns the list unchanged for an empty query', () => {
    expect(searchMRs('  ', all)).toBe(all);
  });

  it('matches in the middle of a word, not only at the start', () => {
    expect(titles(searchMRs('direct', all))).toEqual([login.title]);
    expect(titles(searchMRs('xport', all))).toEqual([export_.title]);
  });

  it('matches words in any order', () => {
    expect(titles(searchMRs('redirect login', all))).toEqual([login.title]);
  });

  it('tolerates typos (fuzzy)', () => {
    expect(titles(searchMRs('refactr', all))).toEqual([refactor.title]);
    expect(titles(searchMRs('wrklog', all))).toEqual([refactor.title]);
    expect(titles(searchMRs('rprts', all))).toEqual([export_.title]);
  });

  it('matches branch, author, label and !iid', () => {
    expect(titles(searchMRs('csv-exp', all))).toEqual([export_.title]);
    expect(titles(searchMRs('max', all))).toEqual([refactor.title]);
    expect(titles(searchMRs('backend', all))).toEqual([refactor.title]);
    expect(titles(searchMRs(`!${login.iid}`, all))[0]).toBe(login.title);
  });

  it('ranks exact phrase above scattered matches', () => {
    const a = mr({ title: 'login page tweaks then fix' });
    const b = mr({ title: 'Fix login button' });
    expect(titles(searchMRs('fix login', [a, b]))).toEqual([b.title, a.title]);
  });

  it('keeps server hits (e.g. description match) and dedupes with local', () => {
    const older = mr({ title: 'Something unrelated by title', updated_at: '2026-11-10T00:00:00Z' });
    const out = searchMRs('zebra', all, [older, login]);
    expect(titles(out)).toEqual([older.title, login.title]);
  });
});
