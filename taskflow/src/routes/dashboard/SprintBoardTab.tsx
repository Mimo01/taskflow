/**
 * SprintBoardTab — Grouped kanban board using workflow-API columns.
 *
 * Columns come from fetchProjectStatuses (Jira workflow statuses API), sorted by
 * category (To Do → In Progress → Done) then alphabetically within each category.
 * Empty columns are always shown (valid drop targets for drag-and-drop in plan 10-03).
 *
 * Layout:
 * - Stories with subtasks: StoryHeaderRow divider + subtask TaskCards in each column
 *   that contains at least one of their subtasks
 * - Bare stories (no subtasks): standalone draggable TaskCard in their status column
 *
 * DndContext placeholder: localIssues + isDragging state are wired here so plan 10-03
 * can plug in DndContext + handleDragEnd without touching data shape.
 *
 * ANTI-PATTERN: Do NOT derive columns from issue status names — only use workflowStatuses.
 */
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { fetchSprintIssues, fetchProjectStatuses } from '@/services/jira'
import type { JiraIssue, JiraProjectStatus } from '@/services/jira'
import { readSecret } from '@/services/stronghold'
import BoardColumn from './BoardColumn'
import type { BoardColumnGroup } from './BoardColumn'
import { IssueDetailSheet } from './IssueDetailSheet'

/** Category sort order: To Do (new) → In Progress (indeterminate) → Done (done) → unknown */
const CATEGORY_ORDER: Record<string, number> = { new: 0, indeterminate: 1, done: 2 }

function sortStatuses(statuses: JiraProjectStatus[]): JiraProjectStatus[] {
  return [...statuses].sort((a, b) => {
    const ca = CATEGORY_ORDER[a.statusCategory.key] ?? 3
    const cb = CATEGORY_ORDER[b.statusCategory.key] ?? 3
    if (ca !== cb) return ca - cb
    return a.name.localeCompare(b.name)
  })
}

export default function SprintBoardTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore()
  const { storyPointsFieldKey } = useSettingsStore()
  const [jiraToken, setJiraToken] = useState<string | null>(null)
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)

  // Optimistic drag state (plan 10-03 will add DndContext + handleDragEnd)
  const [localIssues, setLocalIssues] = useState<JiraIssue[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Expose for plan 10-03 drag implementation (unused but declared per plan spec)
  void setIsDragging

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => { setJiraToken(t) })
        .catch(() => { setJiraToken(null) })
    }
  }, [jiraBaseUrl])

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  })

  const { data: workflowStatuses } = useQuery({
    queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchProjectStatuses(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: Infinity,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  })

  // Sync localIssues from server, gated on !isDragging to avoid flicker during drag
  useEffect(() => {
    if (!isDragging) setLocalIssues(data ?? [])
  }, [data, isDragging])

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never'

  const sortedColumns = useMemo(() =>
    workflowStatuses ? sortStatuses(workflowStatuses) : [],
  [workflowStatuses])

  const boardGroups = useMemo(() => {
    const stories = localIssues.filter(i => !i.fields.issuetype.subtask)
    const subtasks = localIssues.filter(i => i.fields.issuetype.subtask)

    // Build parent key → subtasks map
    const subtasksByParent = new Map<string, JiraIssue[]>()
    for (const sub of subtasks) {
      const parentKey = sub.fields.parent?.key
      if (parentKey) {
        subtasksByParent.set(parentKey, [...(subtasksByParent.get(parentKey) ?? []), sub])
      }
    }

    // For each column, build groups
    return sortedColumns.map(col => {
      const groups: BoardColumnGroup[] = []

      for (const story of stories) {
        const storySubtasks = subtasksByParent.get(story.key) ?? []
        const subtasksInThisCol = storySubtasks.filter(s => s.fields.status.id === col.id)
        const storyInThisCol = story.fields.status.id === col.id

        if (storySubtasks.length === 0 && storyInThisCol) {
          // Bare story (no subtasks) — appears as a draggable card
          groups.push({ story: story, cards: [story], isBareStory: true })
        } else if (subtasksInThisCol.length > 0) {
          // Story has subtasks in this column — show header + subtask cards
          groups.push({ story: null, storyForHeader: story, cards: subtasksInThisCol, isBareStory: false })
        }
      }

      return { status: col, groups }
    })
  }, [localIssues, sortedColumns])

  const hasAnyIssues = localIssues.length > 0

  return (
    <>
      <div className="flex flex-col gap-2 p-4 flex-1 min-h-0">
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
                className="min-w-[280px] flex-shrink-0 flex flex-col gap-2"
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
        {!isLoading && !isError && data && !hasAnyIssues && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No issues in the current sprint.
          </div>
        )}

        {/* Board columns — always show when not loading/error, even if empty */}
        {!isLoading && !isError && data && (
          <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
            {boardGroups.map(({ status, groups }) => (
              <BoardColumn
                key={status.id}
                status={status}
                groups={groups}
                onOpenDetail={setSelectedIssueKey}
              />
            ))}
          </div>
        )}
      </div>

      <IssueDetailSheet
        issueKey={selectedIssueKey}
        onClose={() => setSelectedIssueKey(null)}
        onOpenIssue={setSelectedIssueKey}
      />
    </>
  )
}
