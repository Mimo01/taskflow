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
import type { NotificationType } from '../stores/notifications.store';
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
  const {
    notificationPollIntervalSecs,
    osNotifJiraEnabled,
    osNotifGitlabEnabled,
    notifCommentMentionEnabled,
    notifIssueUpdateEnabled,
    notifMrNoteEnabled,
    notifGitlabMentionEnabled,
    notifJiraCommentEnabled,
    notifMrApprovalEnabled,
    notifPipelineFailureEnabled,
    notifIssueAssignmentEnabled,
    notifDueDateReminderEnabled,
  } = useSettingsStore();
  const {
    jiraBaseUrl,
    gitlabBaseUrl,
    activeJiraProject,
    jiraUserDisplayName,
    jiraUsername,
    gitlabUserId,
    gitlabUsername,
    setJiraUser,
  } = useAuthStore();

  // Build per-type enabled lookup map
  const typeEnabledMap: Record<string, boolean> = {
    'comment-mention': notifCommentMentionEnabled,
    'issue-update': notifIssueUpdateEnabled,
    'mr-note': notifMrNoteEnabled,
    'gitlab-mention': notifGitlabMentionEnabled,
    'jira-comment': notifJiraCommentEnabled,
    'mr-approval': notifMrApprovalEnabled,
    'pipeline-failure': notifPipelineFailureEnabled,
    'issue-assignment': notifIssueAssignmentEnabled,
    'due-date-reminder': notifDueDateReminderEnabled,
  };

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

      // Read cached MR list — the MR query (MrHealthPanel / MyTasksTab / MrAttentionTab)
      // stores { filtered, merged } so we must read the correct shape and extract the array.
      const mrCacheData =
        queryClient.getQueryData<{ filtered: GitLabMR[]; merged: GitLabMR[] }>(['gitlab-mrs', gitlabBaseUrl, gitlabUserId]);
      const mrList: GitLabMR[] = mrCacheData?.merged ?? [];

      const allItems = await fetchNewNotifications(jiraBaseUrl, gitlabBaseUrl, tokens, {
        activeJiraProject,
        jiraUserDisplayName,
        jiraUsername,
        gitlabUserId,
        gitlabUsername,
        mrList,
        lastSeenCursor: store.lastSeenCursor,
      });

      // Filter out items whose notification type toggle is disabled
      const newItems = allItems.filter((item) => {
        const nType: NotificationType | undefined = item.notificationType;
        if (!nType) return true; // items without type are always shown
        return typeEnabledMap[nType] !== false;
      });

      if (newItems.length > 0) {
        store.prependItems(newItems);
        // Update cursor to newest item (use allItems to avoid cursor drift from filtered items)
        const newest = allItems.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        store.setLastSeenCursor(newest.createdAt);
        // Dispatch OS notifications for new items
        for (const item of newItems) {
          const sourceEnabled =
            item.source === 'jira' ? osNotifJiraEnabled : osNotifGitlabEnabled;
          // Per-type check already passed via filter above
          if (sourceEnabled) {
            const result = await tryDispatchOsNotification(
              `${item.source === 'jira' ? 'Jira' : 'GitLab'} — ${item.entityTitle}`,
              `${item.author}: ${item.bodyPreview}`,
            );
            if (result === 'denied') store.setPermissionDenied(true);
          }
        }
      } else if (allItems.length > 0) {
        // Even if all items were filtered, advance cursor so we don't refetch them
        const newest = allItems.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        store.setLastSeenCursor(newest.createdAt);
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
