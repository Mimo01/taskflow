/**
 * TaskCard — Compact Jira issue card for the Sprint Board view.
 *
 * Shows issue key, summary (2-line clamp), assignee avatar (or initials),
 * and a health dot slot (gray if undefined, colored if Plan 03 provides health).
 *
 * Extended props (HIER-02):
 * - subtaskCount: when > 0, renders a Badge chip and chevron toggle button
 * - isExpanded: controls chevron direction (down vs right)
 * - onToggle: called when chevron is clicked (stopPropagation included)
 * - isSubtask: adds left indent and muted left border for visual nesting
 */
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { JiraIssue } from '@/services/jira'
import type { ReviewHealth } from '@/services/linkEngine'

const HEALTH_COLORS: Record<ReviewHealth, string> = {
  approved: 'bg-green-500',
  changes_requested: 'bg-red-500',
  waiting_for_review: 'bg-amber-400',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface TaskCardProps {
  issue: JiraIssue
  healthDot?: ReviewHealth
  subtaskCount?: number
  isExpanded?: boolean
  onToggle?: () => void
  isSubtask?: boolean
}

export default function TaskCard({ issue, healthDot, subtaskCount, isExpanded, onToggle, isSubtask }: TaskCardProps) {
  const assignee = issue.fields.assignee
  const avatarUrl = assignee?.avatarUrls['48x48']
  const displayName = assignee?.displayName ?? ''

  const dotColor = healthDot ? HEALTH_COLORS[healthDot] : 'bg-muted-foreground/40'

  return (
    <div className={cn('border rounded-lg p-2 bg-card w-full flex flex-col gap-1', isSubtask && 'ml-4 border-l-2 border-l-muted')}>
      {/* Issue key */}
      <div className="text-xs font-mono text-muted-foreground">{issue.key}</div>

      {/* Summary — max 2 lines */}
      <div
        className="text-sm overflow-hidden"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {issue.fields.summary}
      </div>

      {/* Bottom row: assignee avatar + health dot */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center">
          {assignee ? (
            avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="size-5 rounded-full"
                onError={(e) => {
                  // Fallback to initials on broken image
                  const target = e.currentTarget
                  target.style.display = 'none'
                  const sibling = target.nextElementSibling as HTMLElement | null
                  if (sibling) sibling.style.display = 'flex'
                }}
              />
            ) : null
          ) : null}
          {assignee && (
            <div
              className={cn(
                'size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium',
                avatarUrl ? 'hidden' : 'flex',
              )}
            >
              {getInitials(displayName)}
            </div>
          )}
        </div>

        {/* Health dot */}
        <span className={cn('inline-block size-1.5 rounded-full', dotColor)} />
      </div>

      {/* Subtask count chip + chevron — only when subtaskCount > 0 */}
      {subtaskCount != null && subtaskCount > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle?.() }}
          className="flex items-center gap-1 p-1 -mx-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          <Badge variant="secondary" className="text-xs py-0 pointer-events-none">
            {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}
          </Badge>
          {isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>
      )}
    </div>
  )
}
