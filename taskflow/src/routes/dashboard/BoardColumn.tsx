/**
 * BoardColumn — A single kanban column for the Sprint Board.
 *
 * Renders a column header (status name + card count badge) and a scrollable list
 * of issue groups. Each group is either:
 *   - A bare story (no subtasks) rendered as a single draggable TaskCard
 *   - A story with subtasks: StoryHeaderRow divider followed by subtask TaskCards
 *
 * Not a droppable yet — useDroppable will be added in plan 10-03.
 * The `children` slot is reserved for QuickCreateInput (added in plan 10-03).
 */
import React from 'react'
import type { JiraProjectStatus, JiraIssue } from '@/services/jira'
import TaskCard from './TaskCard'
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
  children?: React.ReactNode
}

export function BoardColumn({ status, groups, onOpenDetail, children }: BoardColumnProps) {
  // Card count = all draggable cards: subtasks + bare stories
  const cardCount = groups.reduce((acc, g) => acc + g.cards.length, 0)

  return (
    <div className="min-w-[280px] max-w-[320px] flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {status.name}
        </span>
        <span className="text-xs font-normal text-muted-foreground">({cardCount})</span>
      </div>

      {/* Card list — scrollable */}
      <div
        className="overflow-y-auto flex-1 flex flex-col gap-1.5 min-h-[80px]"
        data-droppable={status.name}
      >
        {groups.length === 0 ? (
          <div className="flex-1 min-h-[80px] rounded-md border border-dashed border-border/40" />
        ) : (
          groups.map((group, idx) => {
            if (group.isBareStory) {
              // Bare story — render as a standalone TaskCard
              const storyIssue = group.story ?? group.cards[0]
              return (
                <TaskCard
                  key={storyIssue.id}
                  issue={storyIssue}
                  isSubtask={false}
                  onClick={() => onOpenDetail(storyIssue.key)}
                />
              )
            }

            // Story with subtasks in this column — header + subtask cards
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
                {group.cards.map((card) => (
                  <TaskCard
                    key={card.id}
                    issue={card}
                    isSubtask={true}
                    onClick={() => onOpenDetail(card.key)}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* QuickCreateInput slot (plan 10-03) */}
      {children}
    </div>
  )
}

export default BoardColumn
