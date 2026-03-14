/**
 * SprintBoardTab — Jira-style sprint board: 3 category columns × story swimlanes.
 *
 * Columns: always exactly "To Do" | "In Progress" | "Done", driven by the
 * statusCategory field that Jira returns on every status. All statuses with
 * statusCategory.key === "new" land in To Do, "indeterminate" in In Progress,
 * "done" in Done — regardless of how many workflow statuses the project has.
 *
 * fetchProjectStatuses is used to build a statusId → category map so that
 * drag-and-drop can find a valid transition to the target category.
 *
 * Layout: sticky column headers → collapsible story swimlanes → card cells.
 * Drag-and-drop: optimistic update + rollback on API failure.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import {
  fetchSprintIssues,
  fetchProjectStatuses,
  fetchTransitions,
  postTransition,
} from '@/services/jira'
import type { JiraIssue, JiraTransition } from '@/services/jira'
import { readSecret } from '@/services/stronghold'
import DraggableCard from './DraggableCard'
import TaskCard from './TaskCard'
import { StoryHeaderRow } from './StoryHeaderRow'

/** The three fixed columns — all Jira statuses map into one of these via statusCategory. */
const CATEGORY_COLUMNS = [
  { key: 'new', label: 'To Do' },
  { key: 'indeterminate', label: 'In Progress' },
  { key: 'done', label: 'Done' },
] as const

type CategoryKey = (typeof CATEGORY_COLUMNS)[number]['key']

function categoryOf(issue: JiraIssue): CategoryKey {
  return (issue.fields.status.statusCategory?.key as CategoryKey) ?? 'new'
}

/**
 * A droppable cell for one category column inside a story swimlane.
 * ID: "{storyKey}|{categoryKey}" so handleDragEnd can extract the category.
 */
function DroppableCell({
  storyKey,
  categoryKey,
  isDisabled,
  children,
}: {
  storyKey: string
  categoryKey: string
  isDisabled: boolean
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${storyKey}|${categoryKey}`,
    disabled: isDisabled,
  })

  return (
    <div
      ref={setNodeRef}
      className={[
        'flex-1 min-h-[80px] flex flex-col gap-1.5 p-2 border-l border-border/20 transition-colors',
        isOver && !isDisabled ? 'bg-primary/5 ring-inset ring-1 ring-primary/40' : '',
        isDisabled ? 'opacity-40 pointer-events-none' : '',
      ].filter(Boolean).join(' ')}
      style={isDisabled ? {
        background:
          'repeating-linear-gradient(45deg,transparent,transparent 4px,hsl(var(--muted)) 4px,hsl(var(--muted)) 8px)',
      } : undefined}
    >
      {children}
    </div>
  )
}

export default function SprintBoardTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore()
  const { storyPointsFieldKey, epicLinkFieldKey } = useSettingsStore()
  const [jiraToken, setJiraToken] = useState<string | null>(null)
  const { onIssueClick: setSelectedIssueKey } = useOutletContext<{ onIssueClick: (key: string) => void }>()
  const queryClient = useQueryClient()

  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set())
  const toggleStory = (key: string) =>
    setCollapsedStories(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

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
        .then(t => setJiraToken(t))
        .catch(() => setJiraToken(null))
    }
  }, [jiraBaseUrl])

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  })

  /** Used to map transition target status IDs → category keys for drag-and-drop */
  const { data: workflowStatuses } = useQuery({
    queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchProjectStatuses(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: Infinity,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  })

  useEffect(() => {
    if (!isDragging) setLocalIssues(data ?? [])
  }, [data, isDragging])

  // Pre-fetch transitions for all draggable cards
  useEffect(() => {
    if (!jiraBaseUrl || !jiraToken || !localIssues.length) return
    const subtaskParentKeys = new Set(
      localIssues
        .filter(i => i.fields.issuetype.subtask && i.fields.parent?.key)
        .map(i => i.fields.parent!.key)
    )
    const draggable = localIssues.filter(
      i => i.fields.issuetype.subtask || !subtaskParentKeys.has(i.key)
    )
    void Promise.allSettled(
      draggable.map(issue =>
        queryClient.fetchQuery({
          queryKey: ['transitions', issue.key],
          queryFn: () => fetchTransitions(jiraBaseUrl, jiraToken!, issue.key),
          staleTime: 5 * 60 * 1000,
        })
      )
    )
  }, [jiraBaseUrl, jiraToken, localIssues.length])

  /**
   * Maps status ID → category key.
   * Built from workflowStatuses (authoritative) + any categories already on local issues.
   */
  const statusCategoryMap = useMemo(() => {
    const map = new Map<string, CategoryKey>()
    for (const s of workflowStatuses ?? []) {
      map.set(s.id, s.statusCategory.key as CategoryKey)
    }
    for (const issue of localIssues) {
      if (issue.fields.status.statusCategory) {
        map.set(issue.fields.status.id, issue.fields.status.statusCategory.key as CategoryKey)
      }
    }
    return map
  }, [workflowStatuses, localIssues])

  function handleDragStart(event: DragStartEvent) {
    const issue = localIssues.find(i => i.key === String(event.active.id))
    if (issue) { setActiveIssue(issue); setIsDragging(true) }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false)
    setActiveIssue(null)
    const { active, over } = event
    if (!over) return

    const issueKey = String(active.id)
    // Droppable ID: "{storyKey}|{categoryKey}"
    const targetCategory = String(over.id).split('|')[1] as CategoryKey

    const originalIssue = localIssues.find(i => i.key === issueKey)
    if (!originalIssue) return
    if (categoryOf(originalIssue) === targetCategory) return

    // Find a transition whose target status belongs to the dropped category
    const transitions = queryClient.getQueryData<JiraTransition[]>(['transitions', issueKey])
    const transition = transitions?.find(
      t => (statusCategoryMap.get(t.to.id) ?? 'new') === targetCategory
    )
    if (!transition) {
      setCardErrors(prev => new Map(prev).set(issueKey, 'No valid transition'))
      return
    }

    const targetStatusCategory = workflowStatuses?.find(s => s.id === transition.to.id)?.statusCategory

    // Optimistic update — move card into the target category column immediately
    setLocalIssues(prev =>
      prev.map(i =>
        i.key === issueKey
          ? {
              ...i,
              fields: {
                ...i.fields,
                status: {
                  id: transition.to.id,
                  name: transition.to.name,
                  statusCategory: (targetStatusCategory ?? { key: targetCategory }) as { key: 'new' | 'indeterminate' | 'done' },
                },
              },
            }
          : i
      )
    )
    setCardErrors(prev => { const m = new Map(prev); m.delete(issueKey); return m })

    try {
      await postTransition(jiraBaseUrl!, jiraToken!, issueKey, transition.id)
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] })
    } catch {
      // Rollback to original status
      setLocalIssues(prev =>
        prev.map(i =>
          i.key === issueKey
            ? { ...i, fields: { ...i.fields, status: originalIssue.fields.status } }
            : i
        )
      )
      setCardErrors(prev => new Map(prev).set(issueKey, 'Transition failed'))
    }
  }

  /** Set of category keys reachable by the currently dragged card */
  const validTargetCategories = useMemo((): Set<CategoryKey> => {
    if (!activeIssue) return new Set()
    const transitions = queryClient.getQueryData<JiraTransition[]>(['transitions', activeIssue.key])
    const cats = new Set<CategoryKey>()
    for (const t of transitions ?? []) {
      const cat = statusCategoryMap.get(t.to.id)
      if (cat) cats.add(cat)
    }
    return cats
  }, [activeIssue, queryClient, statusCategoryMap])

  const swimlanes = useMemo(() => {
    const stories = localIssues.filter(i => !i.fields.issuetype.subtask)
    const subtasks = localIssues.filter(i => i.fields.issuetype.subtask)
    const subtasksByParent = new Map<string, JiraIssue[]>()
    for (const sub of subtasks) {
      const pk = sub.fields.parent?.key
      if (pk) subtasksByParent.set(pk, [...(subtasksByParent.get(pk) ?? []), sub])
    }
    return stories.map(story => ({
      story,
      subtasks: subtasksByParent.get(story.key) ?? [],
    }))
  }, [localIssues])

  const [activeEpicFilter, setActiveEpicFilter] = useState<string | null>(null)

  const epicOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const { story } of swimlanes) {
      const ek = story.fields[epicLinkFieldKey as string] as string | null | undefined
      if (ek) seen.add(ek)
    }
    return Array.from(seen).sort()
  }, [swimlanes, epicLinkFieldKey])

  const filteredSwimlanes = useMemo(() => {
    if (!activeEpicFilter) return swimlanes
    return swimlanes.filter(({ story }) => {
      const ek = story.fields[epicLinkFieldKey as string] as string | null | undefined
      return !!ek && ek === activeEpicFilter
    })
  }, [swimlanes, activeEpicFilter, epicLinkFieldKey])

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never'

  return (
    <>
      {/*
       * No overflow container here — <main className="flex-1 overflow-auto"> in AppLayout
       * is the scroll container. Sticky elements below reference that ancestor.
       */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveIssue(null); setIsDragging(false) }}
      >
        <div>
          {/*
           * Sticky top bar: column headers + refresh button.
           * h-10 = 40px. Story headers use top-10 to sit directly below this.
           * Sticks relative to <main> — no inner overflow container.
           */}
          <div className="sticky top-0 z-20 bg-background border-b border-border flex h-10">
            {CATEGORY_COLUMNS.map(col => {
              const count = localIssues.filter(
                i => i.fields.issuetype.subtask && categoryOf(i) === col.key
              ).length
              return (
                <div
                  key={col.key}
                  className="flex-1 px-3 flex items-center gap-1.5 border-l border-border/20 first:border-l-0"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col.label}
                  </span>
                  <span className="text-xs text-muted-foreground/70">({count})</span>
                </div>
              )
            })}
            {/* Refresh tucked into the right end of the header bar */}
            <div className="px-3 flex items-center gap-2 shrink-0 border-l border-border/20">
              <span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="size-3" />
              </button>
            </div>
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div className="p-4 flex flex-col gap-3">
              {[0, 1].map(i => (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="h-9 rounded bg-muted animate-pulse" />
                  <div className="flex">
                    {CATEGORY_COLUMNS.map(col => (
                      <div key={col.key} className="flex-1 h-20 bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="m-4 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {(error as Error)?.message ?? 'Failed to load sprint board'}
            </div>
          )}

          {/* Epic filter bar */}
          {!isLoading && !isError && data && epicOptions.length > 0 && (
            <div className="px-4 py-2 border-b flex items-center gap-2" data-testid="sprint-epic-filter">
              <label htmlFor="sprint-epic-select" className="text-xs text-muted-foreground">Epic:</label>
              <select
                id="sprint-epic-select"
                value={activeEpicFilter ?? ''}
                onChange={e => setActiveEpicFilter(e.target.value || null)}
                className="text-xs border rounded px-2 py-1 bg-background"
                aria-label="Filter by epic"
              >
                <option value="">All epics</option>
                {epicOptions.map(key => (
                  <option key={key} value={key}>{key}</option>
                ))}
              </select>
              {activeEpicFilter && (
                <button type="button" onClick={() => setActiveEpicFilter(null)}
                  className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              )}
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && data && swimlanes.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No issues in the current sprint.
            </div>
          )}

          {/* Swimlane rows */}
          {!isLoading && !isError && data && (
            <div className="flex flex-col divide-y divide-border/40">
              {filteredSwimlanes.map(({ story, subtasks }) => {
                const isExpanded = !collapsedStories.has(story.key)
                const cards = subtasks.length > 0 ? subtasks : [story]
                return (
                  <div key={story.key}>
                    {/*
                     * sticky top-10: sits directly below the 40px column header bar.
                     * Sticks until this story section's bottom edge scrolls off-screen,
                     * then the next story's header takes over at the same position.
                     * z-[9] keeps story headers below the column header bar (z-20).
                     */}
                    <div className="sticky top-10 z-[9] bg-background">
                      <StoryHeaderRow
                        storyKey={story.key}
                        summary={story.fields.summary}
                        statusName={story.fields.status.name}
                        statusCategoryKey={story.fields.status.statusCategory?.key ?? 'new'}
                        subtaskCount={subtasks.length}
                        isExpanded={isExpanded}
                        onToggle={() => toggleStory(story.key)}
                        onOpenDetail={setSelectedIssueKey}
                      />
                    </div>
                    {isExpanded && (
                      <div className="flex bg-muted/10">
                        {CATEGORY_COLUMNS.map(col => {
                          const colCards = cards.filter(c => categoryOf(c) === col.key)
                          const isDisabled =
                            activeIssue !== null &&
                            validTargetCategories.size > 0 &&
                            !validTargetCategories.has(col.key)
                          return (
                            <DroppableCell
                              key={col.key}
                              storyKey={story.key}
                              categoryKey={col.key}
                              isDisabled={isDisabled}
                            >
                              {colCards.map(card => (
                                <React.Fragment key={card.key}>
                                  <DraggableCard
                                    issue={card}
                                    isSubtask={card.fields.issuetype.subtask}
                                    onOpenDetail={setSelectedIssueKey}
                                  />
                                  {cardErrors.get(card.key) && (
                                    <p className="text-xs text-destructive px-1">
                                      {cardErrors.get(card.key)}
                                    </p>
                                  )}
                                </React.Fragment>
                              ))}
                            </DroppableCell>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeIssue ? <TaskCard issue={activeIssue} /> : null}
        </DragOverlay>
      </DndContext>

    </>
  )
}
