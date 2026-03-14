import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '@/stores/settings.store'

interface EpicDetailSheetProps {
  epicKey: string | null
  onClose: () => void
  onOpenIssue: (key: string) => void
}

export function EpicDetailSheet({ epicKey, onClose, onOpenIssue }: EpicDetailSheetProps) {
  if (!epicKey) return null

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="p-0 flex flex-col overflow-hidden"
        style={{ width: '85vw', maxWidth: '85vw' }}>
        <EpicDetailBody epicKey={epicKey} onOpenIssue={onOpenIssue} />
      </SheetContent>
    </Sheet>
  )
}

function EpicDetailBody({ epicKey, onOpenIssue }: { epicKey: string; onOpenIssue: (key: string) => void }) {
  const settings = useSettingsStore() as {
    jiraBaseUrl?: string
    activeJiraProject?: string
    jiraToken?: string
    storyPointsFieldKey?: string | null
  }
  const jiraBaseUrl = settings.jiraBaseUrl ?? ''
  const activeJiraProject = settings.activeJiraProject ?? ''
  const jiraToken = settings.jiraToken ?? ''
  const storyPointsFieldKey = settings.storyPointsFieldKey ?? null

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['jira-epic-stories', epicKey, jiraBaseUrl],
    queryFn: async () => {
      const { fetchEpicStories } = await import('@/services/jira')
      return fetchEpicStories(jiraBaseUrl, jiraToken, epicKey, activeJiraProject, storyPointsFieldKey ?? undefined)
    },
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Epic: {epicKey}</h2>
      </div>
      {/* Body: two columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: stories list */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Stories</h3>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && stories.length === 0 && (
            <p className="text-sm text-muted-foreground">No stories found under this epic.</p>
          )}
          <ul className="flex flex-col gap-1">
            {stories.map(story => {
              const pts = storyPointsFieldKey ? (story.fields[storyPointsFieldKey] as number | null) : null
              return (
                <li key={story.key}>
                  <button
                    type="button"
                    onClick={() => onOpenIssue(story.key)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded hover:bg-muted transition-colors"
                  >
                    <span className="text-xs text-muted-foreground shrink-0 w-20">{story.key}</span>
                    <span className="flex-1 text-sm truncate">{story.fields.summary}</span>
                    <span className="text-xs border rounded px-1.5 py-0.5 shrink-0">
                      {story.fields.status.name}
                    </span>
                    {story.fields.assignee && (
                      <span className="text-xs text-muted-foreground shrink-0 w-16 truncate">
                        {story.fields.assignee.displayName}
                      </span>
                    )}
                    {pts !== null && pts !== undefined && (
                      <span className="text-xs font-medium shrink-0 w-6 text-right">{pts}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
        {/* Right: epic metadata sidebar (minimal for MVP) */}
        <div className="w-64 shrink-0 border-l overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Details</h3>
          <p className="text-xs text-muted-foreground">Epic: {epicKey}</p>
        </div>
      </div>
    </div>
  )
}
