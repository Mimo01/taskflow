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
import { fetchAssignedMRs, fetchAuthoredMRs, fetchReviewerMRs } from '../services/gitlab';
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

      // Get MR list for GitLab notification fetchers.
      // Try cache first (populated by dashboard components), otherwise fetch directly.
      let mrList: GitLabMR[] = [];
      if (gitlabBaseUrl && tokens.gitlab && gitlabUserId) {
        const mrCacheData =
          queryClient.getQueryData<{ filtered: GitLabMR[]; merged: GitLabMR[] }>(['gitlab-mrs', gitlabBaseUrl, gitlabUserId]);
        if (mrCacheData?.merged && mrCacheData.merged.length > 0) {
          mrList = mrCacheData.merged;
        } else {
          // Cache miss — fetch MRs directly so GitLab notifications work
          // even if the user hasn't visited the dashboard yet.
          try {
            const [assigned, authored, reviewer] = await Promise.all([
              fetchAssignedMRs(gitlabBaseUrl, tokens.gitlab),
              fetchAuthoredMRs(gitlabBaseUrl, tokens.gitlab, gitlabUserId),
              fetchReviewerMRs(gitlabBaseUrl, tokens.gitlab, gitlabUserId),
            ]);
            const seen = new Set<number>();
            mrList = [...assigned, ...authored, ...reviewer].filter(
              (mr) => !seen.has(mr.iid) && seen.add(mr.iid),
            );
            // Populate cache so dashboard components can reuse this data
            if (mrList.length > 0) {
              queryClient.setQueryData(
                ['gitlab-mrs', gitlabBaseUrl, gitlabUserId],
                { filtered: mrList, merged: mrList },
              );
            }
          } catch {
            // MR fetch failed — proceed without GitLab notifications this cycle
            mrList = [];
          }
        }
      }

      const allItems = await fetchNewNotifications(jiraBaseUrl, gitlabBaseUrl, tokens, {
        activeJiraProject,
        jiraUserDisplayName,
        jiraUsername,
        gitlabUserId,
        gitlabUsername,
        mrList,
        lastSeenJiraCursor: store.lastSeenJiraCursor,
        lastSeenGitlabCursor: store.lastSeenGitlabCursor,
      });

      // Filter out items whose notification type toggle is disabled
      const newItems = allItems.filter((item) => {
        const nType: NotificationType | undefined = item.notificationType;
        if (!nType) return true; // items without type are always shown
        return typeEnabledMap[nType] !== false;
      });

      // Advance per-source cursors independently so one source's failure
      // doesn't skip the other source's unseen notifications.
      const advanceCursors = (items: typeof allItems) => {
        const jiraItems = items.filter((i) => i.source === 'jira');
        const gitlabItems = items.filter((i) => i.source === 'gitlab');
        if (jiraItems.length > 0) {
          const newestJira = jiraItems.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
          store.setLastSeenJiraCursor(newestJira.createdAt);
        }
        if (gitlabItems.length > 0) {
          const newestGitlab = gitlabItems.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
          store.setLastSeenGitlabCursor(newestGitlab.createdAt);
        }
      };

      if (newItems.length > 0) {
        store.prependItems(newItems);
        // Use allItems to advance cursors (avoid cursor drift from filtered items)
        advanceCursors(allItems);
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
            if (result === 'error') store.setNotificationSendError(true);
          }
        }
      } else if (allItems.length > 0) {
        // Even if all items were filtered, advance cursors so we don't refetch them
        advanceCursors(allItems);
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
