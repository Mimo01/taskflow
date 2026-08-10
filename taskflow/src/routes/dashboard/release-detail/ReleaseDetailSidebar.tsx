import { openUrl } from '@tauri-apps/plugin-opener';
import { AlertTriangle, Calendar, Check, ExternalLink, GitMerge, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GitLabMilestone } from '@/services/gitlab';
import type { JiraFixVersion } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
import { MetaRow } from './MetaRow';
import type { BranchState } from './releaseBranch';
import type { LabelCoverage } from './releaseSummaries';

// Shared trigger for the release-branch creation action — kept as one
// component so the button copy is authored exactly once; each MetaRow call
// site below supplies its own literal disabled-reason title (D-10/D-11/D-14).
function BranchCreateButton({
  disabled,
  title,
  onClick,
}: {
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-xs h-7"
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      Create branch
    </Button>
  );
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
            <span className="flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
                data-testid="gitlab-link-none"
              >
                <AlertTriangle className="size-3" />
                No milestone matched
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={onCreateMilestone}
                disabled={!canCreateMilestone}
                title={canCreateMilestone ? undefined : 'Set a release date on this version first'}
              >
                Create milestone
              </Button>
            </span>
          )}
        </MetaRow>

        <MetaRow label="Release Branch">
          <span className="flex items-center justify-between gap-2">
            {branchState.kind === 'blocked-no-milestone' ? (
              <span className="text-muted-foreground" data-testid="branch-status-blocked">
                Create the milestone first
              </span>
            ) : branchState.kind === 'unresolvable' ? (
              <span
                className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
                data-testid="branch-status-unresolvable"
              >
                <AlertTriangle className="size-3" />
                Branch name can't be derived from this milestone title
              </span>
            ) : branchState.kind === 'invalid-ref' ? (
              <span
                className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
                title={`Invalid git ref: ${branchState.branchName}`}
                data-testid="branch-status-invalid-ref"
              >
                <AlertTriangle className="size-3" />
                Branch name can't be derived from this milestone title
              </span>
            ) : branchState.kind === 'check-failed' ? (
              <span
                className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
                title={`Couldn't check ${branchState.branchName}`}
                data-testid="branch-status-check-failed"
              >
                <AlertTriangle className="size-3" />
                Couldn't check the release branch
              </span>
            ) : branchState.kind === 'loading' ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : branchState.kind === 'exists' ? (
              <span
                className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"
                data-testid="branch-status-exists"
              >
                <Check className="size-3" />
                <span className="font-mono text-xs">{branchState.branchName}</span>
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400"
                data-testid="branch-status-missing"
              >
                <AlertTriangle className="size-3" />
                No release branch
              </span>
            )}
            {branchState.kind === 'missing' &&
              (defaultBranch ? (
                <BranchCreateButton onClick={onCreateBranch} />
              ) : (
                <BranchCreateButton
                  disabled
                  title="Project default branch not loaded yet"
                  onClick={onCreateBranch}
                />
              ))}
            {branchState.kind === 'blocked-no-milestone' && (
              <BranchCreateButton
                disabled
                title="Create the milestone first"
                onClick={onCreateBranch}
              />
            )}
            {(branchState.kind === 'unresolvable' || branchState.kind === 'invalid-ref') && (
              <BranchCreateButton
                disabled
                title="Branch name can't be derived from this milestone title"
                onClick={onCreateBranch}
              />
            )}
            {branchState.kind === 'check-failed' && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={onRetryBranchCheck}
              >
                Retry
              </Button>
            )}
          </span>
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
