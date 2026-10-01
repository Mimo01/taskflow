/**
 * Lazy react-query hooks for the epic progress section (quick 261001-ilq).
 *
 * Auth is read by destructuring (never a selector): several test mocks of the auth
 * store ignore selectors. The story-set signature is part of every key so a story
 * added/moved while the epic is open refetches.
 */
import { useQuery } from '@tanstack/react-query';
import {
  type EpicStatusHistory,
  type EpicWorklogDay,
  fetchAllJiraStatuses,
  fetchEpicStatusHistory,
  fetchEpicWorklogs,
  type JiraStatus,
} from '@/services/jira';
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

/** Status transitions for the CFD. Lazy: enabled only when the Count/SP chart is shown. */
export function useEpicStatusHistory(epicKey: string, storyKeys: string[], enabled: boolean) {
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  const sortedKeys = [...storyKeys].sort();
  return useQuery<Map<string, EpicStatusHistory>>({
    queryKey: ['jira-epic-status-history', epicKey, jiraBaseUrl, sortedKeys.join(',')],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchEpicStatusHistory(jiraBaseUrl, token, sortedKeys, epicKey);
    },
    staleTime: 60_000,
    enabled: enabled && !!jiraConnected && !!jiraBaseUrl && sortedKeys.length > 0,
  });
}

/**
 * Global status list (status -> category). Shares the `['jira-statuses']` key with the
 * greenhopper cache: identical data shape, session-long cache.
 */
export function useJiraStatusList(enabled: boolean) {
  const { jiraBaseUrl, jiraConnected } = useAuthStore();
  return useQuery<JiraStatus[]>({
    queryKey: ['jira-statuses'],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchAllJiraStatuses(jiraBaseUrl, token);
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    enabled: enabled && !!jiraConnected && !!jiraBaseUrl,
  });
}
