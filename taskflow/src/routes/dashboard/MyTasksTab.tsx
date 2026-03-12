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
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { fetchMyTasksHierarchy, postTransition, postComment } from '@/services/jira'
import type { JiraIssue } from '@/services/jira'
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
  const { storyPointsFieldKey } = useSettingsStore()
  const [jiraToken, setJiraToken] = useState<string | null>(null)
  const [gitlabToken, setGitlabToken] = useState<string | null>(null)

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => { setJiraToken(t) })
        .catch(() => { setJiraToken(null) })
    }
  }, [jiraBaseUrl])

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => { setGitlabToken(t) })
        .catch(() => { setGitlabToken(null) })
    }
  }, [gitlabBaseUrl])

  // Fetch sprint issues: my stories + stories with my subtasks + all their subtasks.
  // Include storyPointsFieldKey in cache key: when discovery changes the key, the query
  // re-fires with the updated fields list so the response actually contains the value.
  const { data: taskData, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
    queryFn: () => fetchMyTasksHierarchy(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  })
  const data = taskData?.issues
  const myIssueKeys = taskData?.myIssueKeys ?? new Set<string>()

  // Fetch GitLab MRs (same query key as MrAttentionTab — TanStack deduplicates)
  const { data: gitlabMrs } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl],
    queryFn: async () => {
      const token = gitlabToken ?? ''
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
    enabled: !!gitlabBaseUrl && !!gitlabToken,
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
      queryFn: () => fetchMRCommits(gitlabBaseUrl!, gitlabToken ?? '', mr.project_id, mr.iid),
      staleTime: 60_000,
      enabled: !!gitlabBaseUrl && !!gitlabToken,
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
    for (let i = 0; i < linkedMrsList.length; i++) {
      const health = healthQueries[i]?.data
      if (health) {
        map.set(linkedMrsList[i].iid, health)
      }
    }
    return map
  }, [linkedMrsList, healthQueries])

  const queryClient = useQueryClient()

  // Per-row inline errors: keyed by `${issueKey}-transition` or `${issueKey}-comment`
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({})

  // Transition mutation with optimistic update
  const transitionMutation = useMutation({
    mutationFn: ({ issueKey, transitionId }: { issueKey: string; transitionId: string; toStatusName: string }) =>
      postTransition(jiraBaseUrl!, jiraToken ?? '', issueKey, transitionId),
    onMutate: async ({ issueKey, toStatusName }) => {
      await queryClient.cancelQueries({ queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey] })
      const prev = queryClient.getQueryData<JiraIssue[]>(['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey])
      queryClient.setQueryData<JiraIssue[]>(['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey], (old) =>
        (old ?? []).map((i) =>
          i.key === issueKey
            ? { ...i, fields: { ...i.fields, status: { ...i.fields.status, name: toStatusName } } }
            : i,
        ),
      )
      return { prev }
    },
    onError: (_err, { issueKey }, ctx) => {
      queryClient.setQueryData(['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey], ctx?.prev)
      setInlineErrors((prev) => ({ ...prev, [`${issueKey}-transition`]: 'Failed to update — try again' }))
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey] }),
  })

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: ({ issueKey, comment }: { issueKey: string; comment: string }) =>
      postComment(jiraBaseUrl!, jiraToken ?? '', issueKey, comment),
    onSuccess: () => {
      // TaskRow closes comment optimistically on submit
    },
    onError: (_err, { issueKey }) => {
      setInlineErrors((prev) => ({ ...prev, [`${issueKey}-comment`]: 'Failed to add comment — try again' }))
    },
  })

  // Group flat issue list into parent→subtasks hierarchy
  const groupedData = useMemo(() => {
    const issues = data ?? []
    const parents = issues.filter((i) => !i.fields.issuetype.subtask)
    const subtasks = issues.filter((i) => i.fields.issuetype.subtask)
    const parentKeySet = new Set(parents.map((p) => p.key))
    const subtasksByParent = new Map<string, JiraIssue[]>()
    const orphans: JiraIssue[] = []
    for (const s of subtasks) {
      const parentKey = s.fields.parent?.key
      if (parentKey && parentKeySet.has(parentKey)) {
        const existing = subtasksByParent.get(parentKey) ?? []
        subtasksByParent.set(parentKey, [...existing, s])
      } else {
        orphans.push(s)
      }
    }
    return { groups: parents.map((p) => ({ parent: p, subtasks: subtasksByParent.get(p.key) ?? [] })), orphans }
  }, [data])

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never'

  return (
    <div className="flex flex-col gap-2 p-4">
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

      {/* Task list — grouped by parent→subtasks */}
      {!isLoading && !isError && data && data.length > 0 && (
        <div className="flex flex-col">
          {groupedData.groups.map(({ parent, subtasks: children }) => {
            const renderRow = (issue: JiraIssue, isSubtask: boolean) => {
              const linkedMrs = fullLinkMap.get(issue.key) ?? []
              const linkedMrResults = linkedMrs.map((mr) => ({
                mr,
                health: healthMap.get(mr.iid) ?? ('waiting_for_review' as ReviewHealth),
              }))
              return (
                <TaskRow
                  key={issue.id}
                  issue={issue}
                  isSubtask={isSubtask}
                  notMine={isSubtask && !myIssueKeys.has(issue.key)}
                  linkedMrResults={linkedMrResults}
                  jiraBaseUrl={jiraBaseUrl ?? ''}
                  jiraToken={jiraToken ?? ''}
                  onTransitionSelect={(issueKey, transitionId, toStatusName) => {
                    setInlineErrors((prev) => { const next = { ...prev }; delete next[`${issueKey}-transition`]; return next })
                    transitionMutation.mutate({ issueKey, transitionId, toStatusName })
                  }}
                  onCommentSubmit={(issueKey, comment) => {
                    setInlineErrors((prev) => { const next = { ...prev }; delete next[`${issueKey}-comment`]; return next })
                    commentMutation.mutate({ issueKey, comment })
                  }}
                  isTransitionPending={
                    transitionMutation.isPending &&
                    transitionMutation.variables?.issueKey === issue.key
                  }
                  isCommentPending={
                    commentMutation.isPending &&
                    commentMutation.variables?.issueKey === issue.key
                  }
                  transitionError={inlineErrors[`${issue.key}-transition`]}
                  commentError={inlineErrors[`${issue.key}-comment`]}
                />
              )
            }
            return (
              <div key={parent.id}>
                {renderRow(parent, false)}
                {children.map((subtask) => renderRow(subtask, true))}
              </div>
            )
          })}
          {groupedData.orphans.map((issue) => {
            const linkedMrs = fullLinkMap.get(issue.key) ?? []
            const linkedMrResults = linkedMrs.map((mr) => ({
              mr,
              health: healthMap.get(mr.iid) ?? ('waiting_for_review' as ReviewHealth),
            }))
            return (
              <TaskRow
                key={issue.id}
                issue={issue}
                isSubtask
                notMine={!myIssueKeys.has(issue.key)}
                linkedMrResults={linkedMrResults}
                jiraBaseUrl={jiraBaseUrl ?? ''}
                jiraToken={jiraToken ?? ''}
                onTransitionSelect={(issueKey, transitionId, toStatusName) => {
                  setInlineErrors((prev) => { const next = { ...prev }; delete next[`${issueKey}-transition`]; return next })
                  transitionMutation.mutate({ issueKey, transitionId, toStatusName })
                }}
                onCommentSubmit={(issueKey, comment) => {
                  setInlineErrors((prev) => { const next = { ...prev }; delete next[`${issueKey}-comment`]; return next })
                  commentMutation.mutate({ issueKey, comment })
                }}
                isTransitionPending={
                  transitionMutation.isPending &&
                  transitionMutation.variables?.issueKey === issue.key
                }
                isCommentPending={
                  commentMutation.isPending &&
                  commentMutation.variables?.issueKey === issue.key
                }
                transitionError={inlineErrors[`${issue.key}-transition`]}
                commentError={inlineErrors[`${issue.key}-comment`]}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
