import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { makeEditor } from '../test-utils';
import { peopleQueryKey, searchPeople } from './search';

const fetchAssignableUsers = vi.fn();
const readSecret = vi.fn();
vi.mock('@/services/jira/users', () => ({
  fetchAssignableUsers: (...a: unknown[]) => fetchAssignableUsers(...a),
}));
vi.mock('@/services/stronghold', () => ({
  readSecret: (...a: unknown[]) => readSecret(...a),
}));

const BASE = 'https://jira.example.invalid';

beforeEach(() => {
  fetchAssignableUsers.mockReset();
  readSecret.mockReset();
  readSecret.mockResolvedValue('tok-secret');
  fetchAssignableUsers.mockResolvedValue([{ name: 'jdoe', displayName: 'Jane Doe' }]);
  useAuthStore.setState({ jiraBaseUrl: BASE });
});

describe('peopleQueryKey', () => {
  it('mirrors the useAssignableUserSearch key and never holds the token', () => {
    const key = peopleQueryKey({ issueKey: 'DEMO-1', projectKey: 'DEMO' }, BASE, 'ja');
    expect(key).toEqual(['jira-assignable-users', 'DEMO-1', BASE, 'ja']);
    expect(JSON.stringify(key)).not.toContain('tok-secret');
  });

  it('falls back to the project key then empty', () => {
    expect(peopleQueryKey({ projectKey: 'DEMO' }, BASE, 'x')[1]).toBe('DEMO');
    expect(peopleQueryKey({}, BASE, 'x')[1]).toBe('');
  });
});

describe('searchPeople', () => {
  it('fetches once per distinct query and serves repeats from cache', async () => {
    const { editor } = makeEditor('');
    editor.storage.wikiHost.set({ projectKey: 'DEMO', issueKey: 'DEMO-1' }, new QueryClient());
    const first = await searchPeople(editor, 'ja');
    await searchPeople(editor, 'ja');
    expect(first).toHaveLength(1);
    expect(fetchAssignableUsers).toHaveBeenCalledTimes(1);
    expect(fetchAssignableUsers).toHaveBeenCalledWith(BASE, 'tok-secret', 'DEMO', 'ja', {
      issueKey: 'DEMO-1',
    });
    await searchPeople(editor, 'jo');
    expect(fetchAssignableUsers).toHaveBeenCalledTimes(2);
  });

  it('resolves [] without a query client', async () => {
    const { editor } = makeEditor('');
    expect(await searchPeople(editor, 'ja')).toEqual([]);
    expect(fetchAssignableUsers).not.toHaveBeenCalled();
  });

  it('resolves [] without a token', async () => {
    readSecret.mockResolvedValue(null);
    const { editor } = makeEditor('');
    editor.storage.wikiHost.set({ projectKey: 'DEMO' }, new QueryClient());
    expect(await searchPeople(editor, 'ja')).toEqual([]);
    expect(fetchAssignableUsers).not.toHaveBeenCalled();
  });
});
