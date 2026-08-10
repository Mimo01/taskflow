import { openUrl } from '@tauri-apps/plugin-opener';
import {
  AlertTriangle,
  Calendar,
  Check,
  ExternalLink,
  GitBranch,
  GitMerge,
  Pencil,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GitLabMilestone } from '@/services/gitlab';
import type { JiraFixVersion } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
import { MetaRow } from './MetaRow';
import type { BranchState } from './releaseBranch';
import type { LabelCoverage } from './releaseSummaries';

// Inline action for the sidebar meta rows. Bordered rather than ghost: a
// borderless control in a column of label/value pairs reads as text, so the
// outline is what marks it as clickable. Kept short (h-6) and icon-led so it
// still sits inside the row rhythm instead of towering over it.
function RowAction({
  children,
  onClick,
  title,
  icon: Icon = Plus,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  icon?: typeof Plus;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      title={title}
      className="h-6 gap-1 px-2 text-xs"
    >
      <Icon className="size-3 shrink-0" />
      {children}
    </Button>
  );
}

// Why an action is unavailable. Preferred over a disabled link: a dead
// control states nothing, while the reason is the only thing that helps.
function RowUnavailable({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground text-xs">{children}</span>;
}

interface ReleaseDetailSidebarProps {
  width: number;
  isDragging: boolean;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  handleHovered: boolean;
  setHandleHovered: (b: boolean) => void;
  onStartEditing: () => void;
  version: JiraFixVersion;
  gitlabMatch: ReleaseMatch;
  matchedMilestone: GitLabMilestone | null;
  branchState: BranchState;
  defaultBranch: string | null;
  onCreateBranch: () => void;
  onRetryBranchCheck: () => void;
  onCreateMilestone: () => void;
  canCreateMilestone: boolean;
  milestoneMRsLoaded: boolean;
  labelCoverage: LabelCoverage | null;
  mrStateCounts: { merged: number; opened: number; closed: number };
  hasMrs: boolean;
  hasIssues: boolean;
  issueStatusCounts: { new: number; indeterminate: number; done: number };
  hasStoryPoints: boolean;
  storyPoints: { total: number; completed: number };
}

export function ReleaseDetailSidebar({
  width,
  isDragging,
  onResizeMouseDown,
  handleHovered,
  setHandleHovered,
  onStartEditing,
  version,
  gitlabMatch,
  matchedMilestone: _matchedMilestone,
  branchState,
  defaultBranch,
  onCreateBranch,
  onRetryBranchCheck,
  onCreateMilestone,
  canCreateMilestone,
  milestoneMRsLoaded,
  labelCoverage,
  mrStateCounts,
  hasMrs,
  hasIssues,
  issueStatusCounts,
  hasStoryPoints,
  storyPoints,
}: ReleaseDetailSidebarProps) {
  return (
    <div
      className={`relative border-l overflow-auto p-4 shrink-0${isDragging ? '' : ' transition-all duration-200'}`}
      style={{ width }}
    >
      <div
        aria-hidden="true"
        onMouseDown={onResizeMouseDown}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        style={{ borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined }}
        className="absolute left-0 top-0 h-full w-3 cursor-ew-resize z-20 border-l border-border transition-colors duration-100"
      />
      {/* Read-only metadata (editing now happens in the modal below) */}
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Details</h3>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={onStartEditing}
          >
            <Pencil className="size-3" />
            Edit
          </Button>
        </div>

        <MetaRow label="Status">
          {version.released ? (
            <Badge tone="green">Released</Badge>
          ) : (
            <Badge tone="amber">Unreleased</Badge>
          )}
        </MetaRow>

        <MetaRow label="Release Date">
          {version.releaseDate ? (
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3 text-muted-foreground shrink-0" />
              {version.releaseDate}
            </span>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </MetaRow>

        <MetaRow label="GitLab Milestone">
          {gitlabMatch.type === 'exact' ? (
            gitlabMatch.candidateUrl ? (
              <button
                type="button"
                onClick={() => openUrl(gitlabMatch.candidateUrl)}
                className="text-primary hover:underline flex items-center gap-1"
                data-testid="gitlab-link-exact"
              >
                {gitlabMatch.candidateName}
                <ExternalLink className="size-3 shrink-0" />
              </button>
            ) : (
              <span data-testid="gitlab-link-exact">{gitlabMatch.candidateName}</span>
            )
          ) : gitlabMatch.type === 'fuzzy' ? (
            gitlabMatch.candidateUrl ? (
              <button
                type="button"
                onClick={() => openUrl(gitlabMatch.candidateUrl)}
                className="border-b border-dashed border-muted-foreground hover:text-foreground flex items-center gap-1"
                title={`Fuzzy match: ${gitlabMatch.candidateName}`}
                data-testid="gitlab-link-fuzzy"
              >
                {gitlabMatch.candidateName}
                <ExternalLink className="size-3 shrink-0" />
              </button>
            ) : (
              <span
                className="border-b border-dashed border-muted-foreground"
                title={`Fuzzy match: ${gitlabMatch.candidateName}`}
                data-testid="gitlab-link-fuzzy"
              >
                {gitlabMatch.candidateName}
              </span>
            )
          ) : (
            // Action-only: the row label plus an offer to create already says
            // the milestone is absent, so a separate "No milestone matched"
            // warning was just restating the row it sits in.
            <span data-testid="gitlab-link-none">
              {canCreateMilestone ? (
                <RowAction onClick={onCreateMilestone}>Create milestone</RowAction>
              ) : (
                <RowUnavailable>Set a release date first</RowUnavailable>
              )}
            </span>
          )}
        </MetaRow>

        <MetaRow label="Release Branch">
          {/* Each state resolves to a single inline element — an action when the
              branch can be created, otherwise the reason it can't. */}
          {branchState.kind === 'blocked-no-milestone' ? (
            <RowUnavailable>
              <span data-testid="branch-status-blocked">Create the milestone first</span>
            </RowUnavailable>
          ) : branchState.kind === 'unresolvable' || branchState.kind === 'invalid-ref' ? (
            <span
              className="text-muted-foreground text-xs"
              title={
                branchState.kind === 'invalid-ref'
                  ? `Invalid git ref: ${branchState.branchName}`
                  : undefined
              }
              data-testid={
                branchState.kind === 'invalid-ref'
                  ? 'branch-status-invalid-ref'
                  : 'branch-status-unresolvable'
              }
            >
              No branch name from this milestone title
            </span>
          ) : branchState.kind === 'check-failed' ? (
            <span className="inline-flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 text-orange-600 text-xs dark:text-orange-400"
                title={`Couldn't check ${branchState.branchName}`}
                data-testid="branch-status-check-failed"
              >
                <AlertTriangle className="size-3 shrink-0" />
                Couldn't check
              </span>
              <RowAction icon={RefreshCw} onClick={onRetryBranchCheck}>
                Retry
              </RowAction>
            </span>
          ) : branchState.kind === 'loading' ? (
            <span className="text-muted-foreground text-xs">Loading...</span>
          ) : branchState.kind === 'exists' ? (
            <span
              className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"
              data-testid="branch-status-exists"
            >
              <GitBranch className="size-3 shrink-0" />
              <span className="font-mono text-xs">{branchState.branchName}</span>
            </span>
          ) : branchState.kind === 'released' ? (
            <span
              className="inline-flex items-center gap-1 text-muted-foreground text-xs"
              title={
                branchState.tagName
                  ? `${branchState.branchName} was merged and deleted; tagged ${branchState.tagName}`
                  : `${branchState.branchName} was merged and deleted. No matching tag found — tags are an incomplete record, so this is not evidence the release did not ship.`
              }
              data-testid="branch-status-released"
            >
              <Check className="size-3 shrink-0" />
              Released
              {branchState.tagName && <span className="font-mono">{branchState.tagName}</span>}
            </span>
          ) : (
            <span data-testid="branch-status-missing">
              {defaultBranch ? (
                <RowAction onClick={onCreateBranch}>Create branch</RowAction>
              ) : (
                <RowUnavailable>Default branch not loaded yet</RowUnavailable>
              )}
            </span>
          )}
        </MetaRow>

        <MetaRow label="MR Labels">
          {gitlabMatch.type === 'none' ? (
            <span className="text-muted-foreground">—</span>
          ) : milestoneMRsLoaded && labelCoverage ? (
            labelCoverage.allLabeled ? (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                <Check className="size-3" />
                All {labelCoverage.total} MRs labeled
              </span>
            ) : (
              <div>
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="size-3" />
                  {labelCoverage.unlabeled.length}/{labelCoverage.total} missing
                </span>
                <div className="mt-1.5 space-y-0.5">
                  {labelCoverage.unlabeled.map((mr) => (
                    <div key={mr.id} className="flex items-center gap-1.5">
                      <GitMerge
                        className={`size-3 shrink-0 ${
                          mr.state === 'merged'
                            ? 'text-green-600 dark:text-green-400'
                            : mr.state === 'opened'
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-gray-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => openUrl(mr.web_url)}
                        className="text-xs font-mono hover:underline shrink-0"
                      >
                        !{mr.iid}
                      </button>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{mr.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <span className="text-muted-foreground">Loading...</span>
          )}
        </MetaRow>

        {/* MR state distribution — only when a milestone matched and has MRs.
            Hides entirely (no "—") when its data is absent. */}
        {gitlabMatch.type !== 'none' && milestoneMRsLoaded && hasMrs && (
          <MetaRow label="MRs">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {mrStateCounts.merged > 0 && (
                <Badge tone="green" className="text-xs tabular-nums">
                  {mrStateCounts.merged} merged
                </Badge>
              )}
              {mrStateCounts.opened > 0 && (
                <Badge tone="blue" className="text-xs tabular-nums">
                  {mrStateCounts.opened} open
                </Badge>
              )}
              {mrStateCounts.closed > 0 && (
                <Badge tone="muted" className="text-xs tabular-nums">
                  {mrStateCounts.closed} closed
                </Badge>
              )}
            </span>
          </MetaRow>
        )}

        {/* Issue status distribution — hides entirely (no "—") when no
            issues are loaded. */}
        {hasIssues && (
          <MetaRow label="Issues">
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {issueStatusCounts.new > 0 && (
                <Badge tone="muted" className="text-xs tabular-nums">
                  {issueStatusCounts.new} new
                </Badge>
              )}
              {issueStatusCounts.indeterminate > 0 && (
                <Badge tone="blue" className="text-xs tabular-nums">
                  {issueStatusCounts.indeterminate} in progress
                </Badge>
              )}
              {issueStatusCounts.done > 0 && (
                <Badge tone="green" className="text-xs tabular-nums">
                  {issueStatusCounts.done} done
                </Badge>
              )}
            </span>
          </MetaRow>
        )}

        {/* Story-point effort — only when at least one issue carries a
            positive story-point value. */}
        {hasStoryPoints && (
          <MetaRow label="Story points">
            <span className="text-sm tabular-nums">
              {storyPoints.completed} / {storyPoints.total}
            </span>
          </MetaRow>
        )}
      </div>
    </div>
  );
}
