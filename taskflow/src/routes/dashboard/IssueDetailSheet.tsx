import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { readSecret } from '@/services/stronghold'
import { fetchIssueDetail, type JiraIssueDetail } from '@/services/jira'
import { IssueDetailContent } from './IssueDetailContent'
import { IssueDetailSidebar } from './IssueDetailSidebar'
import { Skeleton } from '@/components/ui/skeleton'

interface IssueDetailSheetProps {
  issueKey: string | null
  onClose: () => void
  onOpenIssue?: (key: string) => void
}

export function IssueDetailSheet({ issueKey, onClose, onOpenIssue }: IssueDetailSheetProps) {
  return (
    <Sheet open={issueKey !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-[70vw] max-w-none sm:max-w-none p-0 flex flex-col overflow-hidden">
        {issueKey && (
          <IssueDetailBody
            data-testid="sheet-open"
            issueKey={issueKey}
            onClose={onClose}
            onOpenIssue={onOpenIssue}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function IssueDetailBody({
  issueKey,
  onClose,
  onOpenIssue,
}: {
  'data-testid'?: string
  issueKey: string
  onClose: () => void
  onOpenIssue?: (key: string) => void
}) {
  const { jiraBaseUrl, jiraConnected } = useAuthStore()
  const { epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, storyPointsFieldKey } = useSettingsStore()

  const { data: issue, isLoading } = useQuery({
    queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl) throw new Error('No credentials')
      return fetchIssueDetail(jiraBaseUrl, token, issueKey, {
        epicLinkFieldKey,
        epicNameFieldKey,
        sprintFieldKey,
        storyPointsFieldKey,
      })
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  })

  if (isLoading || !issue) {
    return <IssueDetailSkeleton data-testid="issue-detail-skeleton" />
  }

  return (
    <div data-testid="issue-detail-body" className="flex h-full overflow-hidden">
      {/* Left column: ~60% */}
      <div className="flex-1 overflow-auto p-6">
        <IssueDetailContent
          issue={issue}
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl!}
          onOpenIssue={onOpenIssue}
          storyPointsFieldKey={storyPointsFieldKey}
          sprintFieldKey={sprintFieldKey}
          epicLinkFieldKey={epicLinkFieldKey}
        />
      </div>
      {/* Right sidebar: ~40% */}
      <div className="w-[38%] border-l overflow-auto p-4 shrink-0">
        <IssueDetailSidebar
          issue={issue}
          issueKey={issueKey}
          jiraBaseUrl={jiraBaseUrl!}
          storyPointsFieldKey={storyPointsFieldKey}
          epicLinkFieldKey={epicLinkFieldKey}
          epicNameFieldKey={epicNameFieldKey}
          sprintFieldKey={sprintFieldKey}
        />
      </div>
    </div>
  )
}

function IssueDetailSkeleton({ 'data-testid': testId }: { 'data-testid'?: string }) {
  return (
    <div data-testid={testId ?? 'issue-detail-skeleton'} className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="w-[38%] space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  )
}
