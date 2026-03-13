import type { JiraIssueDetail } from '@/services/jira'
import { WikiRenderer } from './WikiRenderer'
import { CommentComposer } from './CommentComposer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'

interface IssueDetailContentProps {
  issue: JiraIssueDetail
  issueKey: string
  jiraBaseUrl: string
  onOpenIssue?: (key: string) => void
  storyPointsFieldKey: string
  sprintFieldKey: string
  epicLinkFieldKey: string
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (diffSecs < 60) return rtf.format(-diffSecs, 'second')
  if (diffSecs < 3600) return rtf.format(-Math.floor(diffSecs / 60), 'minute')
  if (diffSecs < 86400) return rtf.format(-Math.floor(diffSecs / 3600), 'hour')
  return rtf.format(-Math.floor(diffSecs / 86400), 'day')
}

export function IssueDetailContent({ issue, issueKey, jiraBaseUrl, onOpenIssue }: IssueDetailContentProps) {
  const { summary, description, subtasks } = issue.fields
  const comments = issue.fields.comment?.comments ?? []

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <p className="text-xs font-mono text-muted-foreground mb-1">{issue.key}</p>
        <h2 className="text-xl font-semibold leading-snug">{summary}</h2>
      </div>

      {/* Description */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
        {description ? (
          <WikiRenderer wikiText={description} />
        ) : (
          <p className="text-sm text-muted-foreground italic">No description</p>
        )}
      </section>

      {/* Subtasks */}
      {subtasks && subtasks.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Subtasks ({subtasks.length})
          </h3>
          <ul className="space-y-1">
            {subtasks.map((sub) => (
              <li key={sub.id}>
                <button
                  type="button"
                  onClick={() => onOpenIssue?.(sub.key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left"
                >
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{sub.key}</span>
                  <span className="flex-1 truncate">{sub.fields.summary}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{sub.fields.status.name}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Open in Jira */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openUrl(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`).catch(() => {})}
          className="gap-1.5 text-xs"
        >
          <ExternalLink className="size-3.5" />
          Open in Jira
        </Button>
      </div>

      {/* Comment thread */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Comments ({comments.length})
        </h3>

        {/* Compose box */}
        <CommentComposer issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />

        {/* Thread — newest first */}
        <div className="mt-4 space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No comments yet</p>
          ) : (
            [...comments].reverse().map(comment => (
              <div key={comment.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.author.displayName}</span>
                  <span>•</span>
                  <span>{relativeTime(comment.created)}</span>
                </div>
                <WikiRenderer wikiText={comment.body} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
