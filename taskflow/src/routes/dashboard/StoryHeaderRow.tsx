/**
 * StoryHeaderRow — Non-draggable story section divider for the kanban board.
 *
 * Renders the story key (monospace) and truncated summary. Used inside BoardColumn
 * to group subtasks under their parent story. The entire row is clickable, opening
 * the IssueDetailSheet for the story.
 *
 * No drag attributes — this is a purely visual divider, not a draggable card.
 */

interface StoryHeaderRowProps {
  storyKey: string
  summary: string
  onOpenDetail: (key: string) => void
}

export function StoryHeaderRow({ storyKey, summary, onOpenDetail }: StoryHeaderRowProps) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 border border-border/50 rounded-md cursor-pointer hover:bg-muted/60 transition-colors"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(storyKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpenDetail(storyKey)
      }}
    >
      <span className="font-mono text-xs text-muted-foreground shrink-0">{storyKey}</span>
      <span className="text-sm font-medium truncate">{summary}</span>
    </div>
  )
}
