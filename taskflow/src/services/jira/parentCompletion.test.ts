import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));
vi.mock('./greenhopper/useGhAllData', () => ({ invalidateGhAllData: vi.fn() }));
vi.mock('./greenhopper/useGhBacklogData', () => ({ invalidateGhBacklogData: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { invalidateGhAllData } from './greenhopper/useGhAllData';
import { invalidateGhBacklogData } from './greenhopper/useGhBacklogData';
import { checkParentCompletion, invalidateAfterTransition } from './parentCompletion';

const mocked = vi.mocked(apiFetch);
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

function parent(
  cat: string,
  subtasks: Array<{ key: string; cat?: string }>,
): Record<string, unknown> {
  return {
    fields: {
      summary: 'Story sum',
      issuetype: { name: 'Story' },
      priority: { name: 'Must' },
      assignee: { displayName: 'Ada L' },
      status: { id: '3', name: 'In Progress', statusCategory: { key: cat } },
      subtasks: subtasks.map((s) => ({
        key: s.key,
        fields: { status: s.cat ? { statusCategory: { key: s.cat } } : {} },
      })),
    },
  };
}

const run = () => checkParentCompletion('https://j.example.com/', 'tok', 'S-1', 'P-1');

describe('checkParentCompletion', () => {
  it('url-encodes the parent key in the request path', async () => {
    mocked.mockResolvedValue(ok(parent('done', [])));
    await checkParentCompletion('https://j.example.com', 'tok', 'S-1', 'P 1/x');
    expect(mocked.mock.calls[0][1]).toContain('/issue/P%201%2Fx?');
  });

  it('does not prompt (and does not search) when a sibling key is malformed', async () => {
    mocked.mockResolvedValue(ok(parent('indeterminate', [{ key: 'bad key") OR (1=1' }])));
    expect(await run()).toEqual({ shouldPrompt: false });
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('searches missing sibling categories in chunks of 50', async () => {
    const subs = Array.from({ length: 120 }, (_, i) => ({ key: `S-${i + 10}` }));
    mocked.mockImplementation(async (_s, url) => {
      if (String(url).includes('/search')) {
        const keys = decodeURIComponent(String(url).split('jql=')[1].split('&')[0])
          .replace(/^key in \(|\)$/g, '')
          .split(',');
        return ok({
          issues: keys.map((key) => ({
            key,
            fields: { status: { statusCategory: { key: 'done' } } },
          })),
        });
      }
      return ok(parent('indeterminate', subs));
    });
    const res = await run();
    expect(res.shouldPrompt).toBe(true);
    expect(mocked).toHaveBeenCalledTimes(1 + 3);
  });

  beforeEach(() => vi.resetAllMocks());

  it('does not prompt when the parent is already done', async () => {
    mocked.mockResolvedValue(ok(parent('done', [{ key: 'S-1', cat: 'done' }])));
    expect(await run()).toEqual({ shouldPrompt: false });
  });

  it('prompts when all other subtasks are done, ignoring the transitioned one', async () => {
    mocked.mockResolvedValue(
      ok(
        parent('indeterminate', [
          { key: 'S-1', cat: 'indeterminate' },
          { key: 'S-2', cat: 'done' },
        ]),
      ),
    );
    expect(await run()).toEqual({
      shouldPrompt: true,
      parentKey: 'P-1',
      parentSummary: 'Story sum',
      parentStatusId: '3',
      parentStatusName: 'In Progress',
      parentStatusCategory: 'indeterminate',
      parentIssueType: 'Story',
      parentPriority: 'Must',
      parentAssignee: 'Ada L',
      subtaskCount: 2,
    });
    expect(mocked.mock.calls[0][1]).toBe(
      'https://j.example.com/rest/api/2/issue/P-1?fields=status,summary,subtasks,issuetype,priority,assignee',
    );
  });

  it('does not prompt when another sibling is open', async () => {
    mocked.mockResolvedValue(
      ok(
        parent('indeterminate', [
          { key: 'S-1', cat: 'done' },
          { key: 'S-2', cat: 'new' },
        ]),
      ),
    );
    expect((await run()).shouldPrompt).toBe(false);
  });

  it('prompts for a single-subtask story', async () => {
    mocked.mockResolvedValue(ok(parent('new', [{ key: 'S-1' }])));
    expect((await run()).shouldPrompt).toBe(true);
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it('falls back to a JQL search when sibling category is missing', async () => {
    mocked
      .mockResolvedValueOnce(ok(parent('new', [{ key: 'S-1' }, { key: 'S-2' }])))
      .mockResolvedValueOnce(
        ok({ issues: [{ key: 'S-2', fields: { status: { statusCategory: { key: 'done' } } } }] }),
      );
    expect((await run()).shouldPrompt).toBe(true);
    const url = mocked.mock.calls[1][1] as string;
    expect(url).toContain('/rest/api/2/search');
    expect(decodeURIComponent(url)).toContain('key in (S-2)');
    expect(url).toContain('fields=status');
  });

  it('fails safe when the fallback lacks categories or errors', async () => {
    mocked
      .mockResolvedValueOnce(ok(parent('new', [{ key: 'S-2' }])))
      .mockResolvedValueOnce(ok({ issues: [] }));
    expect((await run()).shouldPrompt).toBe(false);

    mocked
      .mockResolvedValueOnce(ok(parent('new', [{ key: 'S-2' }])))
      .mockRejectedValueOnce(new Error('boom'));
    expect((await run()).shouldPrompt).toBe(false);

    mocked
      .mockResolvedValueOnce(ok(parent('new', [{ key: 'S-2' }])))
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    expect((await run()).shouldPrompt).toBe(false);
  });

  it('never throws on non-OK or thrown errors', async () => {
    mocked.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    expect((await run()).shouldPrompt).toBe(false);
    mocked.mockRejectedValueOnce(new Error('net'));
    expect((await run()).shouldPrompt).toBe(false);
  });
});

describe('invalidateAfterTransition', () => {
  it('invalidates the documented key list', () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    invalidateAfterTransition(qc, 'P-1', 'https://j', 7);
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual([
      ['jira-issue-detail', 'P-1', 'https://j'],
      ['jira-issue-changelog', 'P-1', 'https://j'],
      ['jira-issue-transitions-fields', 'P-1'],
      ['jira-parent-detail', 'P-1'],
      ['jira-subtask-enrichment'],
      ['jira-epic-stories'],
      ['jira-epics-basic'],
      ['jira-fixversion-issues'],
      ['jira-version-counts'],
      ['jira-issues'],
    ]);
    expect(invalidateGhAllData).toHaveBeenCalledWith(qc, 7);
    expect(invalidateGhBacklogData).toHaveBeenCalledWith(qc, 7);
  });
});
