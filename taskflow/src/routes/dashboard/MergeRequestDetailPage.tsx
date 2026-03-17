/**
 * MergeRequestDetailPage -- Full-page route-based MR detail view at /mr/:projectId/:iid.
 *
 * Two-column layout mirroring IssueDetailPage: left column shows MR title,
 * description, commits, linked Jira issues; right sidebar shows status, author,
 * reviewers, labels, pipeline, branches, dates.
 *
 * Read-only with "Open in GitLab" for actions.
 */
import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, GitBranch, AlertTriangle } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useAuthStore } from '@/stores/auth.store'
import { useRecentItemsStore } from '@/stores/recent-items.store'
import { useBreadcrumbStore } from '@/stores/breadcrumb.store'
import { readSecret } from '@/services/stronghold'
import { fetchMRDetail, fetchMRCommits, fetchMRApprovals } from '@/services/gitlab'
import type { GitLabMRDetail } from '@/services/gitlab'
import { extractTicketKeys } from '@/services/linkEngine'
import { relativeTime } from './IssueDetailContent'
import { WikiRenderer } from './WikiRenderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function MergeRequestDetailPage() {
  const { projectId, iid } = useParams<{ projectId: string; iid: string }>()
  const navigate = useNavigate()

  const trail = useBreadcrumbStore((s) => s.trail)
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop)

  const { onIssueClick } = useOutletContext<{
    onIssueClick: (key: string) => void
  }>()

  const { gitlabBaseUrl } = useAuthStore()
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem)

  const numericProjectId = projectId ? Number(projectId) : 0
  const numericIid = iid ? Number(iid) : 0

  // Fetch MR detail
  const { data: mr, isLoading } = useQuery({
    queryKey: ['gitlab-mr-detail', projectId, iid],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null)
      if (!token || !gitlabBaseUrl) throw new Error('No credentials')
      return fetchMRDetail(gitlabBaseUrl, token, numericProjectId, numericIid)
    },
    staleTime: 30_000,
    enabled: !!projectId && !!iid && !!gitlabBaseUrl,
  })

  // Fetch commits
  const { data: commits } = useQuery({
    queryKey: ['gitlab-mr-commits', projectId, iid],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null)
      if (!token || !gitlabBaseUrl) return []
      return fetchMRCommits(gitlabBaseUrl, token, numericProjectId, numericIid)
    },
    staleTime: 30_000,
    enabled: !!projectId && !!iid && !!gitlabBaseUrl,
  })

  // Fetch approvals
  const { data: approvals } = useQuery({
    queryKey: ['gitlab-mr-approvals', projectId, iid],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null)
      if (!token || !gitlabBaseUrl) return { approved_by: [], approved: false }
      return fetchMRApprovals(gitlabBaseUrl, token, numericProjectId, numericIid)
    },
    staleTime: 30_000,
    enabled: !!projectId && !!iid && !!gitlabBaseUrl,
  })

  // Track recent item
  useEffect(() => {
    if (iid && mr) {
      pushRecentItem({ type: 'gitlab', id: `${projectId}/${iid}`, title: mr.title })
    }
  }, [iid, mr?.title])

  // Extract linked Jira issue keys from title + branch
  const linkedJiraKeys = useMemo(() => {
    if (!mr) return []
    const fromTitle = extractTicketKeys(mr.title)
    const fromBranch = extractTicketKeys(mr.source_branch)
    return [...new Set([...fromTitle, ...fromBranch])]
  }, [mr?.title, mr?.source_branch])

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1]
      breadcrumbPop()
      navigate(target.path, { replace: true })
    } else {
      navigate('/merge-requests')
    }
  }

  if (!projectId || !iid) return null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back + breadcrumb header */}
      {trail.length > 0 && (
        <div className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="size-4" />
          </button>
          {trail.map((entry, i) => (
            <span key={entry.path} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                type="button"
                onClick={() => {
                  useBreadcrumbStore.setState({ trail: trail.slice(0, i) })
                  navigate(entry.path, { replace: true })
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {entry.label}
              </button>
            </span>
          ))}
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">!{iid}</span>
        </div>
      )}

      {/* MR detail body */}
      {isLoading || !mr ? (
        <MRDetailSkeleton />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left column */}
          <div className="flex-1 overflow-auto p-6 space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-muted-foreground">!{mr.iid}</span>
                <MRStateBadge state={mr.state} />
                {mr.draft && (
                  <Badge variant="outline" className="text-xs">Draft</Badge>
                )}
              </div>
              <h1 className="text-xl font-semibold">{mr.title}</h1>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => openUrl(mr.web_url)}
              >
                <ExternalLink className="size-3.5" />
                Open in GitLab
              </Button>
            </div>

            {/* Description */}
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Description</h2>
              {mr.description ? (
                <WikiRenderer wikiText={mr.description} attachments={{}} users={{}} />
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided</p>
              )}
            </section>

            {/* Commits */}
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                Commits ({commits?.length ?? 0})
              </h2>
              {commits && commits.length > 0 ? (
                <ul className="space-y-1.5">
                  {commits.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-sm">
                      <code className="text-xs text-muted-foreground font-mono shrink-0 mt-0.5">
                        {c.id.slice(0, 8)}
                      </code>
                      <span>{c.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">No commits</p>
              )}
            </section>

            {/* Linked Jira Issues */}
            <section>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Linked Jira Issues</h2>
              {linkedJiraKeys.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {linkedJiraKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onIssueClick(key)}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No linked Jira issues</p>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <div className="w-[42%] border-l overflow-auto p-4 shrink-0 space-y-4">
            {/* Status */}
            <SidebarField label="Status">
              <MRStateBadge state={mr.state} />
            </SidebarField>

            {/* Author */}
            <SidebarField label="Author">
              <div className="flex items-center gap-2">
                <img src={mr.author.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                <span className="text-sm">{mr.author.name}</span>
              </div>
            </SidebarField>

            {/* Assignee */}
            <SidebarField label="Assignee">
              {mr.assignee ? (
                <div className="flex items-center gap-2">
                  <img src={mr.assignee.avatar_url} alt="" className="h-6 w-6 rounded-full" />
                  <span className="text-sm">{mr.assignee.name}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </SidebarField>

            {/* Reviewers */}
            <SidebarField label="Reviewers">
              {mr.reviewers.length > 0 ? (
                <div className="space-y-1">
                  {mr.reviewers.map((r) => (
                    <span key={r.id} className="text-sm block">{r.name}</span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
            </SidebarField>

            {/* Approvals */}
            <SidebarField label="Approvals">
              {approvals && approvals.approved_by.length > 0 ? (
                <span className="text-sm">
                  Approved by: {approvals.approved_by.map((a) => a.user.name).join(', ')}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">No approvals</span>
              )}
            </SidebarField>

            {/* Labels */}
            {mr.labels.length > 0 && (
              <SidebarField label="Labels">
                <div className="flex flex-wrap gap-1">
                  {mr.labels.map((l) => (
                    <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                  ))}
                </div>
              </SidebarField>
            )}

            {/* Pipeline */}
            {mr.pipeline && (
              <SidebarField label="Pipeline">
                <PipelineBadge status={mr.pipeline.status} />
              </SidebarField>
            )}

            {/* Branches */}
            <SidebarField label="Branches">
              <div className="flex items-center gap-1.5 text-sm">
                <GitBranch className="size-3.5 text-muted-foreground shrink-0" />
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{mr.source_branch}</code>
                <span className="text-muted-foreground">&#8594;</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{mr.target_branch}</code>
              </div>
            </SidebarField>

            {/* Conflicts */}
            {mr.has_conflicts && (
              <SidebarField label="Conflicts">
                <div className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="size-3.5" />
                  <span className="text-sm font-medium">Has conflicts</span>
                </div>
              </SidebarField>
            )}

            {/* Changes */}
            <SidebarField label="Changes">
              <span className="text-sm">{mr.changes_count} files changed</span>
            </SidebarField>

            {/* Dates */}
            <SidebarField label="Created">
              <span className="text-sm">{relativeTime(mr.created_at)}</span>
            </SidebarField>

            <SidebarField label="Updated">
              <span className="text-sm">{relativeTime(mr.updated_at)}</span>
            </SidebarField>

            {mr.merged_at && (
              <SidebarField label="Merged">
                <span className="text-sm">{relativeTime(mr.merged_at)}</span>
              </SidebarField>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Helper components ----

function SidebarField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  )
}

function MRStateBadge({ state }: { state: GitLabMRDetail['state'] }) {
  const colors: Record<string, string> = {
    opened: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    merged: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    closed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    locked: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[state] ?? colors.locked}`}>
      {state}
    </span>
  )
}

function PipelineBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? colors.canceled}`}>
      {status}
    </span>
  )
}

function MRDetailSkeleton() {
  return (
    <div data-testid="mr-detail-skeleton" className="flex h-full p-6 gap-6">
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
