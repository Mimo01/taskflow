/**
 * MergeRequestListPage -- Top-level route at /merge-requests.
 *
 * Shows all MRs for the active GitLab project with state filter tabs
 * (Open/Merged/Closed/All) and text search. Clicking an MR navigates
 * to /mr/:projectId/:iid.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { GitMerge, GitBranch, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { useRecentItemsStore } from '@/stores/recent-items.store'
import { useBreadcrumbStore } from '@/stores/breadcrumb.store'
import { readSecret } from '@/services/stronghold'
import { fetchProjectMRs, searchGitLabMRs } from '@/services/gitlab'
import type { GitLabMR } from '@/services/gitlab'
import { relativeTime } from './IssueDetailContent'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { StaleDataBanner } from '@/components/ui/stale-data-banner'
import { Skeleton } from '@/components/ui/skeleton'

type StateFilter = 'opened' | 'merged' | 'closed' | 'all'

const STATE_TABS: { label: string; value: StateFilter }[] = [
  { label: 'Open', value: 'opened' },
  { label: 'Merged', value: 'merged' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: 'all' },
]

export default function MergeRequestListPage() {
  const navigate = useNavigate()
  const { gitlabBaseUrl, activeGitlabProject } = useAuthStore()
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem)
  const breadcrumbReset = useBreadcrumbStore((s) => s.reset)
  const breadcrumbPush = useBreadcrumbStore((s) => s.push)

  const [stateFilter, setStateFilter] = useState<StateFilter>('opened')
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [gitlabToken, setGitlabToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [staleDismissed, setStaleDismissed] = useState(false)

  // Load token
  useEffect(() => {
    if (gitlabBaseUrl) {
      setTokenLoading(true)
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null))
        .finally(() => setTokenLoading(false))
    } else {
      setTokenLoading(false)
    }
  }, [gitlabBaseUrl])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300)
    return () => clearTimeout(timer)
  }, [searchText])

  const projectId = activeGitlabProject
  const isSearching = debouncedSearch.trim().length > 0

  // Fetch project MRs by state
  const {
    data: mrsByState,
    isLoading: mrsLoading,
    isError: mrsError,
    error: mrsErr,
    refetch: mrsRefetch,
  } = useQuery({
    queryKey: ['gitlab-project-mrs', projectId, stateFilter],
    queryFn: () => fetchProjectMRs(gitlabBaseUrl!, gitlabToken!, projectId!, stateFilter),
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!projectId && !isSearching,
  })

  // Search MRs
  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
    error: searchErr,
  } = useQuery({
    queryKey: ['gitlab-search-mrs', debouncedSearch],
    queryFn: () => searchGitLabMRs(gitlabBaseUrl!, gitlabToken!, debouncedSearch),
    staleTime: 30_000,
    enabled: !!gitlabBaseUrl && !!gitlabToken && isSearching,
  })

  const mrs: GitLabMR[] = isSearching ? (searchResults ?? []) : (mrsByState ?? [])
  const isLoading = tokenLoading || (isSearching ? searchLoading : mrsLoading)
  const isError = isSearching ? searchError : mrsError
  const error = isSearching ? searchErr : mrsErr

  const handleMRClick = (mr: GitLabMR) => {
    breadcrumbReset()
    breadcrumbPush({ path: '/merge-requests', label: 'Merge Requests' })
    pushRecentItem({ type: 'gitlab', id: `${mr.project_id}/${mr.iid}`, title: mr.title })
    navigate(`/mr/${mr.project_id}/${mr.iid}`)
  }

  // Three-state detection
  const showError = isError && mrs.length === 0
  const showStale = isError && mrs.length > 0
  const showEmpty = !isError && !isLoading && mrs.length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          <GitMerge className="size-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Merge Requests</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* State filter tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            {STATE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStateFilter(tab.value)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  stateFilter === tab.value
                    ? 'bg-background shadow-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search MRs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {showStale && !staleDismissed && (
          <StaleDataBanner onRetry={() => { setStaleDismissed(false); mrsRefetch(); }} onDismiss={() => setStaleDismissed(true)} />
        )}

        {isLoading ? (
          <MRListSkeleton />
        ) : showError ? (
          <ErrorState error={error as Error} onRetry={() => mrsRefetch()} viewName="Merge Requests" />
        ) : showEmpty ? (
          <EmptyState
            icon={GitMerge}
            title="No merge requests"
            subtitle={isSearching ? 'Try a different search term' : `No ${stateFilter === 'all' ? '' : stateFilter} merge requests found`}
          />
        ) : (
          <div className="divide-y">
            {mrs.map((mr) => (
              <button
                key={mr.id}
                type="button"
                onClick={() => handleMRClick(mr)}
                className="w-full text-left px-6 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-muted-foreground shrink-0">!{mr.iid}</span>
                    <MRStateBadge state={mr.state} />
                    <span className="text-sm font-medium truncate">{mr.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <img src={mr.author.avatar_url} alt="" className="size-4 rounded-full shrink-0" />
                    <span className="shrink-0">{mr.author.name}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <GitBranch className="size-3 shrink-0 opacity-50" />
                    <code className="text-xs truncate">{mr.source_branch}</code>
                    <span className="text-muted-foreground/50">·</span>
                    <span className="shrink-0">{relativeTime(mr.updated_at)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const STATE_LABELS: Record<string, string> = {
  opened: 'Open',
  merged: 'Merged',
  closed: 'Closed',
  locked: 'Locked',
}

function MRStateBadge({ state }: { state: GitLabMR['state'] }) {
  const colors: Record<string, string> = {
    opened: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    merged: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    closed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    locked: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${colors[state] ?? colors.locked}`}>
      {STATE_LABELS[state] ?? state}
    </span>
  )
}

function MRListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-6 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}
