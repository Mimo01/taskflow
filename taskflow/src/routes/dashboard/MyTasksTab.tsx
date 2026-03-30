/**
 * MyTasksTab — Jira sprint issues assigned to the current user.
 *
 * Polls every 60s via TanStack Query. Shows loading skeleton, error message,
 * and last-refreshed timestamp + manual refresh button in top-right.
 *
 * Link computation (Plan 03):
 * - Builds task→MR map using linkMRToTask (title scan) for each GitLab MR
 * - Falls back to commit scan via linkMRToTaskViaCommits for unmatched MRs
 * - Fetches MR approvals + discussions to derive ReviewHealth per linked MR
 * - Passes linkedMrResults: Array<{mr, health}> to each TaskRow
 *
 * Write actions (Plan 06):
 * - transitionMutation: optimistic status update via postTransition
 * - commentMutation: post comment via postComment, collapses InlineComment on success
 */

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useIsActiveRoute } from '@/hooks/useIsActiveRoute';
import { useListNavigation } from '@/hooks/useListNavigation';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '@/lib/query-constants';
import { cn } from '@/lib/utils';
import type { GitLabMR } from '@/services/gitlab';
import {
  fetchAssignedMRs,
  fetchMRApprovals,
  fetchMRCommits,
  fetchMRDiscussions,
  fetchProjectMRs,
  fetchReviewerMRs,
} from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { fetchMyTasksHierarchy, postComment, postTransition } from '@/services/jira';
import type { ReviewHealth } from '@/services/linkEngine';
import { deriveReviewHealth, linkMRToTask, linkMRToTaskViaCommits } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import TaskRow from './TaskRow';
import { MyTasksSkeleton } from './MyTasksSkeleton';

export default function MyTasksTab() {
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, activeGitlabProject, gitlabUserId } =
    useAuthStore();
  const { storyPointsFieldKey } = useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => {
          setJiraToken(t);
        })
        .catch(() => {
          setJiraToken(null);
        });
    }
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => {
          setGitlabToken(t);
        })
        .catch(() => {
          setGitlabToken(null);
        });
    }
  }, [gitlabBaseUrl]);

  // Use persisted GitLab user ID from auth store — avoids a validateGitLab round-trip
  // on every mount. The ID is stored during onboarding (GitLabStep) and token update
  // (TokenSection), matching the same approach used in MrAttentionTab.
  const userId = gitlabUserId ?? undefined;

  const isActive = useIsActiveRoute('/my-tasks');

  // Fetch sprint issues: my stories + stories with my subtasks + all their subtasks.
  // Include storyPointsFieldKey in cache key: when discovery changes the key, the query
  // re-fires with the updated fields list so the response actually contains the value.
  const {
    data: taskData,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchMyTasksHierarchy(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });
  const data = taskData?.issues;
  const myIssueKeys = taskData?.myIssueKeys ?? new Set<string>();

  // Fetch GitLab MRs — query key matches MrAttentionTab/MrHealthPanel so all three share TanStack cache.
  // Returns { filtered, merged } shape to stay compatible with the shared cache contract.
  const { data: gitlabMrsData } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl, userId],
    queryFn: async () => {
      const token = gitlabToken ?? '';
      const [assigned, reviewer, projectMrs] = await Promise.all([
        fetchAssignedMRs(gitlabBaseUrl!, token),
        userId ? fetchReviewerMRs(gitlabBaseUrl!, token, userId) : Promise.resolve([]),
        activeGitlabProject
          ? fetchProjectMRs(gitlabBaseUrl!, token, activeGitlabProject)
          : Promise.resolve([]),
      ]);
      const seen = new Set<number>();
      const merged = [
        ...assigned,
        ...reviewer,
        ...(Array.isArray(projectMrs) ? projectMrs : []),
      ].filter((mr) => !seen.has(mr.iid) && seen.add(mr.iid));
      return { filtered: merged, merged };
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!gitlabBaseUrl && !!gitlabToken && !!userId,
  });
  // Normalise: cache may hold { filtered, merged } (from MrAttentionTab/MrHealthPanel) or
  // a legacy raw GitLabMR[] from an older version of this queryFn. Always produce GitLabMR[].
  const gitlabMrs: GitLabMR[] = Array.isArray(gitlabMrsData)
    ? gitlabMrsData
    : ((gitlabMrsData as { merged?: GitLabMR[] } | undefined)?.merged ?? []);

  const sprintIssueKeySet = new Set((Array.isArray(data) ? data : []).map((i) => i.key));

  // Title-scan linking: synchronous, no API calls
  const titleLinkMap = new Map<number, string | null>();
  for (const mr of gitlabMrs ?? []) {
    titleLinkMap.set(mr.iid, linkMRToTask(mr, sprintIssueKeySet));
  }

  // MRs that need commit fallback scan (title scan returned null)
  const mrsNeedingCommits = (gitlabMrs ?? []).filter((mr) => titleLinkMap.get(mr.iid) === null);

  // Fetch commits for MRs that didn't link via title (LINK-02 fallback)
  const commitQueries = useQueries({
    queries: mrsNeedingCommits.map((mr) => ({
      queryKey: ['mr-commits', mr.project_id, mr.iid],
      queryFn: () => fetchMRCommits(gitlabBaseUrl!, gitlabToken ?? '', mr.project_id, mr.iid),
      staleTime: 60_000,
      enabled: !!gitlabBaseUrl && !!gitlabToken,
    })),
  });

  // Build combined link map (title + commit fallback)
  const fullLinkMap = new Map<string, GitLabMR[]>(); // issueKey → linked MRs
  for (const mr of gitlabMrs ?? []) {
    const titleResult = titleLinkMap.get(mr.iid);
    if (titleResult !== null && titleResult !== undefined) {
      const existing = fullLinkMap.get(titleResult) ?? [];
      fullLinkMap.set(titleResult, [...existing, mr]);
      continue;
    }

    // Try commit fallback for this MR
    const mrIndex = mrsNeedingCommits.findIndex((m) => m.iid === mr.iid);
    if (mrIndex >= 0) {
      const commitQuery = commitQueries[mrIndex];
      if (commitQuery?.data) {
        const commitResult = linkMRToTaskViaCommits(mr, sprintIssueKeySet, commitQuery.data);
        if (commitResult !== null) {
          const existing = fullLinkMap.get(commitResult) ?? [];
          fullLinkMap.set(commitResult, [...existing, mr]);
        }
      }
    }
  }

  // Collect all linked MRs for health fetching
  const linkedMrsList: GitLabMR[] = [];
  for (const mrs of fullLinkMap.values()) {
    for (const mr of mrs) {
      if (!linkedMrsList.some((m) => m.iid === mr.iid)) {
        linkedMrsList.push(mr);
      }
    }
  }

  // Fetch health (approvals + discussions) for each linked MR
  const healthQueries = useQueries({
    queries: linkedMrsList.map((mr) => ({
      queryKey: ['mr-health', mr.project_id, mr.iid],
      queryFn: async (): Promise<ReviewHealth> => {
        const token = gitlabToken ?? '';
        const [approvals, discussions] = await Promise.all([
          fetchMRApprovals(gitlabBaseUrl!, token, mr.project_id, mr.iid),
          fetchMRDiscussions(gitlabBaseUrl!, token, mr.project_id, mr.iid),
        ]);
        return deriveReviewHealth(approvals, discussions);
      },
      staleTime: 30_000,
      enabled: !!gitlabBaseUrl && !!gitlabToken,
    })),
  });

  // Build health map: mr.iid → ReviewHealth
  const healthMap = new Map<number, ReviewHealth>();
  for (let i = 0; i < linkedMrsList.length; i++) {
    const health = healthQueries[i]?.data;
    if (health) {
      healthMap.set(linkedMrsList[i].iid, health);
    }
  }

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const showSkeleton = useDelayedLoading(isLoading) || isRefreshing;

  useEffect(() => {
    if (!isLoading) setIsRefreshing(false);
  }, [isLoading]);

  // Banner dismissed state for stale data banner
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  // Per-row inline errors: keyed by `${issueKey}-transition` or `${issueKey}-comment`
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});
  const { onIssueClick: setSelectedIssueKey } = useOutletContext<{
    onIssueClick: (key: string) => void;
  }>();

  // Transition mutation with optimistic update
  const transitionMutation = useMutation({
    mutationFn: ({
      issueKey,
      transitionId,
    }: {
      issueKey: string;
      transitionId: string;
      toStatusName: string;
    }) => postTransition(jiraBaseUrl!, jiraToken ?? '', issueKey, transitionId),
    onMutate: async ({ issueKey, toStatusName }) => {
      await queryClient.cancelQueries({
        queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
      });
      const prev = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>([
        'jira-issues',
        'my-tasks',
        activeJiraProject,
        storyPointsFieldKey,
      ]);
      queryClient.setQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
        ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            issues: old.issues.map((i) =>
              i.key === issueKey
                ? {
                    ...i,
                    fields: { ...i.fields, status: { ...i.fields.status, name: toStatusName } },
                  }
                : i,
            ),
          };
        },
      );
      return { prev };
    },
    onError: (_err, { issueKey }, ctx) => {
      queryClient.setQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
        ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
        ctx?.prev,
      );
      setInlineErrors((prev) => ({
        ...prev,
        [`${issueKey}-transition`]: 'Failed to update — try again',
      }));
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
      }),
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: ({ issueKey, comment }: { issueKey: string; comment: string }) =>
      postComment(jiraBaseUrl!, jiraToken ?? '', issueKey, comment),
    onSuccess: () => {
      // TaskRow closes comment optimistically on submit
    },
    onError: (_err, { issueKey }) => {
      setInlineErrors((prev) => ({
        ...prev,
        [`${issueKey}-comment`]: 'Failed to add comment — try again',
      }));
    },
  });

  // Group flat issue list into parent→subtasks hierarchy
  const groupedDataIssues = data ?? [];
  const groupedDataParents = groupedDataIssues.filter((i) => !i.fields.issuetype.subtask);
  const groupedDataSubtasks = groupedDataIssues.filter((i) => i.fields.issuetype.subtask);
  const groupedDataParentKeySet = new Set(groupedDataParents.map((p) => p.key));
  const groupedDataSubtasksByParent = new Map<string, JiraIssue[]>();
  const groupedDataOrphans: JiraIssue[] = [];
  for (const s of groupedDataSubtasks) {
    const parentKey = s.fields.parent?.key;
    if (parentKey && groupedDataParentKeySet.has(parentKey)) {
      const existing = groupedDataSubtasksByParent.get(parentKey) ?? [];
      groupedDataSubtasksByParent.set(parentKey, [...existing, s]);
    } else {
      groupedDataOrphans.push(s);
    }
  }
  const groupedData = {
    groups: groupedDataParents.map((p) => ({ parent: p, subtasks: groupedDataSubtasksByParent.get(p.key) ?? [] })),
    orphans: groupedDataOrphans,
  };

  // J/K navigation
  const flatIssueKeys: string[] = [];
  for (const { parent, subtasks: children } of groupedData.groups) {
    flatIssueKeys.push(parent.key);
    for (const child of children) {
      flatIssueKeys.push(child.key);
    }
  }
  for (const orphan of groupedData.orphans) {
    flatIssueKeys.push(orphan.key);
  }

  const { focusIndex } = useListNavigation({
    itemCount: flatIssueKeys.length,
    onSelect: (index) => setSelectedIssueKey(flatIssueKeys[index]),
    enabled: !showSkeleton && flatIssueKeys.length > 0,
  });

  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < flatIssueKeys.length) {
      const key = flatIssueKeys[focusIndex];
      const el = rowRefs.current.get(key);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusIndex, flatIssueKeys]);

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  return (
    <div className="flex flex-col gap-2 p-4">
      {/* Header row with last-refreshed and refresh button */}
      <div className="flex items-center justify-end gap-2 pb-2">
        <span className="text-xs text-muted-foreground">{lastRefreshed}</span>
        <button
          type="button"
          onClick={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {showSkeleton && <MyTasksSkeleton />}

      {/* Error state — no cached data */}
      {isError && !data && (
        <ErrorState
          error={error}
          onRetry={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });
          }}
          viewName="tasks"
        />
      )}

      {/* Stale data banner — error with cached data */}
      {isError && data && !bannerDismissed && (
        <StaleDataBanner
          onRetry={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks'] });
          }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Empty state */}
      {!showSkeleton && !isError && data && data.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="You're all caught up!"
          subtitle="No tasks assigned to you in the active sprint"
        />
      )}

      {/* Task list — grouped by parent→subtasks */}
      {!showSkeleton && !isError && data && data.length > 0 && (
        <div className="flex flex-col">
          {groupedData.groups.map(({ parent, subtasks: children }) => {
            const renderRow = (issue: JiraIssue, isSubtask: boolean) => {
              const linkedMrs = fullLinkMap.get(issue.key) ?? [];
              const linkedMrResults = linkedMrs.map((mr) => ({
                mr,
                health: healthMap.get(mr.iid) ?? ('waiting_for_review' as ReviewHealth),
              }));
              const isFocused = flatIssueKeys[focusIndex] === issue.key;
              return (
                <div
                  key={issue.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(issue.key, el);
                    else rowRefs.current.delete(issue.key);
                  }}
                  className={cn(isFocused && 'bg-muted border-l-2 border-primary')}
                  aria-current={isFocused ? 'true' : undefined}
                >
                  <TaskRow
                    issue={issue}
                    isSubtask={isSubtask}
                    notMine={isSubtask && !myIssueKeys.has(issue.key)}
                    linkedMrResults={linkedMrResults}
                    jiraBaseUrl={jiraBaseUrl ?? ''}
                    jiraToken={jiraToken ?? ''}
                    onIssueClick={(key) => setSelectedIssueKey(key)}
                    onTransitionSelect={(issueKey, transitionId, toStatusName) => {
                      setInlineErrors((prev) => {
                        const next = { ...prev };
                        delete next[`${issueKey}-transition`];
                        return next;
                      });
                      transitionMutation.mutate({ issueKey, transitionId, toStatusName });
                    }}
                    onCommentSubmit={(issueKey, comment) => {
                      setInlineErrors((prev) => {
                        const next = { ...prev };
                        delete next[`${issueKey}-comment`];
                        return next;
                      });
                      commentMutation.mutate({ issueKey, comment });
                    }}
                    isTransitionPending={
                      transitionMutation.isPending &&
                      transitionMutation.variables?.issueKey === issue.key
                    }
                    isCommentPending={
                      commentMutation.isPending && commentMutation.variables?.issueKey === issue.key
                    }
                    transitionError={inlineErrors[`${issue.key}-transition`]}
                    commentError={inlineErrors[`${issue.key}-comment`]}
                  />
                </div>
              );
            };
            return (
              <div key={parent.id}>
                {renderRow(parent, false)}
                {children.map((subtask) => renderRow(subtask, true))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
