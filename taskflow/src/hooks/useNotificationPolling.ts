/**
 * useNotificationPolling — React Query polling hook for notifications.
 *
 * Fetches new Jira comment mentions and GitLab MR notes on a configurable interval.
 * On new items: prepends to notifications store, updates cursor, dispatches OS notifications.
 *
 * Must be rendered inside QueryClientProvider (called from AppLayout in main.tsx).
 * Separated from TopBar so TopBar tests don't require a QueryClientProvider wrapper.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  formatOsNotification,
  isOsCatchUp,
  logOsDispatches,
  type OsDispatchLogEntry,
  planOsDispatch,
} from '../lib/notification-dispatch-log';
import type { GitLabMR } from '../services/gitlab';
import { fetchAssignedMRs, fetchAuthoredMRs, fetchReviewerMRs } from '../services/gitlab';
import { validateJira } from '../services/jira';
import { fetchNewNotifications, tryDispatchOsNotification } from '../services/notifications';
import { readSecret } from '../services/stronghold';
import { useAuthStore } from '../stores/auth.store';
import { selectBannerItems, useNotificationBanners } from '../stores/notification-banners.store';
import type { NotificationType } from '../stores/notifications.store';
import { getKnownNotificationIds, useNotificationsStore } from '../stores/notifications.store';
import { useSettingsStore } from '../stores/settings.store';

export function useNotificationPolling() {
  // Use targeted selectors to avoid re-rendering on every store update.
  // Subscribing to the entire store (`useNotificationsStore()`) causes infinite loops
  // because action references change on each state snapshot.
  const prependItems = useNotificationsStore((s) => s.prependItems);
  const setLastSeenJiraCursor = useNotificationsStore((s) => s.setLastSeenJiraCursor);
  const setLastSeenGitlabCursor = useNotificationsStore((s) => s.setLastSeenGitlabCursor);
  const setPermissionDenied = useNotificationsStore((s) => s.setPermissionDenied);
  const setNotificationSendError = useNotificationsStore((s) => s.setNotificationSendError);
  const setFetchError = useNotificationsStore((s) => s.setFetchError);
  const setRetryFetch = useNotificationsStore((s) => s.setRetryFetch);

  // Read-only transient fields — also via targeted selectors
  const lastSeenJiraCursor = useNotificationsStore((s) => s.lastSeenJiraCursor);
  const lastSeenGitlabCursor = useNotificationsStore((s) => s.lastSeenGitlabCursor);
  const storeItems = useNotificationsStore((s) => s.items);

  // Keep a stable ref to store items so the queryFn closure can read them without
  // adding `storeItems` to the queryKey (would invalidate on every notification).
  const storeItemsRef = useRef(storeItems);
  storeItemsRef.current = storeItems;

  // Keep stable refs to cursors for the same reason
  const lastSeenJiraCursorRef = useRef(lastSeenJiraCursor);
  lastSeenJiraCursorRef.current = lastSeenJiraCursor;
  const lastSeenGitlabCursorRef = useRef(lastSeenGitlabCursor);
  lastSeenGitlabCursorRef.current = lastSeenGitlabCursor;
  // True until the first poll starts: its items are the initial load, not new arrivals (banners).
  const isFirstPollRef = useRef(true);

  const {
    notificationPollIntervalSecs,
    desktopNotificationsEnabled,
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
    jiraUserKey,
    jiraUserAvatarUrl,
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

  // Keep a stable ref to typeEnabledMap so the queryFn closure can read current
  // notification type settings without being recreated on every toggle change.
  const typeEnabledMapRef = useRef(typeEnabledMap);
  typeEnabledMapRef.current = typeEnabledMap;

  // Stable ref to the OS notification switch (only gates OS dispatch, never the panel or banners)
  const desktopNotificationsEnabledRef = useRef(desktopNotificationsEnabled);
  desktopNotificationsEnabledRef.current = desktopNotificationsEnabled;

  // Bootstrap identity for existing sessions where identity fields were never persisted.
  // Runs when any of displayName, username, userKey, or avatarUrl is missing — the
  // avatarUrl check backfills sessions authenticated before that field was added.
  useEffect(() => {
    if (!jiraBaseUrl || (jiraUsername && jiraUserDisplayName && jiraUserKey && jiraUserAvatarUrl))
      return;
    (async () => {
      const pat = await readSecret('jira-pat').catch(() => null);
      if (!pat) return;
      const user = await validateJira(jiraBaseUrl, pat).catch(() => null);
      if (user) setJiraUser(user.displayName, user.name, user.key, user.avatarUrls?.['48x48']);
    })();
  }, [jiraBaseUrl, jiraUsername, jiraUserDisplayName, jiraUserKey, jiraUserAvatarUrl, setJiraUser]);

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
        const mrCacheData = queryClient.getQueryData<{ filtered: GitLabMR[]; merged: GitLabMR[] }>([
          'gitlab-mrs',
          gitlabBaseUrl,
          gitlabUserId,
        ]);
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
              queryClient.setQueryData(['gitlab-mrs', gitlabBaseUrl, gitlabUserId], {
                filtered: mrList,
                merged: mrList,
              });
            }
          } catch {
            // MR fetch failed — proceed without GitLab notifications this cycle
            mrList = [];
          }
        }
      }

      // Cursors the poll starts from (null = the 24h backfill) and whether this is the first poll:
      // both decide whether new items deserve an in-app banner.
      const priorCursors = {
        jira: lastSeenJiraCursorRef.current,
        gitlab: lastSeenGitlabCursorRef.current,
      };
      const isFirstPoll = isFirstPollRef.current;

      const allItems = await fetchNewNotifications(jiraBaseUrl, gitlabBaseUrl, tokens, {
        activeJiraProject,
        jiraUserDisplayName,
        jiraUsername,
        gitlabUserId,
        gitlabUsername,
        mrList,
        lastSeenJiraCursor: lastSeenJiraCursorRef.current,
        lastSeenGitlabCursor: lastSeenGitlabCursorRef.current,
      });

      // Only a poll that actually fetched counts as the initial load: after a failed first
      // fetch the next one is still the backlog, not a stream of new arrivals.
      isFirstPollRef.current = false;

      // Filter out items whose notification type toggle is disabled
      const newItems = allItems.filter((item) => {
        const nType: NotificationType | undefined = item.notificationType;
        if (!nType) return true; // items without type are always shown
        return typeEnabledMapRef.current[nType] !== false;
      });

      // Advance per-source cursors independently so one source's failure
      // doesn't skip the other source's unseen notifications.
      const advanceCursors = (items: typeof allItems) => {
        const jiraItems = items.filter((i) => i.source === 'jira');
        const gitlabItems = items.filter((i) => i.source === 'gitlab');
        // Never move a cursor backwards: an edited comment is fetched by `updated` but carries
        // its older `created`, and a regressed cursor re-reads changelog entries already shown.
        if (jiraItems.length > 0) {
          const newestJira = jiraItems.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
          const prior = lastSeenJiraCursorRef.current;
          if (!prior || newestJira.createdAt > prior) setLastSeenJiraCursor(newestJira.createdAt);
        }
        if (gitlabItems.length > 0) {
          const newestGitlab = gitlabItems.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
          const prior = lastSeenGitlabCursorRef.current;
          if (!prior || newestGitlab.createdAt > prior)
            setLastSeenGitlabCursor(newestGitlab.createdAt);
        }
      };

      if (newItems.length > 0) {
        // Capture IDs already in the store BEFORE prepending, so OS notifications are
        // only fired for items that are genuinely new. Without this guard, a stale
        // cursor (e.g. after React Query cache re-use or app restart) can cause the
        // same notification to be re-fetched and re-dispatched even though it is
        // already present in the store.
        const existingIds = getKnownNotificationIds({
          items: storeItemsRef.current,
          dismissedIds: useNotificationsStore.getState().dismissedIds,
        });
        prependItems(newItems);
        const hydrated = useNotificationsStore.persist.hasHydrated();
        // In-app banners: only genuinely new items (not the first poll / a backfill).
        useNotificationBanners.getState().push(
          selectBannerItems(newItems, {
            existingIds,
            priorCursors,
            isFirstPoll,
            hydrated,
          }).map((i) => i.id),
        );
        // Use allItems to advance cursors (avoid cursor drift from filtered items)
        advanceCursors(allItems);
        // Dispatch OS notifications only for items not already known to the store
        const dispatchLog: OsDispatchLogEntry[] = [];
        const ctx = { jiraUsername, jiraDisplayName: jiraUserDisplayName };
        const send = async (title: string, body: string) => {
          const result = await tryDispatchOsNotification(title, body);
          if (result === 'denied') setPermissionDenied(true);
          if (result === 'error') setNotificationSendError(true);
          return result;
        };
        const fresh: typeof newItems = [];
        for (const item of newItems) {
          // Same gate as in-app banners: the launch/backfill poll only catches up, it never
          // pops desktop notifications for items that arrived while the app was closed.
          const outcome = existingIds.has(item.id)
            ? 'skipped'
            : isOsCatchUp(item, { isFirstPoll, hydrated, priorCursors })
              ? 'catch-up'
              : null;
          if (outcome === null) fresh.push(item);
          else if (desktopNotificationsEnabledRef.current) {
            dispatchLog.push({ item, ...formatOsNotification(item, ctx), outcome });
          }
        }
        // Per-type check already passed via filter above
        if (desktopNotificationsEnabledRef.current && fresh.length > 0) {
          const plan = planOsDispatch(fresh, ctx);
          if (plan.kind === 'summary') {
            const outcome = await send(plan.title, plan.body);
            // The log is shown newest-first (reversed), so the summary goes last to sit on top.
            for (const item of plan.items) {
              dispatchLog.push({ item, ...formatOsNotification(item, ctx), outcome: 'grouped' });
            }
            dispatchLog.push({
              kind: 'summary',
              items: plan.items,
              title: plan.title,
              body: plan.body,
              outcome,
            });
          } else {
            for (const { item, title, body } of plan.banners) {
              dispatchLog.push({ item, title, body, outcome: await send(title, body) });
            }
          }
        }
        logOsDispatches(dispatchLog);
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

  // Propagate error state to store so NotificationPopover can display it.
  // Use stable action selectors (not `store.setFetchError`) to avoid infinite loops —
  // subscribing to the whole store causes action refs to change on every store update.
  useEffect(() => {
    setFetchError(queryResult.isError ? (queryResult.error as Error) : null);
  }, [queryResult.isError, queryResult.error, setFetchError]);

  // Expose refetch via store so NotificationPopover can trigger retry.
  // `setRetryFetch` is stable (Zustand selector) so this effect only re-runs when
  // `queryResult.refetch` changes — which is infrequent (only on query key change).
  useEffect(() => {
    setRetryFetch(() => {
      queryResult.refetch();
    });
    return () => {
      setRetryFetch(null);
    };
  }, [queryResult.refetch, setRetryFetch]);
}
