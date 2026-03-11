/**
 * TaskRow — A single Jira issue row in the My Tasks list.
 *
 * Displays: issue key, summary, status badge, assignee, story points,
 * MR chips with health dots (or "no MR" placeholder), and a comment button.
 *
 * linkedMrResults comes from MyTasksTab after link engine computation (Plan 03).
 */
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JiraIssue } from '@/services/jira'
import type { GitLabMR } from '@/services/gitlab'
import type { ReviewHealth } from '@/services/linkEngine'

interface StatusBadgeProps {
  status: string
  onClick: () => void
}

function StatusBadge({ status, onClick }: StatusBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-full border border-border px-2 py-0.5 text-xs text-foreground hover:bg-accent transition-colors whitespace-nowrap"
    >
      {status}
    </button>
  )
}

const HEALTH_DOT_COLORS: Record<ReviewHealth, string> = {
  approved: 'bg-green-500',
  changes_requested: 'bg-red-500',
  waiting_for_review: 'bg-yellow-400',
}

interface TaskRowProps {
  issue: JiraIssue
  linkedMrResults: Array<{ mr: GitLabMR; health: ReviewHealth }>
  onStatusClick: (issueKey: string) => void
  onCommentClick: (issueKey: string) => void
  inlineError?: string
}

export default function TaskRow({
  issue,
  linkedMrResults,
  onStatusClick,
  onCommentClick,
  inlineError,
}: TaskRowProps) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 py-2 px-3">
        {/* Issue key */}
        <span className="w-24 flex-shrink-0 font-mono text-sm text-muted-foreground truncate">
          {issue.key}
        </span>

        {/* Summary */}
        <span className="flex-1 truncate text-sm">{issue.fields.summary}</span>

        {/* Status badge */}
        <StatusBadge
          status={issue.fields.status.name}
          onClick={() => onStatusClick(issue.key)}
        />

        {/* Assignee */}
        <span className="w-28 truncate text-sm text-muted-foreground">
          {issue.fields.assignee?.displayName ?? '—'}
        </span>

        {/* Story points */}
        <span className="w-8 text-right text-xs text-muted-foreground">
          {issue.fields.customfield_10016 ?? '—'}
        </span>

        {/* MR chips area */}
        <div className="flex items-center gap-1 min-w-[80px]">
          {linkedMrResults.length === 0 ? (
            <span className="text-xs text-muted-foreground">— no MR</span>
          ) : (
            linkedMrResults.map(({ mr, health }) => (
              <span
                key={mr.iid}
                className={cn(
                  'inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs',
                )}
              >
                MR !{mr.iid}
                <span
                  className={cn(
                    'inline-block size-1.5 rounded-full',
                    HEALTH_DOT_COLORS[health],
                  )}
                />
              </span>
            ))
          )}
        </div>

        {/* Comment button */}
        <button
          type="button"
          onClick={() => onCommentClick(issue.key)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Comment on ${issue.key}`}
        >
          <MessageCircle className="size-4" />
        </button>
      </div>

      {/* Inline error */}
      {inlineError && (
        <div className="px-3 pb-1 text-xs text-destructive">
          Failed to update — try again
        </div>
      )}
    </div>
  )
}
