/**
 * SprintBoardTab — All sprint issues grouped into columns by status.
 *
 * Derives distinct column names from issue status names, renders each as a
 * vertical column with compact TaskCards. Scrolls horizontally when columns
 * overflow. Polls every 60s.
 *
 * Link computation (Plan 03):
 * - Reads GitLab MRs from the ['gitlab-mrs', ...] cache (set by MrAttentionTab/MyTasksTab)
 * - Computes task→health map: best health across all MRs linked to each issue key
 * - Priority: changes_requested > waiting_for_review > approved
 * - Passes healthDot to each TaskCard
 */
import { useRef, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { fetchSprintIssues } from '@/services/jira'
import { readSecret } from '@/services/stronghold'
import { linkMRToTask } from '@/services/linkEngine'
import type { ReviewHealth } from '@/services/linkEngine'
import type { GitLabMR } from '@/services/gitlab'
import TaskCard from './TaskCard'

/** Priority order for health: lower index = higher priority */
const HEALTH_PRIORITY: ReviewHealth[] = ['changes_requested', 'waiting_for_review', 'approved']

function bestHealth(healths: ReviewHealth[]): ReviewHealth | undefined {
  if (healths.length === 0) return undefined
  for (const h of HEALTH_PRIORITY) {
    if (healths.includes(h)) return h
  }
  return healths[0]
}

export default function SprintBoardTab() {
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl } = useAuthStore()
  const tokenRef = useRef<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => { tokenRef.current = t })
        .catch(() => { tokenRef.current = null })
    }
  }, [jiraBaseUrl])

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject],
    queryFn: () => {
      const token = tokenRef.current ?? ''
      return fetchSprintIssues(jiraBaseUrl!, token, activeJiraProject!, false)
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl,
  })

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never'

  // Derive distinct column names in order of first appearance
  const columns = data
    ? Array.from(new Set(data.map((i) => i.fields.status.name)))
    : []

  // Read GitLab MRs from TanStack cache (populated by MrAttentionTab or MyTasksTab)
  const gitlabMrs = useMemo(() => {
    return queryClient.getQueryData<GitLabMR[]>(['gitlab-mrs', gitlabBaseUrl]) ?? []
  }, [queryClient, gitlabBaseUrl, data]) // recompute when data changes to pick up newly cached MRs

  // Read health map from cache (populated by MyTasksTab/MrAttentionTab health queries)
  // Build task → best health using link map
  const taskHealthMap = useMemo(() => {
    const map = new Map<string, ReviewHealth>()
    if (!data || gitlabMrs.length === 0) return map

    const sprintIssueKeySet = new Set(data.map((i) => i.key))

    // Group MRs by linked issue key
    const mrsByKey = new Map<string, GitLabMR[]>()
    for (const mr of gitlabMrs) {
      const key = linkMRToTask(mr, sprintIssueKeySet)
      if (key !== null) {
        const existing = mrsByKey.get(key) ?? []
        mrsByKey.set(key, [...existing, mr])
      }
    }

    // For each issue with linked MRs, look up health from cache
    for (const [issueKey, mrs] of mrsByKey.entries()) {
      const healths: ReviewHealth[] = []
      for (const mr of mrs) {
        const cached = queryClient.getQueryData<ReviewHealth>(['mr-health', mr.project_id, mr.iid])
        if (cached) healths.push(cached)
      }
      const best = bestHealth(healths)
      if (best !== undefined) {
        map.set(issueKey, best)
      }
    }

    return map
  }, [data, gitlabMrs, queryClient])

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
        <div className="flex gap-4 overflow-x-auto">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="min-w-[220px] flex-shrink-0 flex flex-col gap-2"
            >
              <div className="h-5 rounded bg-muted animate-pulse w-24" />
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-20 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(error as Error)?.message ?? 'Failed to load sprint board'}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data && data.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No issues in the current sprint.
        </div>
      )}

      {/* Board columns */}
      {!isLoading && !isError && data && data.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {columns.map((col) => {
              const colIssues = data.filter((i) => i.fields.status.name === col)
              return (
                <div key={col} className="min-w-[220px] flex-shrink-0 flex flex-col gap-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                    {col}
                    <span className="ml-1 text-xs font-normal">({colIssues.length})</span>
                  </div>
                  {colIssues.map((issue) => (
                    <TaskCard
                      key={issue.id}
                      issue={issue}
                      healthDot={taskHealthMap.get(issue.key)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
