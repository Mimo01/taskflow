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
 */
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import {
  validateGitLab,
  fetchAssignedMRs,
  fetchReviewerMRs,
  fetchMRDiscussions,
  fetchMRApprovals,
} from '@/services/gitlab'
import { fetchSprintIssues } from '@/services/jira'
import { readSecret } from '@/services/stronghold'
import { linkMRToTask, deriveReviewHealth } from '@/services/linkEngine'
import type { ReviewHealth } from '@/services/linkEngine'
import type { JiraIssue } from '@/services/jira'
import MrRow from './MrRow'

export default function MrAttentionTab() {
  const { gitlabBaseUrl, jiraBaseUrl, activeJiraProject } = useAuthStore()
  const { staleMrThresholdDays } = useSettingsStore()
  const [gitlabToken, setGitlabToken] = useState<string | null>(null)
  const [jiraToken, setJiraToken] = useState<string | null>(null)

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => { setGitlabToken(t) })
        .catch(() => { setGitlabToken(null) })
    }
  }, [gitlabBaseUrl])

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => { setJiraToken(t) })
        .catch(() => { setJiraToken(null) })
    }
  }, [jiraBaseUrl])

  // Fetch current GitLab user ID once (staleTime: Infinity)
  const { data: currentUser } = useQuery({
    queryKey: ['gitlab-current-user', gitlabBaseUrl],
    queryFn: () => validateGitLab(gitlabBaseUrl!, gitlabToken!),
    staleTime: Infinity,
    enabled: !!gitlabBaseUrl && !!gitlabToken,
  })

  const userId = currentUser?.id

  // Fetch sprint board issues for the link key set (or read from cache)
  const { data: sprintIssues } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
  })

  // Combined MR fetch: assigned + reviewer, deduped (same query key as MyTasksTab)
  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl],
    queryFn: async () => {
      const token = gitlabToken ?? ''
      const [assigned, reviewer] = await Promise.all([
        fetchAssignedMRs(gitlabBaseUrl!, token),
        userId ? fetchReviewerMRs(gitlabBaseUrl!, token, userId) : Promise.resolve([]),
      ])

      // Deduplicate by iid
      const seen = new Set<number>()
      const merged = [...assigned, ...reviewer].filter(
        (mr) => !seen.has(mr.iid) && seen.add(mr.iid),
      )

      // For reviewer MRs: filter to only those with unresolved discussions
      // (assigned MRs are always included)
      const assignedIids = new Set(assigned.map((mr) => mr.iid))
      const filteredMrs = await Promise.all(
        merged.map(async (mr) => {
          if (assignedIids.has(mr.iid)) return mr // always include assigned
          // For reviewer MRs: check for unresolved discussions
          try {
            const discussions = await fetchMRDiscussions(gitlabBaseUrl!, token, mr.project_id, mr.iid)
            const hasUnresolved = discussions.some((d) =>
              d.notes.some((n) => n.resolvable && !n.resolved),
            )
            return hasUnresolved ? mr : null
          } catch {
            return mr // include on error to avoid silently hiding MRs
          }
        }),
      )

      return filteredMrs.filter((mr): mr is NonNullable<typeof mr> => mr !== null)
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl && !!gitlabToken,
  })

  // Build sprint issue key set and issue lookup map
  const { sprintIssueKeySet, issueByKey } = useMemo(() => {
    const issues = sprintIssues ?? []
    const keySet = new Set(issues.map((i) => i.key))
    const byKey = new Map<string, JiraIssue>(issues.map((i) => [i.key, i]))
    return { sprintIssueKeySet: keySet, issueByKey: byKey }
  }, [sprintIssues])

  // Compute MR → linked task map using linkMRToTask
  const mrToLinkedTaskMap = useMemo(() => {
    const map = new Map<number, JiraIssue | null>()
    for (const mr of data ?? []) {
      const key = linkMRToTask(mr, sprintIssueKeySet)
      map.set(mr.iid, key !== null ? (issueByKey.get(key) ?? null) : null)
    }
    return map
  }, [data, sprintIssueKeySet, issueByKey])

  // Fetch health (approvals + discussions) per MR
  // Uses same query key ['mr-health', ...] as MyTasksTab — TanStack deduplicates
  const healthQueries = useQueries({
    queries: (data ?? []).map((mr) => ({
      queryKey: ['mr-health', mr.project_id, mr.iid],
      queryFn: async (): Promise<ReviewHealth> => {
        const token = gitlabToken ?? ''
        const [approvals, discussions] = await Promise.all([
          fetchMRApprovals(gitlabBaseUrl!, token, mr.project_id, mr.iid),
          fetchMRDiscussions(gitlabBaseUrl!, token, mr.project_id, mr.iid),
        ])
        return deriveReviewHealth(approvals, discussions)
      },
      staleTime: 30_000,
      enabled: !!gitlabBaseUrl && !!gitlabToken,
    })),
  })

  // Build health map: mr.iid → ReviewHealth
  const healthMap = useMemo(() => {
    const map = new Map<number, ReviewHealth>()
    const mrs = data ?? []
    for (let i = 0; i < mrs.length; i++) {
      const health = healthQueries[i]?.data
      if (health) {
        map.set(mrs[i].iid, health)
      }
    }
    return map
  }, [data, healthQueries])

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never'

  return (
    <div className="flex flex-col gap-2">
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

      {/* Loading skeleton */}
      {isLoading && (
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

      {/* Error state */}
      {isError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(error as Error)?.message ?? 'Failed to load MRs'}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data && data.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No MRs requiring attention.
        </div>
      )}

      {/* MR list */}
      {!isLoading && !isError && data && data.length > 0 && (
        <div className="flex flex-col">
          {data.map((mr) => (
            <MrRow
              key={mr.iid}
              mr={mr}
              linkedTask={mrToLinkedTaskMap.get(mr.iid) ?? null}
              staleMrThresholdDays={staleMrThresholdDays}
              reviewHealth={healthMap.get(mr.iid)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
