/**
 * DraggableCard — wraps TaskCard with @dnd-kit/core useDraggable.
 *
 * The drag wrapper captures pointer events for drag detection (>5px threshold).
 * Click (pointer-up without movement) is forwarded directly to TaskCard's onClick
 * prop — NOT placed on the wrapper div — so click and drag don't conflict.
 *
 * Opacity is set to 0.4 while this card is the active drag source, giving
 * the user a "ghost left behind" visual cue.
 */
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import TaskCard from './TaskCard'
import type { JiraIssue } from '@/services/jira'

interface DraggableCardProps {
  issue: JiraIssue
  isSubtask?: boolean
  onOpenDetail: (key: string) => void
}

export default function DraggableCard({ issue, isSubtask, onOpenDetail }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.key,
    data: { issueKey: issue.key, currentStatusId: issue.fields.status.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.4 : 1,
      }}
      {...listeners}
      {...attributes}
    >
      <TaskCard
        issue={issue}
        isSubtask={isSubtask}
        onClick={() => onOpenDetail(issue.key)}
      />
    </div>
  )
}
