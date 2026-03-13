import type { JiraIssueDetail } from '@/services/jira'
import { WikiRenderer } from './WikiRenderer'
import { Badge } from '@/components/ui/badge'

interface IssueDetailContentProps {
  issue: JiraIssueDetail
  issueKey: string
  jiraBaseUrl: string
  onOpenIssue?: (key: string) => void
  storyPointsFieldKey: string
  sprintFieldKey: string
  epicLinkFieldKey: string
}

export function IssueDetailContent({ issue, onOpenIssue }: IssueDetailContentProps) {
  const { summary, description, subtasks } = issue.fields

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

      {/* Comment thread placeholder — filled in plan 07 */}
      <section id="comments-section" />
    </div>
  )
}
