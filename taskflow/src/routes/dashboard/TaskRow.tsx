/**
 * TaskRow — A single Jira issue row in the My Tasks list.
 *
 * Displays: issue key, summary, status popover, assignee, story points,
 * MR chips with health dots (or "no MR" placeholder), and a comment button.
 *
 * linkedMrResults comes from MyTasksTab after link engine computation (Plan 03).
 */
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JiraIssue } from '@/services/jira'
import { fetchComments } from '@/services/jira'
import type { GitLabMR } from '@/services/gitlab'
import type { ReviewHealth } from '@/services/linkEngine'
import { useSettingsStore } from '@/stores/settings.store'
import StatusPopover from './StatusPopover'
import InlineComment from './InlineComment'

const HEALTH_DOT_COLORS: Record<ReviewHealth, string> = {
  approved: 'bg-green-500',
  changes_requested: 'bg-red-500',
  waiting_for_review: 'bg-yellow-400',
}

interface TaskRowProps {
  issue: JiraIssue
  linkedMrResults: Array<{ mr: GitLabMR; health: ReviewHealth }>
  jiraBaseUrl: string
  jiraToken: string
  onTransitionSelect: (issueKey: string, transitionId: string, toStatusName: string) => void
  onCommentSubmit: (issueKey: string, comment: string) => void
  isTransitionPending?: boolean
  isCommentPending?: boolean
  transitionError?: string
  commentError?: string
  isSubtask?: boolean
  notMine?: boolean
  onIssueClick?: (issueKey: string) => void
}

export default function TaskRow({
  issue,
  linkedMrResults,
  jiraBaseUrl,
  jiraToken,
  onTransitionSelect,
  onCommentSubmit,
  isTransitionPending,
  isCommentPending,
  transitionError,
  commentError,
  isSubtask = false,
  notMine = false,
  onIssueClick,
}: TaskRowProps) {
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentCount, setCommentCount] = useState<number | null>(null)
  const { storyPointsFieldKey } = useSettingsStore()

  const { data: comments, isLoading: isLoadingComments } = useQuery({
    queryKey: ['jira-comments', issue.key],
    queryFn: () => fetchComments(jiraBaseUrl ?? '', jiraToken ?? '', issue.key),
    staleTime: 60_000,
    enabled: commentOpen && !!jiraBaseUrl && !!jiraToken,
  })

  useEffect(() => {
    if (comments) {
      setCommentCount(comments.length)
    }
  }, [comments])

  return (
    <div className={cn(
      'border-b border-border last:border-b-0',
      isSubtask && !notMine && 'ml-6 border-l-2 border-l-primary/50 bg-primary/5',
      isSubtask && notMine && 'ml-6 border-l-2 border-l-muted-foreground/15 bg-muted/20 opacity-40',
    )}>
      <div className="flex items-center gap-2 py-2 density-compact:py-1 density-comfortable:py-3 px-3">
        {/* Issue key */}
        <span className="w-28 flex-shrink-0 font-mono text-sm text-muted-foreground truncate">
          {isSubtask && <span className="mr-1 text-muted-foreground/40">↳</span>}
          {issue.key}
        </span>

        {/* Summary — clickable to open IssueDetailSheet */}
        <button
          type="button"
          onClick={() => onIssueClick?.(issue.key)}
          className={cn(
            'flex-1 truncate text-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded',
            notMine && 'italic text-muted-foreground',
          )}
        >
          {issue.fields.summary}
        </button>

        {/* Status popover */}
        <StatusPopover
          issueKey={issue.key}
          currentStatus={issue.fields.status.name}
          jiraBaseUrl={jiraBaseUrl}
          token={jiraToken}
          onSelect={(transitionId, toStatusName) =>
            onTransitionSelect(issue.key, transitionId, toStatusName)
          }
          disabled={isTransitionPending}
        />

        {/* Assignee */}
        <span className="w-28 truncate text-sm text-muted-foreground">
          {issue.fields.assignee?.displayName ?? '—'}
        </span>

        {/* Story points */}
        <span className="w-8 text-right text-xs text-muted-foreground">
          {(issue.fields[storyPointsFieldKey] as number | null | undefined) ?? '—'}
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
          onClick={() => setCommentOpen((prev) => !prev)}
          className="relative text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Comment on ${issue.key}`}
        >
          <MessageCircle className="size-4" />
          {commentCount !== null && commentCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
              {commentCount > 99 ? '99+' : commentCount}
            </span>
          )}
        </button>
      </div>

      {/* Inline comment composer */}
      <InlineComment
        issueKey={issue.key}
        isOpen={commentOpen}
        onCancel={() => setCommentOpen(false)}
        onSubmit={(comment) => {
            onCommentSubmit(issue.key, comment)
            setCommentOpen(false)
          }}
        isSubmitting={!!isCommentPending}
        error={commentError}
        existingComments={comments}
        isLoadingComments={isLoadingComments}
      />

      {/* Transition inline error */}
      {transitionError && (
        <div className="px-3 pb-1 text-xs text-destructive">
          {transitionError}
        </div>
      )}
    </div>
  )
}
