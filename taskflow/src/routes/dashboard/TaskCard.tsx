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
import { epicColorToTailwind } from '@/lib/epicColors'

const HEALTH_COLORS: Record<ReviewHealth, string> = {
  approved: 'bg-green-500',
  changes_requested: 'bg-red-500',
  waiting_for_review: 'bg-amber-400',
}

const STATUS_CATEGORY_STYLES: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  indeterminate: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
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
  showStatus?: boolean
  onClick?: () => void
  epicKey?: string | null
  epicColor?: string | null
}

export default function TaskCard({ issue, healthDot, subtaskCount, isExpanded, onToggle, isSubtask, showStatus, onClick, epicKey, epicColor }: TaskCardProps) {
  const assignee = issue.fields.assignee
  const avatarUrl = assignee?.avatarUrls['48x48']
  const displayName = assignee?.displayName ?? ''

  const dotColor = healthDot ? HEALTH_COLORS[healthDot] : 'bg-muted-foreground/40'

  return (
    <div
      className={cn(
        'border rounded-lg px-2 py-2 density-compact:py-1 density-comfortable:py-3 bg-card w-full flex flex-col gap-1 cursor-pointer hover:border-primary/50 transition-colors',
        isSubtask && 'ml-4 border-l-2 border-l-muted',
      )}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
    >
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

      {/* Epic badge -- colored pill with epic key */}
      {epicKey && (() => {
        const colorResult = epicColorToTailwind(epicColor ?? null, epicKey)
        return (
          <span
            className={cn(
              'self-start inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium truncate max-w-full',
              colorResult.className,
            )}
            style={colorResult.style}
          >
            {epicKey}
          </span>
        )
      })()}

      {/* Status badge -- shown when not in a column context */}
      {showStatus && (
        <span className={cn(
          'self-start rounded px-1.5 py-0.5 text-xs font-medium',
          STATUS_CATEGORY_STYLES[issue.fields.status.statusCategory?.key ?? 'new'] ?? STATUS_CATEGORY_STYLES.new,
        )}>
          {issue.fields.status.name}
        </span>
      )}

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
