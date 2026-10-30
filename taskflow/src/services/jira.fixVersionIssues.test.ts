import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../lib/apiFetch';
import { fetchFixVersionIssues } from './jira';

describe('fetchFixVersionIssues URL contract', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ issues: [], total: 0 }),
    } as unknown as Response);
  });

  async function requestUrl(): Promise<URL> {
    await fetchFixVersionIssues('https://jira.example.test/', 'tok', '12345', 'customfield_99999');
    return new URL(vi.mocked(apiFetch).mock.calls[0][1] as string);
  }

  it('requests previous fields plus created and resolutiondate', async () => {
    const fields = (await requestUrl()).searchParams.get('fields')?.split(',') ?? [];
    for (const f of [
      'summary',
      'status',
      'assignee',
      'issuetype',
      'customfield_10016',
      'customfield_10028',
      'customfield_99999',
      'customfield_15725',
      'fixVersions',
      'project',
      'created',
      'resolutiondate',
    ]) {
      expect(fields).toContain(f);
    }
  });

  it('keeps the JQL and ordering byte-identical', async () => {
    expect((await requestUrl()).searchParams.get('jql')).toBe(
      'fixVersion = 12345 ORDER BY created ASC, key ASC',
    );
  });

  it('rejects a non-numeric version id', async () => {
    await expect(
      fetchFixVersionIssues('https://jira.example.test', 'tok', '1 OR 1=1', 'cf'),
    ).rejects.toThrow(/Invalid versionId/);
  });
});
