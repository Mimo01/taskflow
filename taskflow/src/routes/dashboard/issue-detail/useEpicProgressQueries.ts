/**
 * Lazy react-query hooks for the epic progress section (quick 261001-ilq).
 *
 * Auth is read by destructuring (never a selector): several test mocks of the auth
 * store ignore selectors. The story-set signature is part of every key so a story
 * added/moved while the epic is open refetches.
 */
import { useQuery } from '@tanstack/react-query';
import { addCalendarDays, buildWorkCalendar, type WorkCalendar } from '@/lib/epic-progress';
import {
  type EpicStatusHistory,
  type EpicWorklogDay,
  fetchAllJiraStatuses,
  fetchEpicStatusHistory,
  fetchEpicWorklogs,
  type JiraStatus,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { fetchUserSchedule } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Per-day worklogs for the epic's stories. The caller enables it in every mode (the
 * averaged Finish needs the Time forecast); it loads after first paint.
 */
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
    // Changelog expansion is the heaviest call here; history changes slowly.
    staleTime: 5 * 60_000,
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

const CALENDAR_LOOKBACK_DAYS = 120;
const CALENDAR_HORIZON_DAYS = 365;
const CALENDAR_STALE_MS = 24 * 60 * 60_000;
const CALENDAR_EMPTY_STALE_MS = 5 * 60_000;

/**
 * Working calendar for the forecasts: Mon-Fri minus Tempo HOLIDAY / NON_WORKING_DAY days
 * for the current user. Only fetched when Tempo is enabled; any failure falls back silently
 * to plain Mon-Fri. Own query key (does not collide with the worklogs page schedule key).
 */
export function useEpicWorkCalendar(today: string): {
  calendar: WorkCalendar;
  holidaysAvailable: boolean;
} {
  const { jiraBaseUrl, jiraConnected, jiraUserKey } = useAuthStore();
  const { tempoEnabled } = useSettingsStore();
  const from = addCalendarDays(today, -CALENDAR_LOOKBACK_DAYS);
  const to = addCalendarDays(today, CALENDAR_HORIZON_DAYS);
  const query = useQuery({
    queryKey: ['tempo', 'schedule', 'epic-forecast', jiraBaseUrl, from, to, jiraUserKey ?? ''],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !jiraUserKey) throw new Error('No credentials');
      return fetchUserSchedule(jiraBaseUrl, token, from, to, jiraUserKey);
    },
    // fetchUserSchedule returns an empty map on a Tempo error; don't pin that "no holidays" result for a day.
    staleTime: (q) => ((q.state.data?.size ?? 0) > 0 ? CALENDAR_STALE_MS : CALENDAR_EMPTY_STALE_MS),
    refetchOnWindowFocus: false,
    enabled: tempoEnabled === true && !!jiraConnected && !!jiraBaseUrl && !!jiraUserKey,
  });
  const calendar = buildWorkCalendar(query.data);
  return { calendar, holidaysAvailable: calendar.source === 'tempo' };
}
