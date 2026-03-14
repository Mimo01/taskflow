/**
 * BoardColumn — A single kanban column for the Sprint Board.
 *
 * Renders a column header (status name + card count badge) and a scrollable list
 * of issue groups. Each group is either:
 *   - A bare story (no subtasks) rendered as a single DraggableCard
 *   - A story with subtasks: StoryHeaderRow divider followed by DraggableCards
 *
 * Droppable: useDroppable registers this column as a drop target.
 * - When a drag is active and this column is a valid target: highlighted ring on hover
 * - When a drag is active and this column is NOT a valid target: dimmed with striped overlay
 *
 * The `children` slot holds QuickCreateInput.
 */
import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { JiraProjectStatus, JiraIssue } from '@/services/jira'
import DraggableCard from './DraggableCard'
import { StoryHeaderRow } from './StoryHeaderRow'

export interface BoardColumnGroup {
  story: JiraIssue | null
  storyForHeader?: JiraIssue
  cards: JiraIssue[]
  isBareStory?: boolean
}

interface BoardColumnProps {
  status: JiraProjectStatus
  groups: BoardColumnGroup[]
  onOpenDetail: (key: string) => void
  isDisabledForActive?: boolean
  activeIssue?: JiraIssue | null
  cardErrors?: Map<string, string>
  children?: React.ReactNode
}

export function BoardColumn({
  status,
  groups,
  onOpenDetail,
  isDisabledForActive = false,
  cardErrors,
  children,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status.id,
    disabled: isDisabledForActive,
    data: { statusId: status.id },
  })

  // Card count = all draggable cards: subtasks + bare stories
  const cardCount = groups.reduce((acc, g) => acc + g.cards.length, 0)

  // Compute card list class based on drop state
  const cardListClass = [
    'overflow-y-auto flex-1 flex flex-col gap-1.5 min-h-[80px] rounded-md transition-colors',
    isOver && !isDisabledForActive ? 'ring-2 ring-primary/60' : '',
    isDisabledForActive
      ? 'opacity-40 pointer-events-none'
      : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="min-w-[280px] max-w-[320px] flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {status.name}
        </span>
        <span className="text-xs font-normal text-muted-foreground">({cardCount})</span>
      </div>

      {/* Card list — droppable, scrollable */}
      <div
        ref={setNodeRef}
        className={cardListClass}
        data-droppable={status.name}
        style={isDisabledForActive ? {
          background: 'repeating-linear-gradient(45deg,transparent,transparent 4px,hsl(var(--muted)) 4px,hsl(var(--muted)) 8px)',
        } : undefined}
      >
        {groups.length === 0 ? (
          <div className="flex-1 min-h-[80px] rounded-md border border-dashed border-border/40" />
        ) : (
          groups.map((group, idx) => {
            if (group.isBareStory) {
              // Bare story — render as a standalone DraggableCard
              const storyIssue = group.story ?? group.cards[0]
              const storyError = cardErrors?.get(storyIssue.key)
              return (
                <React.Fragment key={storyIssue.id}>
                  <DraggableCard
                    issue={storyIssue}
                    isSubtask={false}
                    onOpenDetail={onOpenDetail}
                  />
                  {storyError && (
                    <p className="text-xs text-destructive px-1">{storyError}</p>
                  )}
                </React.Fragment>
              )
            }

            // Story with subtasks in this column — header + DraggableCards
            const headerIssue = group.storyForHeader
            return (
              <div key={headerIssue ? headerIssue.id : `group-${idx}`} className="flex flex-col gap-1">
                {headerIssue && (
                  <StoryHeaderRow
                    storyKey={headerIssue.key}
                    summary={headerIssue.fields.summary}
                    onOpenDetail={onOpenDetail}
                  />
                )}
                {group.cards.map((card) => {
                  const cardError = cardErrors?.get(card.key)
                  return (
                    <React.Fragment key={card.id}>
                      <DraggableCard
                        issue={card}
                        isSubtask={true}
                        onOpenDetail={onOpenDetail}
                      />
                      {cardError && (
                        <p className="text-xs text-destructive px-1">{cardError}</p>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* QuickCreateInput slot */}
      {children}
    </div>
  )
}

export default BoardColumn
