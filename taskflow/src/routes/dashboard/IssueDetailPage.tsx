/**
 * IssueDetailPage -- Full-page route-based issue detail view at /issue/:key.
 *
 * Replaces the old IssueDetailSheet (75vw slide-out panel) with a proper
 * route component that fills the main content area. Back arrow + breadcrumb
 * navigation shows the origin page and provides one-click return.
 *
 * Reads issueKey from route params. Origin page info comes via
 * location.state.from (set by handleIssueClick in main.tsx).
 */
import { useEffect } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store'
import { useRecentItemsStore } from '@/stores/recent-items.store'
import { readSecret } from '@/services/stronghold'
import { fetchIssueDetail, fetchEpicStories } from '@/services/jira'
import type { JiraIssue } from '@/services/jira'
import { IssueDetailContent } from './IssueDetailContent'
import { IssueDetailSidebar } from './IssueDetailSidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useBreadcrumbStore } from '@/stores/breadcrumb.store'
import type { EditInitialValues } from './CreateEditIssueModal'

export default function IssueDetailPage() {
  const { key: issueKey } = useParams<{ key: string }>()
  const navigate = useNavigate()

  const trail = useBreadcrumbStore((s) => s.trail)
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop)

  const { onIssueClick, openEdit, openAddSubtask } = useOutletContext<{
    onIssueClick: (key: string) => void
    openEdit: (vals: EditInitialValues) => void
    openAddSubtask: (parentKey: string) => void
  }>()

  // Auth + settings
  const { jiraBaseUrl, jiraConnected } = useAuthStore()
  const { epicLinkFieldKey, epicNameFieldKey, sprintFieldKey, storyPointsFieldKey } = useSettingsStore()

  // Pinned state
  const isPinned = usePinnedTabsStore((s) => issueKey ? s.pinnedKeys.includes(issueKey) : false)
  const togglePin = usePinnedTabsStore((s) => s.togglePin)

  // Recent items
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem)

  // Fetch issue detail
  const { data: issue, isLoading } = useQuery({
    queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl) throw new Error('No credentials')
      return fetchIssueDetail(jiraBaseUrl, token, issueKey!, {
        epicLinkFieldKey,
        epicNameFieldKey,
        sprintFieldKey,
        storyPointsFieldKey,
      })
    },
    staleTime: 30_000,
    enabled: !!issueKey && !!jiraBaseUrl && !!jiraConnected,
  })

  const isEpic = issue?.fields.issuetype.name === 'Epic'

  const { data: epicStories } = useQuery<JiraIssue[]>({
    queryKey: ['jira-epic-stories', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null)
      if (!token || !jiraBaseUrl) return []
      return fetchEpicStories(jiraBaseUrl, token, issueKey!, '', storyPointsFieldKey)
    },
    staleTime: 30_000,
    enabled: isEpic && !!jiraBaseUrl && !!jiraConnected,
  })

  // Track recent item when issue data is available
  useEffect(() => {
    if (issueKey && issue) {
      pushRecentItem({ type: 'jira', id: issueKey, title: issue.fields.summary })
    }
  }, [issueKey, issue?.fields.summary])

  const handleBack = () => {
    breadcrumbPop()
    navigate(-1)
  }

  if (!issueKey) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back + breadcrumb header */}
      <div className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </button>
        {trail.length > 0 ? (
          <>
            {trail.map((entry, i) => (
              <span key={`${i}-${entry.path}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                <button
                  type="button"
                  onClick={() => {
                    // Truncate trail to this entry and navigate
                    useBreadcrumbStore.setState({ trail: trail.slice(0, i) })
                    navigate(entry.path, { replace: true })
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {entry.label}
                </button>
              </span>
            ))}
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{issueKey}</span>
          </>
        ) : (
          <span className="font-medium">{issueKey}</span>
        )}
      </div>

      {/* Issue detail body */}
      {isLoading || !issue ? (
        <IssueDetailSkeleton />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left column */}
          <div className="flex-1 overflow-auto p-6">
            <IssueDetailContent
              issue={issue}
              issueKey={issueKey}
              jiraBaseUrl={jiraBaseUrl!}
              onOpenIssue={onIssueClick}
              onEdit={openEdit}
              onAddSubtask={openAddSubtask}
              storyPointsFieldKey={storyPointsFieldKey}
              sprintFieldKey={sprintFieldKey}
              epicLinkFieldKey={epicLinkFieldKey}
              epicStories={epicStories}
              isPinned={isPinned}
              onTogglePin={togglePin}
            />
          </div>
          {/* Right sidebar */}
          <div className="w-[42%] border-l overflow-auto p-4 shrink-0">
            <IssueDetailSidebar
              issue={issue}
              issueKey={issueKey}
              jiraBaseUrl={jiraBaseUrl!}
              storyPointsFieldKey={storyPointsFieldKey}
              epicLinkFieldKey={epicLinkFieldKey}
              epicNameFieldKey={epicNameFieldKey}
              sprintFieldKey={sprintFieldKey}
              onOpenIssue={onIssueClick}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function IssueDetailSkeleton() {
  return (
    <div data-testid="issue-detail-skeleton" className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="w-[42%] space-y-3">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  )
}
