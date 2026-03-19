/**
 * MergeRequestDetailPage -- Full-page route-based MR detail view at /mr/:projectId/:iid.
 *
 * Two-column layout mirroring IssueDetailPage: left column shows MR title,
 * description, commits, linked Jira issues; right sidebar shows metadata
 * in the same MetaRow pattern as IssueDetailSidebar.
 *
 * Read-only with "Open in GitLab" for actions.
 */

import { useQuery } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  ExternalLink,
  Flag,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { GitLabMRDetail, MRCommit } from '@/services/gitlab';
import { fetchMRApprovals, fetchMRCommits, fetchMRDetail } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { WikiRenderer } from './WikiRenderer';

export default function MergeRequestDetailPage() {
  const { projectId, iid } = useParams<{ projectId: string; iid: string }>();
  const navigate = useNavigate();

  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);

  const { onIssueClick } = useOutletContext<{
    onIssueClick: (key: string) => void;
  }>();

  const { gitlabBaseUrl } = useAuthStore();
  const pushRecentItem = useRecentItemsStore((s) => s.pushItem);

  const numericProjectId = projectId ? Number(projectId) : 0;
  const numericIid = iid ? Number(iid) : 0;

  // Fetch MR detail
  const { data: mr, isLoading } = useQuery({
    queryKey: ['gitlab-mr-detail', projectId, iid],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token || !gitlabBaseUrl) throw new Error('No credentials');
      return fetchMRDetail(gitlabBaseUrl, token, numericProjectId, numericIid);
    },
    staleTime: 30_000,
    enabled: !!projectId && !!iid && !!gitlabBaseUrl,
  });

  // Fetch commits
  const { data: commits } = useQuery({
    queryKey: ['gitlab-mr-commits', projectId, iid],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token || !gitlabBaseUrl) return [];
      return fetchMRCommits(gitlabBaseUrl, token, numericProjectId, numericIid);
    },
    staleTime: 30_000,
    enabled: !!projectId && !!iid && !!gitlabBaseUrl,
  });

  // Fetch approvals
  const { data: approvals } = useQuery({
    queryKey: ['gitlab-mr-approvals', projectId, iid],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token || !gitlabBaseUrl) return { approved_by: [], approved: false };
      return fetchMRApprovals(gitlabBaseUrl, token, numericProjectId, numericIid);
    },
    staleTime: 30_000,
    enabled: !!projectId && !!iid && !!gitlabBaseUrl,
  });

  // Track recent item
  useEffect(() => {
    if (iid && mr) {
      pushRecentItem({ type: 'gitlab', id: `${projectId}/${iid}`, title: mr.title });
    }
  }, [iid, mr?.title, projectId, mr, pushRecentItem]);

  // Extract linked Jira issue keys from title + branch
  const linkedJiraKeys = useMemo(() => {
    if (!mr) return [];
    const fromTitle = extractTicketKeys(mr.title);
    const fromBranch = extractTicketKeys(mr.source_branch);
    return [...new Set([...fromTitle, ...fromBranch])];
  }, [mr?.title, mr?.source_branch, mr]);

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1];
      breadcrumbPop();
      navigate(target.path, { replace: true });
    } else {
      navigate('/merge-requests');
    }
  };

  if (!projectId || !iid) return null;

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
                  useBreadcrumbStore.setState({ trail: trail.slice(0, i) });
                  navigate(entry.path, { replace: true });
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
          <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
              {/* Header — matches IssueDetailContent pattern */}
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">!{mr.iid}</p>
                <h2 className="text-xl font-semibold leading-snug">{mr.title}</h2>
              </div>

              {/* Description */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                {mr.description ? (
                  <WikiRenderer wikiText={mr.description} attachments={{}} users={{}} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description</p>
                )}
              </section>

              {/* Commits — styled like subtask list in Jira detail */}
              {commits && commits.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Commits ({commits.length})
                  </h3>
                  <ul className="space-y-1">
                    {commits.map((c) => (
                      <CommitRow key={c.id} commit={c} />
                    ))}
                  </ul>
                </section>
              )}

              {/* Linked Jira Issues — styled like linked issues in Jira sidebar */}
              {linkedJiraKeys.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Linked Jira Issues
                  </h3>
                  <div className="space-y-0.5">
                    {linkedJiraKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onIssueClick(key)}
                        className="w-full text-left rounded px-2 py-1.5 hover:bg-accent transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <span className="font-mono text-xs text-muted-foreground shrink-0">
                          {key}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Action buttons — matches Jira's Pin/Edit/Open row */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => openUrl(mr.web_url)}
                >
                  <ExternalLink className="size-3.5" />
                  Open in GitLab
                </Button>
              </div>
            </div>
          </div>

          {/* Right sidebar — matches IssueDetailSidebar MetaRow pattern */}
          <div className="w-[42%] border-l overflow-auto p-4 shrink-0">
            <div className="space-y-4 text-sm">
              {/* Status */}
              <MetaRow label="Status">
                <MRStateBadge state={mr.state} draft={mr.draft} />
              </MetaRow>

              {/* Author */}
              <MetaRow label="Author">
                <PersonDisplay name={mr.author.name} avatarUrl={mr.author.avatar_url} />
              </MetaRow>

              {/* Assignee */}
              <MetaRow label="Assignee">
                {mr.assignee ? (
                  <PersonDisplay name={mr.assignee.name} avatarUrl={mr.assignee.avatar_url} />
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </MetaRow>

              {/* Reviewers */}
              <MetaRow label="Reviewers">
                {mr.reviewers.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {mr.reviewers.map((r) => (
                      <span key={r.id} className="text-sm">
                        {r.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </MetaRow>

              {/* Approvals */}
              <MetaRow label="Approvals">
                {approvals && approvals.approved_by.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {approvals.approved_by.map((a) => (
                      <div key={a.user.id} className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3 text-green-500 shrink-0" />
                        <span className="text-sm">{a.user.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No approvals</span>
                )}
              </MetaRow>

              {/* Pipeline */}
              <MetaRow label="Pipeline">
                {mr.pipeline ? (
                  <PipelineStatus status={mr.pipeline.status} />
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </MetaRow>

              {/* Branches */}
              <MetaRow label="Branches">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <GitBranch className="size-3 text-muted-foreground shrink-0" />
                  <code
                    className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]"
                    title={mr.source_branch}
                  >
                    {mr.source_branch}
                  </code>
                  <span className="text-muted-foreground shrink-0">&#8594;</span>
                  <code
                    className="text-xs bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]"
                    title={mr.target_branch}
                  >
                    {mr.target_branch}
                  </code>
                </div>
              </MetaRow>

              {/* Conflicts */}
              {mr.has_conflicts && (
                <MetaRow label="Conflicts">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span className="font-medium">Has conflicts</span>
                  </div>
                </MetaRow>
              )}

              {/* Labels */}
              {mr.labels.length > 0 && (
                <MetaRow label="Labels">
                  <div className="flex flex-wrap gap-1">
                    {mr.labels.map((l) => (
                      <span
                        key={l.name}
                        className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: l.color,
                          color: l.text_color,
                          borderColor: `${l.color}80`,
                        }}
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                </MetaRow>
              )}

              {/* Milestone */}
              {mr.milestone && (
                <MetaRow label="Milestone">
                  <div className="flex items-center gap-1.5">
                    <Flag className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-sm">{mr.milestone.title}</span>
                    {mr.milestone.state === 'closed' && (
                      <span className="text-xs text-muted-foreground">(closed)</span>
                    )}
                  </div>
                </MetaRow>
              )}

              {/* Changes */}
              <MetaRow label="Changes">{mr.changes_count} files changed</MetaRow>

              {/* Dates */}
              <MetaRow label="Created">{new Date(mr.created_at).toLocaleDateString()}</MetaRow>
              <MetaRow label="Updated">{new Date(mr.updated_at).toLocaleDateString()}</MetaRow>
              {mr.merged_at && (
                <MetaRow label="Merged">{new Date(mr.merged_at).toLocaleDateString()}</MetaRow>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Shared layout components (matching IssueDetailSidebar) ----

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}

function PersonDisplay({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  return (
    <div className="flex items-center gap-2">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="size-5 rounded-full shrink-0" />
      ) : (
        <div className="size-5 rounded-full bg-muted shrink-0" />
      )}
      <span className="text-sm truncate">{name}</span>
    </div>
  );
}

// ---- State & status badges ----

function MRStateBadge({ state, draft }: { state: GitLabMRDetail['state']; draft?: boolean }) {
  if (draft && state === 'opened') {
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <CircleDot className="size-3" />
        Draft
      </Badge>
    );
  }

  const config: Record<string, { className: string; label: string; icon: React.ReactNode }> = {
    opened: {
      className:
        'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
      label: 'Open',
      icon: <CircleDot className="size-3" />,
    },
    merged: {
      className:
        'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
      label: 'Merged',
      icon: <CheckCircle2 className="size-3" />,
    },
    closed: {
      className:
        'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
      label: 'Closed',
      icon: <XCircle className="size-3" />,
    },
    locked: {
      className:
        'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800',
      label: 'Locked',
      icon: <Ban className="size-3" />,
    },
  };

  const c = config[state] ?? config.locked;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.className}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function PipelineStatus({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ReactNode }> = {
    success: {
      className: 'text-green-700 dark:text-green-400',
      icon: <CheckCircle2 className="size-3.5" />,
    },
    failed: {
      className: 'text-red-700 dark:text-red-400',
      icon: <XCircle className="size-3.5" />,
    },
    running: {
      className: 'text-blue-700 dark:text-blue-400',
      icon: <Loader2 className="size-3.5 animate-spin" />,
    },
    pending: {
      className: 'text-yellow-700 dark:text-yellow-400',
      icon: <Clock className="size-3.5" />,
    },
    canceled: {
      className: 'text-muted-foreground',
      icon: <Ban className="size-3.5" />,
    },
  };

  const c = config[status] ?? config.canceled;
  return (
    <div className={`flex items-center gap-1.5 ${c.className}`}>
      {c.icon}
      <span className="text-sm font-medium capitalize">{status}</span>
    </div>
  );
}

// ---- Commit row (matches subtask row styling from IssueDetailContent) ----

function CommitRow({ commit }: { commit: MRCommit }) {
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 text-sm">
      <GitCommitHorizontal className="size-3.5 text-muted-foreground shrink-0" />
      <code className="text-xs text-muted-foreground font-mono shrink-0">
        {commit.id.slice(0, 8)}
      </code>
      <span className="truncate">{commit.title}</span>
    </li>
  );
}

// ---- Skeleton ----

function MRDetailSkeleton() {
  return (
    <div data-testid="mr-detail-skeleton" className="flex h-full p-6 gap-6">
      <div className="flex-1 space-y-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="w-[42%] space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    </div>
  );
}
