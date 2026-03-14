/**
 * SprintBoardTab — Grouped kanban board using workflow-API columns.
 *
 * Columns come from fetchProjectStatuses (Jira workflow statuses API), sorted by
 * category (To Do → In Progress → Done) then alphabetically within each category.
 * Empty columns are always shown (valid drop targets for drag-and-drop).
 *
 * Layout:
 * - Stories with subtasks: StoryHeaderRow divider + subtask TaskCards in each column
 *   that contains at least one of their subtasks
 * - Bare stories (no subtasks): standalone draggable TaskCard in their status column
 *
 * Drag-and-drop (plan 10-03):
 * - DndContext with PointerSensor (5px threshold) wraps all columns
 * - DraggableCard used for all card rendering via BoardColumn
 * - handleDragEnd: optimistic update + postTransition + rollback on failure
 * - transitions pre-fetched for all draggable issues after board data loads
 *
 * ANTI-PATTERN: Do NOT derive columns from issue status names — only use workflowStatuses.
 */
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { fetchSprintIssues, fetchProjectStatuses, fetchTransitions, postTransition } from '@/services/jira'
import type { JiraIssue, JiraProjectStatus, JiraTransition } from '@/services/jira'
import { readSecret } from '@/services/stronghold'
import BoardColumn from './BoardColumn'
import type { BoardColumnGroup } from './BoardColumn'
import QuickCreateInput from './QuickCreateInput'
import TaskCard from './TaskCard'
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
  const queryClient = useQueryClient()

  // Optimistic drag state
  const [localIssues, setLocalIssues] = useState<JiraIssue[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [activeIssue, setActiveIssue] = useState<JiraIssue | null>(null)
  const [cardErrors, setCardErrors] = useState<Map<string, string>>(new Map())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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

  // Pre-fetch transitions for all draggable issues after board data loads
  useEffect(() => {
    if (!jiraBaseUrl || !jiraToken || !data) return

    // Build subtasks-by-parent map to identify bare stories
    const subtaskParentKeys = new Set(
      localIssues
        .filter(i => i.fields.issuetype.subtask && i.fields.parent?.key)
        .map(i => i.fields.parent!.key)
    )

    // Draggable = subtasks + bare stories (stories with no subtasks in the sprint)
    const draggable = localIssues.filter(i =>
      i.fields.issuetype.subtask || !subtaskParentKeys.has(i.key)
    )

    // Use Promise.allSettled — silent fail on individual transition fetches
    void Promise.allSettled(
      draggable.map(issue =>
        queryClient.fetchQuery({
          queryKey: ['transitions', issue.key],
          queryFn: () => fetchTransitions(jiraBaseUrl, jiraToken!, issue.key),
          staleTime: 5 * 60 * 1000, // 5 minutes
        })
      )
    )
  }, [jiraBaseUrl, jiraToken, localIssues.length]) // re-fetch when issue list changes

  function handleDragStart(event: DragStartEvent) {
    const issue = localIssues.find(i => i.key === String(event.active.id))
    if (issue) { setActiveIssue(issue); setIsDragging(true) }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false)
    setActiveIssue(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const issueKey = String(active.id)
    const targetStatusId = String(over.id)

    // Find original status for rollback
    const originalIssue = localIssues.find(i => i.key === issueKey)
    if (!originalIssue) return
    const originalStatusId = originalIssue.fields.status.id

    if (originalStatusId === targetStatusId) return

    // Find transition
    const transitions = queryClient.getQueryData<JiraTransition[]>(['transitions', issueKey])
    const transition = transitions?.find(t => t.to.id === targetStatusId)
    if (!transition) {
      setCardErrors(prev => new Map(prev).set(issueKey, 'No valid transition'))
      return
    }

    // Optimistic update
    setLocalIssues(prev => prev.map(i =>
      i.key === issueKey
        ? { ...i, fields: { ...i.fields, status: { ...i.fields.status, id: targetStatusId, name: transition.to.name } } }
        : i
    ))
    // Clear any prior error for this card
    setCardErrors(prev => { const m = new Map(prev); m.delete(issueKey); return m })

    try {
      await postTransition(jiraBaseUrl!, jiraToken!, issueKey, transition.id)
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
    } catch {
      // Rollback
      setLocalIssues(prev => prev.map(i =>
        i.key === issueKey
          ? { ...i, fields: { ...i.fields, status: { ...i.fields.status, id: originalStatusId, name: originalIssue.fields.status.name } } }
          : i
      ))
      setCardErrors(prev => new Map(prev).set(issueKey, 'Transition failed'))
    }
  }

  // Compute valid drop targets based on active issue's fetched transitions
  const validTargets = useMemo(() => {
    if (!activeIssue) return new Map<string, Set<string>>()
    const map = new Map<string, Set<string>>()
    const transitions = queryClient.getQueryData<JiraTransition[]>(['transitions', activeIssue.key])
    if (transitions) {
      map.set(activeIssue.key, new Set(transitions.map(t => t.to.id)))
    }
    return map
  }, [activeIssue, queryClient])

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

        {/* Board columns — wrapped in DndContext for drag-and-drop */}
        {!isLoading && !isError && data && (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => { setActiveIssue(null); setIsDragging(false) }}
          >
            <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
              {boardGroups.map(({ status, groups }) => {
                const isDisabledForActive = activeIssue !== null &&
                  validTargets.has(activeIssue.key) &&
                  !validTargets.get(activeIssue.key)!.has(status.id)
                return (
                  <BoardColumn
                    key={status.id}
                    status={status}
                    groups={groups}
                    onOpenDetail={setSelectedIssueKey}
                    isDisabledForActive={isDisabledForActive}
                    activeIssue={activeIssue}
                    cardErrors={cardErrors}
                  >
                    <QuickCreateInput
                      statusId={status.id}
                      statusName={status.name}
                      projectKey={activeJiraProject!}
                      jiraBaseUrl={jiraBaseUrl!}
                      jiraToken={jiraToken!}
                      onCreated={() => queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })}
                    />
                  </BoardColumn>
                )
              })}
            </div>
            <DragOverlay>
              {activeIssue ? <TaskCard issue={activeIssue} /> : null}
            </DragOverlay>
          </DndContext>
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
