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
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
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
import { fetchSprintIssues, fetchMyTasksHierarchy } from '@/services/jira'
import { readSecret } from '@/services/stronghold'
import { linkMRToTask, deriveReviewHealth } from '@/services/linkEngine'
import type { ReviewHealth } from '@/services/linkEngine'
import type { JiraIssue } from '@/services/jira'
import MrRow from './MrRow'

export default function MrAttentionTab() {
  const { gitlabBaseUrl, jiraBaseUrl, activeJiraProject } = useAuthStore()
  const { staleMrThresholdDays, storyPointsFieldKey } = useSettingsStore()
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

  // Cache-first subtask data — reads from my-tasks cache set by MyTasksTab.
  // Fires fallback query only when cache is empty.
  const queryClient = useQueryClient()

  const cachedMyTasks = queryClient.getQueryData<{ issues: JiraIssue[]; myIssueKeys: Set<string> }>(
    ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
  )

  const { data: myTasksFallback } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
    queryFn: () => fetchMyTasksHierarchy(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey),
    staleTime: 30_000,
    enabled: !cachedMyTasks && !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  })

  const myTasksData = cachedMyTasks ?? myTasksFallback

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

  // Combined MR fetch: assigned + reviewer, deduped.
  // Returns { filtered: base MR list, merged: all fetched MRs pre-filter } so subtask
  // extension can pull reviewer MRs that were filtered out by the discussion check.
  const { data: mrQueryData, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl, userId],
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

      return {
        filtered: filteredMrs.filter((mr): mr is NonNullable<typeof mr> => mr !== null),
        merged,
      }
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!userId,
  })

  // Build sprint issue key set and issue lookup map
  const { sprintIssueKeySet, issueByKey } = useMemo(() => {
    const issues = sprintIssues ?? []
    const keySet = new Set(issues.map((i) => i.key))
    const byKey = new Map<string, JiraIssue>(issues.map((i) => [i.key, i]))
    return { sprintIssueKeySet: keySet, issueByKey: byKey }
  }, [sprintIssues])

  // Derive story keys where the current user has at least one assigned subtask
  const subtaskStoryKeys = useMemo(() => {
    if (!myTasksData) return new Set<string>()
    const { issues, myIssueKeys } = myTasksData
    const result = new Set<string>()
    for (const issue of issues) {
      if (issue.fields.issuetype.subtask && myIssueKeys.has(issue.key)) {
        const parentKey = issue.fields.parent?.key
        if (parentKey) result.add(parentKey)
      }
    }
    return result
  }, [myTasksData])

  // Build story -> user's subtask keys map (for viaSubtaskKey derivation)
  const storyToMySubtasks = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!myTasksData) return map
    const { issues, myIssueKeys } = myTasksData
    for (const issue of issues) {
      if (issue.fields.issuetype.subtask && myIssueKeys.has(issue.key)) {
        const parentKey = issue.fields.parent?.key
        if (parentKey) {
          map.set(parentKey, [...(map.get(parentKey) ?? []), issue.key])
        }
      }
    }
    return map
  }, [myTasksData])

  // Extend the base filtered MR list with subtask-linked MRs (unconditional inclusion).
  // Subtask-linked MRs may have been filtered out by the reviewer discussion check.
  const data = useMemo(() => {
    const base = mrQueryData?.filtered ?? []
    if (subtaskStoryKeys.size === 0) return base
    const merged = mrQueryData?.merged ?? []
    const filteredIids = new Set(base.map((m) => m.iid))
    const extras: typeof base = []
    for (const mr of merged) {
      if (!filteredIids.has(mr.iid)) {
        const linkedKey = linkMRToTask(mr, subtaskStoryKeys)
        if (linkedKey !== null) {
          extras.push(mr)
          filteredIids.add(mr.iid)
        }
      }
    }
    return [...base, ...extras]
  }, [mrQueryData, subtaskStoryKeys])

  // Compute MR -> linked task map using linkMRToTask (sprint key set only -- not subtask keys)
  // Subtask-path-only MRs will have null linkedTask -- the "via" label explains the context
  const mrToLinkedTaskMap = useMemo(() => {
    const map = new Map<number, JiraIssue | null>()
    for (const mr of data) {
      const key = linkMRToTask(mr, sprintIssueKeySet)
      map.set(mr.iid, key !== null ? (issueByKey.get(key) ?? null) : null)
    }
    return map
  }, [data, sprintIssueKeySet, issueByKey])

  // Compute viaSubtaskKey map: mr.iid -> first-alphabetical subtask key.
  // Only set for MRs that entered the list exclusively via subtask path (not sprint/assigned).
  const mrViaSubtaskKey = useMemo(() => {
    const map = new Map<number, string>()
    if (!myTasksData || subtaskStoryKeys.size === 0) return map
    for (const mr of data) {
      const inSprintLink = linkMRToTask(mr, sprintIssueKeySet)
      if (inSprintLink !== null) continue // already linked via sprint issues -- no "via" label
      const subtaskLink = linkMRToTask(mr, subtaskStoryKeys)
      if (subtaskLink !== null) {
        const subtaskKeys = storyToMySubtasks.get(subtaskLink) ?? []
        const viaKey = [...subtaskKeys].sort()[0]
        if (viaKey) map.set(mr.iid, viaKey)
      }
    }
    return map
  }, [data, myTasksData, sprintIssueKeySet, subtaskStoryKeys, storyToMySubtasks])

  // Fetch health (approvals + discussions) per MR
  // Uses same query key ['mr-health', ...] as MyTasksTab -- TanStack deduplicates
  const healthQueries = useQueries({
    queries: data.map((mr) => ({
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

  // Build health map: mr.iid -> ReviewHealth
  const healthMap = useMemo(() => {
    const map = new Map<number, ReviewHealth>()
    for (let i = 0; i < data.length; i++) {
      const health = healthQueries[i]?.data
      if (health) {
        map.set(data[i].iid, health)
      }
    }
    return map
  }, [data, healthQueries])

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never'

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
      {!isLoading && !isError && mrQueryData && data.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No MRs requiring attention.
        </div>
      )}

      {/* MR list */}
      {!isLoading && !isError && mrQueryData && data.length > 0 && (
        <div className="flex flex-col">
          {data.map((mr) => (
            <MrRow
              key={mr.iid}
              mr={mr}
              linkedTask={mrToLinkedTaskMap.get(mr.iid) ?? null}
              staleMrThresholdDays={staleMrThresholdDays}
              reviewHealth={healthMap.get(mr.iid)}
              viaSubtaskKey={mrViaSubtaskKey.get(mr.iid)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
