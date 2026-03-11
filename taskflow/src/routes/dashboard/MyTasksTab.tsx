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
 */
import { useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { fetchSprintIssues } from '@/services/jira'
import {
  fetchAssignedMRs,
  fetchReviewerMRs,
  fetchMRCommits,
  fetchMRApprovals,
  fetchMRDiscussions,
} from '@/services/gitlab'
import { readSecret } from '@/services/stronghold'
import {
  linkMRToTask,
  linkMRToTaskViaCommits,
  deriveReviewHealth,
} from '@/services/linkEngine'
import type { ReviewHealth } from '@/services/linkEngine'
import type { GitLabMR } from '@/services/gitlab'
import TaskRow from './TaskRow'

export default function MyTasksTab() {
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl } = useAuthStore()
  const jiraTokenRef = useRef<string | null>(null)
  const gitlabTokenRef = useRef<string | null>(null)

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => { jiraTokenRef.current = t })
        .catch(() => { jiraTokenRef.current = null })
    }
  }, [jiraBaseUrl])

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => { gitlabTokenRef.current = t })
        .catch(() => { gitlabTokenRef.current = null })
    }
  }, [gitlabBaseUrl])

  // Fetch sprint issues assigned to current user
  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject],
    queryFn: () => {
      const token = jiraTokenRef.current ?? ''
      return fetchSprintIssues(jiraBaseUrl!, token, activeJiraProject!, true)
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl,
  })

  // Fetch GitLab MRs (same query key as MrAttentionTab — TanStack deduplicates)
  const { data: gitlabMrs } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl],
    queryFn: async () => {
      const token = gitlabTokenRef.current ?? ''
      const [assigned, reviewer] = await Promise.all([
        fetchAssignedMRs(gitlabBaseUrl!, token),
        fetchReviewerMRs(gitlabBaseUrl!, token, 0),
      ])
      const seen = new Set<number>()
      return [...assigned, ...reviewer].filter(
        (mr) => !seen.has(mr.iid) && seen.add(mr.iid),
      )
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl,
  })

  const sprintIssueKeySet = useMemo(() => {
    return new Set((data ?? []).map((i) => i.key))
  }, [data])

  // Title-scan linking: synchronous, no API calls
  const titleLinkMap = useMemo(() => {
    const map = new Map<number, string | null>()
    for (const mr of gitlabMrs ?? []) {
      map.set(mr.iid, linkMRToTask(mr, sprintIssueKeySet))
    }
    return map
  }, [gitlabMrs, sprintIssueKeySet])

  // MRs that need commit fallback scan (title scan returned null)
  const mrsNeedingCommits = useMemo(() => {
    return (gitlabMrs ?? []).filter((mr) => titleLinkMap.get(mr.iid) === null)
  }, [gitlabMrs, titleLinkMap])

  // Fetch commits for MRs that didn't link via title (LINK-02 fallback)
  const commitQueries = useQueries({
    queries: mrsNeedingCommits.map((mr) => ({
      queryKey: ['mr-commits', mr.project_id, mr.iid],
      queryFn: () => fetchMRCommits(gitlabBaseUrl!, gitlabTokenRef.current ?? '', mr.project_id, mr.iid),
      staleTime: 60_000,
      enabled: !!gitlabBaseUrl,
    })),
  })

  // Build combined link map (title + commit fallback)
  const fullLinkMap = useMemo(() => {
    const map = new Map<string, GitLabMR[]>() // issueKey → linked MRs

    for (const mr of gitlabMrs ?? []) {
      const titleResult = titleLinkMap.get(mr.iid)
      if (titleResult !== null && titleResult !== undefined) {
        const existing = map.get(titleResult) ?? []
        map.set(titleResult, [...existing, mr])
        continue
      }

      // Try commit fallback for this MR
      const mrIndex = mrsNeedingCommits.findIndex((m) => m.iid === mr.iid)
      if (mrIndex >= 0) {
        const commitQuery = commitQueries[mrIndex]
        if (commitQuery?.data) {
          const commitResult = linkMRToTaskViaCommits(mr, sprintIssueKeySet, commitQuery.data)
          if (commitResult !== null) {
            const existing = map.get(commitResult) ?? []
            map.set(commitResult, [...existing, mr])
          }
        }
      }
    }

    return map
  }, [gitlabMrs, titleLinkMap, mrsNeedingCommits, commitQueries, sprintIssueKeySet])

  // Collect all linked MRs for health fetching
  const linkedMrsList = useMemo(() => {
    const result: GitLabMR[] = []
    for (const mrs of fullLinkMap.values()) {
      for (const mr of mrs) {
        if (!result.some((m) => m.iid === mr.iid)) {
          result.push(mr)
        }
      }
    }
    return result
  }, [fullLinkMap])

  // Fetch health (approvals + discussions) for each linked MR
  const healthQueries = useQueries({
    queries: linkedMrsList.map((mr) => ({
      queryKey: ['mr-health', mr.project_id, mr.iid],
      queryFn: async (): Promise<ReviewHealth> => {
        const token = gitlabTokenRef.current ?? ''
        const [approvals, discussions] = await Promise.all([
          fetchMRApprovals(gitlabBaseUrl!, token, mr.project_id, mr.iid),
          fetchMRDiscussions(gitlabBaseUrl!, token, mr.project_id, mr.iid),
        ])
        return deriveReviewHealth(approvals, discussions)
      },
      staleTime: 30_000,
      enabled: !!gitlabBaseUrl,
    })),
  })

  // Build health map: mr.iid → ReviewHealth
  const healthMap = useMemo(() => {
    const map = new Map<number, ReviewHealth>()
    for (let i = 0; i < linkedMrsList.length; i++) {
      const health = healthQueries[i]?.data
      if (health) {
        map.set(linkedMrsList[i].iid, health)
      }
    }
    return map
  }, [linkedMrsList, healthQueries])

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never'

  return (
    <div className="flex flex-col gap-2">
      {/* Header row with last-refreshed and refresh button */}
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

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              data-testid="skeleton-row"
              className="h-10 rounded bg-muted animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(error as Error)?.message ?? 'Failed to load tasks'}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data && data.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No tasks — you are all caught up!
        </div>
      )}

      {/* Task list */}
      {!isLoading && !isError && data && data.length > 0 && (
        <div className="flex flex-col">
          {data.map((issue) => {
            const linkedMrs = fullLinkMap.get(issue.key) ?? []
            const linkedMrResults = linkedMrs.map((mr) => ({
              mr,
              health: healthMap.get(mr.iid) ?? ('waiting_for_review' as ReviewHealth),
            }))
            return (
              <TaskRow
                key={issue.id}
                issue={issue}
                linkedMrResults={linkedMrResults}
                onStatusClick={() => {}}
                onCommentClick={() => {}}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
