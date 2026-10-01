/**
 * Lazy react-query hooks for the epic progress section (quick 261001-ilq).
 *
 * Auth is read by destructuring (never a selector): several test mocks of the auth
 * store ignore selectors. The story-set signature is part of every key so a story
 * added/moved while the epic is open refetches.
 */
import { useQuery } from '@tanstack/react-query';
import { type EpicWorklogDay, fetchEpicWorklogs } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

/** Per-day worklogs for the epic's stories; enabled only in Time mode by the caller. */
export function useEpicWorklogs(epicKey: string, storyKeys: string[], enabled: boolean) {
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  const sortedKeys = [...storyKeys].sort();
  return useQuery<Map<string, EpicWorklogDay[]>>({
    queryKey: ['jira-epic-worklogs', epicKey, jiraBaseUrl, sortedKeys.join(',')],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchEpicWorklogs(jiraBaseUrl, token, sortedKeys);
    },
    staleTime: 60_000,
    enabled: enabled && !!jiraConnected && !!jiraBaseUrl && sortedKeys.length > 0,
  });
}
