/**
 * useNotificationPolling — React Query polling hook for notifications.
 *
 * Fetches new Jira comment mentions and GitLab MR notes on a configurable interval.
 * On new items: prepends to notifications store, updates cursor, dispatches OS notifications.
 *
 * Must be rendered inside QueryClientProvider (called from AppLayout in main.tsx).
 * Separated from TopBar so TopBar tests don't require a QueryClientProvider wrapper.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotificationsStore } from '../stores/notifications.store';
import { useSettingsStore } from '../stores/settings.store';
import { useAuthStore } from '../stores/auth.store';
import { readSecret } from '../services/stronghold';
import {
  fetchNewNotifications,
  tryDispatchOsNotification,
} from '../services/notifications';
import { validateJira } from '../services/jira';
import type { GitLabMR } from '../services/gitlab';

export function useNotificationPolling() {
  const store = useNotificationsStore();
  const { notificationPollIntervalSecs, osNotifJiraEnabled, osNotifGitlabEnabled } =
    useSettingsStore();
  const {
    jiraBaseUrl,
    gitlabBaseUrl,
    activeJiraProject,
    jiraUserDisplayName,
    jiraUsername,
    gitlabUserId,
    activeGitlabProject,
    setJiraUser,
  } = useAuthStore();

  // Bootstrap identity for existing sessions where jiraUsername was never persisted.
  // Runs once when Jira is connected but identity fields are missing.
  useEffect(() => {
    if (!jiraBaseUrl || jiraUsername || jiraUserDisplayName) return;
    (async () => {
      const pat = await readSecret('jira-pat').catch(() => null);
      if (!pat) return;
      const user = await validateJira(jiraBaseUrl, pat).catch(() => null);
      if (user) setJiraUser(user.displayName, user.name);
    })();
  }, [jiraBaseUrl, jiraUsername, jiraUserDisplayName, setJiraUser]);

  const pollIntervalMs = Math.max(30_000, notificationPollIntervalSecs * 1000);
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: ['notifications', jiraBaseUrl, gitlabBaseUrl, activeJiraProject],
    queryFn: async () => {
      const tokens = {
        jira: jiraBaseUrl ? await readSecret('jira-pat').catch(() => null) : null,
        gitlab: gitlabBaseUrl ? await readSecret('gitlab-pat').catch(() => null) : null,
      };

      // Read cached MR list (same pattern as SprintBoardTab)
      const mrList =
        queryClient.getQueryData<GitLabMR[]>(['gitlab-mrs', gitlabBaseUrl, activeGitlabProject]) ??
        [];

      const newItems = await fetchNewNotifications(jiraBaseUrl, gitlabBaseUrl, tokens, {
        activeJiraProject,
        jiraUserDisplayName,
        jiraUsername,
        gitlabUserId,
        gitlabUsername: null, // Will be wired to auth store in Task 2
        mrList,
        lastSeenCursor: store.lastSeenCursor,
      });

      if (newItems.length > 0) {
        store.prependItems(newItems);
        // Update cursor to newest item
        const newest = newItems.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        store.setLastSeenCursor(newest.createdAt);
        // Dispatch OS notifications for new items
        for (const item of newItems) {
          const sourceEnabled =
            item.source === 'jira' ? osNotifJiraEnabled : osNotifGitlabEnabled;
          if (sourceEnabled) {
            const result = await tryDispatchOsNotification(
              `${item.source === 'jira' ? 'Jira' : 'GitLab'} — ${item.entityTitle}`,
              `${item.author}: ${item.bodyPreview}`,
            );
            if (result === 'denied') store.setPermissionDenied(true);
          }
        }
      }

      return newItems;
    },
    refetchInterval: pollIntervalMs,
    refetchIntervalInBackground: true,
    staleTime: pollIntervalMs - 5_000,
    enabled: !!(jiraBaseUrl || gitlabBaseUrl),
  });

  // Propagate error state to store so NotificationPopover can display it
  useEffect(() => {
    store.setFetchError(queryResult.isError ? (queryResult.error as Error) : null);
  }, [queryResult.isError, queryResult.error]);

  // Expose refetch via store so NotificationPopover can trigger retry
  useEffect(() => {
    store.setRetryFetch(() => { queryResult.refetch(); });
    return () => { store.setRetryFetch(null); };
  }, [queryResult.refetch]);
}
