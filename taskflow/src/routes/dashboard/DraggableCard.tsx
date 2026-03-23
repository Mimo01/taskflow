/**
 * DraggableCard -- wraps TaskCard with @dnd-kit/core useDraggable.
 *
 * The drag wrapper captures pointer events for drag detection (>5px threshold).
 * Click (pointer-up without movement) is forwarded directly to TaskCard's onClick
 * prop -- NOT placed on the wrapper div -- so click and drag don't conflict.
 *
 * Opacity is set to 0.4 while this card is the active drag source, giving
 * the user a "ghost left behind" visual cue.
 *
 * Phase 33: Added multi-select checkbox overlay. When any card is selected,
 * drag-and-drop is disabled on selected cards to avoid accidental moves.
 */
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { JiraIssue } from '@/services/jira';
import TaskCard from './TaskCard';

interface DraggableCardProps {
  issue: JiraIssue;
  isSubtask?: boolean;
  showStatus?: boolean;
  onOpenDetail: (key: string) => void;
  // Phase 33 additions:
  isSelected?: boolean;
  hasAnySelection?: boolean;
  onToggleSelect?: (key: string, shiftKey: boolean) => void;
}

export default function DraggableCard({
  issue,
  isSubtask,
  showStatus,
  onOpenDetail,
  isSelected,
  hasAnySelection,
  onToggleSelect,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.key,
    data: { issueKey: issue.key, currentStatusId: issue.fields.status.id },
    disabled: isSelected,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.4 : 1,
      }}
      className="relative group"
      {...listeners}
      {...attributes}
    >
      {/* Multi-select checkbox overlay */}
      <input
        type="checkbox"
        checked={isSelected ?? false}
        aria-label={`${issue.key} - select for bulk action`}
        className={[
          'absolute top-2 left-2 z-10 size-4 cursor-pointer accent-primary',
          hasAnySelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        ].join(' ')}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.(issue.key, e.shiftKey);
        }}
        onChange={() => {
          // Handled by onClick to capture shiftKey
        }}
      />
      <TaskCard
        issue={issue}
        isSubtask={isSubtask}
        showStatus={showStatus}
        onClick={() => onOpenDetail(issue.key)}
      />
    </div>
  );
}
