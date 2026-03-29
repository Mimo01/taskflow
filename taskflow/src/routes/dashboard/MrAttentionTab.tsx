/**
 * MrAttentionTab — GitLab MRs requiring the developer's attention.
 *
 * Merges assigned MRs and reviewer MRs (deduped by iid). Marks stale MRs
 * based on staleMrThresholdDays from settings store. Polls every 60s.
 *
 * Link computation (Plan 03):
 * - Reads sprint issues from Jira (or cache) to build sprintIssueKeySet
 * - For each MR: calls linkMRToTask to find matched issue key → builds reverse map
 * - Fetches approvals + discussions per MR via ['mr-health', ...] queries (TanStack cache shared with MyTasksTab)
 * - Passes linkedTask and reviewHealth to each MrRow
 *
 * MRAT-02 (Plan 07-03):
 * - Cache-first subtask data from my-tasks cache (shared with MyTasksTab)
 * - Subtask-linked story MRs included unconditionally (bypass reviewer discussion filter)
 * - "via [subtask-key]" label shown only on MRs entering list exclusively via subtask path
 */

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitMerge, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import {
  fetchAssignedMRs,
  fetchMRApprovals,
  fetchMRDiscussions,
  fetchProjectMRs,
  fetchReviewerMRs,
} from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { fetchMyTasksHierarchy, fetchSprintIssues } from '@/services/jira';
import type { ReviewHealth } from '@/services/linkEngine';
import { deriveReviewHealth, linkMRToTask } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { useSettingsStore } from '@/stores/settings.store';
import MrRow from './MrRow';

export default function MrAttentionTab() {
  const {
    gitlabBaseUrl,
    jiraBaseUrl,
    activeJiraProject,
    activeGitlabProject,
    gitlabUserId,
    _hasHydrated,
  } = useAuthStore();
  const { staleMrThresholdDays, storyPointsFieldKey } = useSettingsStore();
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  // Track whether Stronghold reads have settled. Starts true so a skeleton is
  // shown immediately on mount, before the async reads complete.
  const [gitlabTokenLoading, setGitlabTokenLoading] = useState(true);

  useEffect(() => {
    if (gitlabBaseUrl) {
      setGitlabTokenLoading(true);
      readSecret('gitlab-pat')
        .then((t) => {
          setGitlabToken(t);
        })
        .catch(() => {
          setGitlabToken(null);
        })
        .finally(() => {
          setGitlabTokenLoading(false);
        });
    } else if (_hasHydrated) {
      // Only collapse the loading state once the store has actually rehydrated.
      // If gitlabBaseUrl is null before rehydration completes, we keep the skeleton
      // visible to avoid a blank flash.
      setGitlabTokenLoading(false);
    }
  }, [gitlabBaseUrl, _hasHydrated]);

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

  // Cache-first subtask data — reads from my-tasks cache set by MyTasksTab.
  // Fires fallback query only when cache is empty.
  const queryClient = useQueryClient();

  const cachedMyTasks = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
    ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
  );

  const { data: myTasksFallback } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchMyTasksHierarchy(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey),
    staleTime: 30_000,
    enabled: !cachedMyTasks && !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const myTasksData = cachedMyTasks ?? myTasksFallback;

  // Use persisted GitLab user ID from auth store — avoids an extra network round-trip
  // on every mount. The ID is stored during onboarding and token update.
  const userId = gitlabUserId ?? undefined;

  // Fetch sprint board issues for the link key set (or read from cache)
  const { data: sprintIssues } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
  });

  // Combined MR fetch: assigned + reviewer, deduped.
  // Returns { filtered: base MR list, merged: all fetched MRs pre-filter } so subtask
  // extension can pull reviewer MRs that were filtered out by the discussion check.
  const {
    data: mrQueryData,
    isLoading,
    isError,
    error,
    dataUpdatedAt,
    refetch,
  } = useQuery({
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

      // Deduplicate by iid
      const seen = new Set<number>();
      const merged = [...assigned, ...reviewer, ...projectMrs].filter(
        (mr) => !seen.has(mr.iid) && seen.add(mr.iid),
      );

      // For reviewer MRs: filter to only those with unresolved discussions
      // (assigned MRs are always included)
      const assignedIids = new Set(assigned.map((mr) => mr.iid));
      const filteredMrs = await Promise.all(
        merged.map(async (mr) => {
          if (assignedIids.has(mr.iid)) return mr; // always include assigned
          // For reviewer MRs: check for unresolved discussions
          try {
            const discussions = await fetchMRDiscussions(
              gitlabBaseUrl!,
              token,
              mr.project_id,
              mr.iid,
            );
            const hasUnresolved = discussions.some((d) =>
              d.notes.some((n) => n.resolvable && !n.resolved),
            );
            return hasUnresolved ? mr : null;
          } catch {
            return mr; // include on error to avoid silently hiding MRs
          }
        }),
      );

      return {
        filtered: filteredMrs.filter((mr): mr is NonNullable<typeof mr> => mr !== null),
        merged,
      };
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const breadcrumbReset = useBreadcrumbStore((s) => s.reset);
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);

  const handleMRClick = (mr: import('@/services/gitlab').GitLabMR) => {
    breadcrumbReset();
    breadcrumbPush({ path: location.pathname, label: 'MR Attention' });
    pushRecentItem({ type: 'gitlab', id: `${mr.project_id}/${mr.iid}`, title: mr.title });
    navigate(`/mr/${mr.project_id}/${mr.iid}`);
  };

  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  // Build sprint issue key set and issue lookup map
  const sprintIssues_ = sprintIssues ?? [];
  const sprintIssueKeySet = new Set(sprintIssues_.map((i) => i.key));
  const issueByKey = new Map<string, JiraIssue>(sprintIssues_.map((i) => [i.key, i]));

  // Derive story keys where the current user has at least one assigned subtask
  const subtaskStoryKeys = (() => {
    if (!myTasksData) return new Set<string>();
    const { issues, myIssueKeys } = myTasksData;
    const result = new Set<string>();
    for (const issue of issues) {
      if (issue.fields.issuetype.subtask && myIssueKeys.has(issue.key)) {
        const parentKey = issue.fields.parent?.key;
        if (parentKey) result.add(parentKey);
      }
    }
    return result;
  })();

  // Build story -> user's subtask keys map (for viaSubtaskKey derivation)
  const storyToMySubtasks = (() => {
    const map = new Map<string, string[]>();
    if (!myTasksData) return map;
    const { issues, myIssueKeys } = myTasksData;
    for (const issue of issues) {
      if (issue.fields.issuetype.subtask && myIssueKeys.has(issue.key)) {
        const parentKey = issue.fields.parent?.key;
        if (parentKey) {
          map.set(parentKey, [...(map.get(parentKey) ?? []), issue.key]);
        }
      }
    }
    return map;
  })();

  // Extend the base filtered MR list with:
  // 1. Subtask-linked MRs (unconditional inclusion — may have been filtered by discussion check)
  // 2. Project-level MRs whose title links to a sprint issue key (bypass discussion filter)
  const dataMrs = (() => {
    const base = mrQueryData?.filtered ?? [];
    const merged = mrQueryData?.merged ?? [];
    const filteredIids = new Set(base.map((m) => m.iid));
    const extras: typeof base = [];

    for (const mr of merged) {
      if (filteredIids.has(mr.iid)) continue;

      // Include if linked to a subtask story key
      const subtaskLink = subtaskStoryKeys.size > 0 ? linkMRToTask(mr, subtaskStoryKeys) : null;
      if (subtaskLink !== null) {
        extras.push(mr);
        filteredIids.add(mr.iid);
        continue;
      }

      // Include if linked to a sprint issue key (project MRs not in assigned/reviewer)
      const sprintLink = sprintIssueKeySet.size > 0 ? linkMRToTask(mr, sprintIssueKeySet) : null;
      if (sprintLink !== null) {
        extras.push(mr);
        filteredIids.add(mr.iid);
      }
    }

    return [...base, ...extras];
  })();

  // Compute MR -> linked task map using linkMRToTask (sprint key set only -- not subtask keys)
  // Subtask-path-only MRs will have null linkedTask -- the "via" label explains the context
  const mrToLinkedTaskMap = new Map<number, JiraIssue | null>();
  for (const mr of dataMrs) {
    const key = linkMRToTask(mr, sprintIssueKeySet);
    mrToLinkedTaskMap.set(mr.iid, key !== null ? (issueByKey.get(key) ?? null) : null);
  }

  // Compute viaSubtaskKey map: mr.iid -> first-alphabetical subtask key.
  // Only set for MRs that entered the list exclusively via subtask path (not sprint/assigned).
  const mrViaSubtaskKey = (() => {
    const map = new Map<number, string>();
    if (!myTasksData || subtaskStoryKeys.size === 0) return map;
    for (const mr of dataMrs) {
      const inSprintLink = linkMRToTask(mr, sprintIssueKeySet);
      if (inSprintLink !== null) continue; // already linked via sprint issues -- no "via" label
      const subtaskLink = linkMRToTask(mr, subtaskStoryKeys);
      if (subtaskLink !== null) {
        const subtaskKeys = storyToMySubtasks.get(subtaskLink) ?? [];
        const viaKey = [...subtaskKeys].sort()[0];
        if (viaKey) map.set(mr.iid, viaKey);
      }
    }
    return map;
  })();

  // Fetch health (approvals + discussions) per MR
  // Uses same query key ['mr-health', ...] as MyTasksTab -- TanStack deduplicates
  const healthQueries = useQueries({
    queries: dataMrs.map((mr) => ({
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

  // Build health map: mr.iid -> ReviewHealth
  const healthMap = new Map<number, ReviewHealth>();
  for (let i = 0; i < dataMrs.length; i++) {
    const health = healthQueries[i]?.data;
    if (health) {
      healthMap.set(dataMrs[i].iid, health);
    }
  }

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  return (
    <div className="flex flex-col gap-2 p-4">
      {/* Header row */}
      <div className="flex items-center justify-end gap-2 pb-2">
        <span className="text-xs text-muted-foreground">{lastRefreshed}</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Loading skeleton — shown while Stronghold token is fetching OR while query is in-flight */}
      {(gitlabTokenLoading || isLoading) && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              data-testid="skeleton-mr-row"
              className="h-10 rounded bg-muted animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state — no cached data */}
      {isError && !mrQueryData && (
        <ErrorState error={error} onRetry={refetch} viewName="merge requests" />
      )}

      {/* Stale data banner — error with cached data */}
      {isError && mrQueryData && !bannerDismissed && (
        <StaleDataBanner onRetry={refetch} onDismiss={() => setBannerDismissed(true)} />
      )}

      {/* Empty state */}
      {!gitlabTokenLoading && !isLoading && !isError && mrQueryData && dataMrs.length === 0 && (
        <EmptyState
          icon={GitMerge}
          title="No merge requests need attention"
          subtitle="MRs requiring your review will appear here"
          action={
            !gitlabBaseUrl ? (
              <Button onClick={() => navigate('/settings')}>Connect GitLab</Button>
            ) : undefined
          }
        />
      )}

      {/* MR list */}
      {!gitlabTokenLoading && !isLoading && !isError && mrQueryData && dataMrs.length > 0 && (
        <div className="flex flex-col">
          {dataMrs.map((mr) => (
            <MrRow
              key={mr.iid}
              mr={mr}
              linkedTask={mrToLinkedTaskMap.get(mr.iid) ?? null}
              staleMrThresholdDays={staleMrThresholdDays}
              reviewHealth={healthMap.get(mr.iid)}
              viaSubtaskKey={mrViaSubtaskKey.get(mr.iid)}
              onMRClick={handleMRClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
