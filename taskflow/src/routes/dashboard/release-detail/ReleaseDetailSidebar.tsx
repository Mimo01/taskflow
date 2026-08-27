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
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { openExternal } from '@/lib/openExternal';
import type { GitLabMilestone } from '@/services/gitlab';
import type { JiraFixVersion } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
import { DescriptionsSection } from './DescriptionsSection';
import { MetaRow } from './MetaRow';
import type { MergeBackVerdict } from './mergeBackVerification';
import { formatEvidenceDate, formatVerdictDate } from './mergeBackVerification';
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

/** WR-10 exhaustiveness guard: only callable with a value the switch above has
 *  narrowed to `never`, so an unhandled `BranchState` kind is a compile error
 *  rather than a silent fall-through into the Create-branch arm. */
function assertNeverBranchState(_state: never): null {
  return null;
}

/**
 * Release Branch row body.
 *
 * WR-10: extracted from a seven-arm nested ternary whose terminal `else` stood
 * for `missing` — the one arm that renders a MUTATING affordance (Create
 * branch). TypeScript does not check ternary-chain exhaustiveness, so adding
 * an eighth `BranchState` kind compiled clean and landed in the arm that
 * invites re-creating a shipped release's branch. The `default` arm's `never`
 * assignment makes an unhandled kind a compile error instead, and the safe
 * fallback at runtime is inert copy rather than a button.
 */
function BranchRowContent({
  branchState,
  defaultBranch,
  onCreateBranch,
  onRetryBranchCheck,
}: {
  branchState: BranchState;
  defaultBranch: string | null;
  onCreateBranch: () => void;
  onRetryBranchCheck: () => void;
}) {
  switch (branchState.kind) {
    case 'blocked-no-milestone':
      return (
        <RowUnavailable>
          <span data-testid="branch-status-blocked">Create the milestone first</span>
        </RowUnavailable>
      );

    case 'unresolvable':
      return (
        <span className="text-muted-foreground text-xs" data-testid="branch-status-unresolvable">
          No branch name from this milestone title
        </span>
      );

    case 'invalid-ref':
      return (
        <span
          className="text-muted-foreground text-xs"
          title={`Invalid git ref: ${branchState.branchName}`}
          data-testid="branch-status-invalid-ref"
        >
          No branch name from this milestone title
        </span>
      );

    case 'check-failed':
      return (
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
      );

    case 'loading':
      return <span className="text-muted-foreground text-xs">Loading...</span>;

    case 'exists':
      return (
        <span
          className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"
          data-testid="branch-status-exists"
        >
          <GitBranch className="size-3 shrink-0" />
          <span className="font-mono text-xs">{branchState.branchName}</span>
        </span>
      );

    case 'released': {
      // WR-03: the tag-channel distinction used to live ONLY in `title`, so
      // all three states rendered the byte-identical visible text "Released".
      // A user without a mouse — or any keyboard user, since this is a
      // non-focusable span — could not tell "checked, no tag" from "checking"
      // from "check failed", which is exactly half of the 91-VERIFICATION
      // truth 6 symptom. The marker below makes the provisional states
      // visible, and `aria-label` mirrors the full sentence into the
      // accessibility tree.
      const tooltipText = branchState.tagName
        ? `${branchState.branchName} deleted · tagged ${branchState.tagName}`
        : branchState.tagChannel === 'failed'
          ? `${branchState.branchName} deleted. Couldn't check for a matching tag.`
          : branchState.tagChannel === 'pending'
            ? `${branchState.branchName} deleted. Checking for a matching tag...`
            : `${branchState.branchName} deleted. No matching tag found — tags are an incomplete record, so this is not evidence the release did not ship.`;

      return (
        <>
          <span
            className="inline-flex items-center gap-1 text-muted-foreground text-xs"
            title={tooltipText}
            data-testid="branch-status-released"
          >
            <GitBranch className="size-3 shrink-0" />
            Released
            {branchState.tagName ? (
              <span className="font-mono">{branchState.tagName}</span>
            ) : branchState.tagChannel === 'pending' ? (
              <span className="italic" data-testid="branch-status-tag-pending">
                · checking tag...
              </span>
            ) : branchState.tagChannel === 'failed' ? (
              <span className="italic" data-testid="branch-status-tag-failed">
                · tag check failed
              </span>
            ) : null}
          </span>
          {/* The full sentence for assistive tech. A `title` is announced
              inconsistently and `aria-label` is not supported on a role-less
              span (it would be dropped by AT and flagged by biome's
              useAriaPropsSupportedByRole), so the explanation is rendered as
              visually-hidden text instead. Kept OUTSIDE the testid span so the
              visible-text assertions stay honest. */}
          <span className="sr-only" data-testid="branch-status-released-description">
            {tooltipText}
          </span>
        </>
      );
    }

    case 'missing':
      return (
        <span data-testid="branch-status-missing">
          {defaultBranch ? (
            <RowAction onClick={onCreateBranch}>Create branch</RowAction>
          ) : (
            <RowUnavailable>Default branch not loaded yet</RowUnavailable>
          )}
        </span>
      );

    // WR-10: an unhandled kind is a COMPILE error — `assertNeverBranchState`
    // only accepts `never`, so a new `BranchState` kind fails to typecheck
    // here. At runtime the fallback is deliberately inert (null), never the
    // Create-branch affordance, in a feature whose premise is "never invite
    // an action on unverified state".
    default:
      return assertNeverBranchState(branchState);
  }
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
  mergeBackVerdict: MergeBackVerdict;
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
  matchedMilestone,
  branchState,
  mergeBackVerdict,
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
      <div className="space-y-4 density-compact:space-y-2 density-comfortable:space-y-6 text-sm">
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
              <LinkContextMenu href={gitlabMatch.candidateUrl}>
                <button
                  type="button"
                  onClick={() => openExternal(gitlabMatch.candidateUrl)}
                  className="text-primary hover:underline flex items-center gap-1"
                  data-testid="gitlab-link-exact"
                >
                  {gitlabMatch.candidateName}
                  <ExternalLink className="size-3 shrink-0" />
                </button>
              </LinkContextMenu>
            ) : (
              <span data-testid="gitlab-link-exact">{gitlabMatch.candidateName}</span>
            )
          ) : gitlabMatch.type === 'fuzzy' ? (
            gitlabMatch.candidateUrl ? (
              <LinkContextMenu href={gitlabMatch.candidateUrl}>
                <button
                  type="button"
                  onClick={() => openExternal(gitlabMatch.candidateUrl)}
                  className="border-b border-dashed border-muted-foreground hover:text-foreground flex items-center gap-1"
                  title={`Fuzzy match: ${gitlabMatch.candidateName}`}
                  data-testid="gitlab-link-fuzzy"
                >
                  {gitlabMatch.candidateName}
                  <ExternalLink className="size-3 shrink-0" />
                </button>
              </LinkContextMenu>
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
              branch can be created, otherwise the reason it can't. WR-10: the
              per-kind mapping lives in BranchRowContent's exhaustive switch. */}
          <BranchRowContent
            branchState={branchState}
            defaultBranch={defaultBranch}
            onCreateBranch={onCreateBranch}
            onRetryBranchCheck={onRetryBranchCheck}
          />
        </MetaRow>

        {/* Merge-back verdict (MERGE-01/02) — hidden entirely (no "—") when
            the check cannot be attempted at all (D-11). Pure text + icon +
            native `title`, no interactive control of any kind (D-12/D-13). */}
        {mergeBackVerdict.kind !== 'hidden' && (
          <MetaRow label="Merged back">
            {mergeBackVerdict.kind === 'loading' ? (
              <span className="text-muted-foreground text-xs" data-testid="merge-back-loading">
                Loading...
              </span>
            ) : mergeBackVerdict.kind === 'merged' && mergeBackVerdict.via === 'tracking-mr' ? (
              <span
                className="inline-flex items-center gap-1 text-green-600 text-xs dark:text-green-400"
                data-testid="merge-back-merged"
                title={
                  formatEvidenceDate(mergeBackVerdict.mergedAt)
                    ? `via !${mergeBackVerdict.mrIid}, merged ${formatEvidenceDate(mergeBackVerdict.mergedAt)}`
                    : `via !${mergeBackVerdict.mrIid}`
                }
              >
                <Check className="size-3 shrink-0" />
                Merged into {mergeBackVerdict.defaultBranch}
                {formatVerdictDate(mergeBackVerdict.mergedAt) &&
                  ` · ${formatVerdictDate(mergeBackVerdict.mergedAt)}`}
              </span>
            ) : mergeBackVerdict.kind === 'merged' && mergeBackVerdict.via === 'content-compare' ? (
              <span
                className="inline-flex items-center gap-1 text-green-600 text-xs dark:text-green-400"
                data-testid="merge-back-merged"
                title={`no diff between ${mergeBackVerdict.tagName} and ${mergeBackVerdict.defaultBranch}`}
              >
                <Check className="size-3 shrink-0" />
                Merged into {mergeBackVerdict.defaultBranch}
              </span>
            ) : mergeBackVerdict.kind === 'likely-not-merged' ? (
              <span
                className="inline-flex items-center gap-1 text-orange-600 text-xs dark:text-orange-400"
                data-testid="merge-back-likely-not-merged"
                title={`${mergeBackVerdict.tagName} has ${mergeBackVerdict.commitsNotInDefault} commits not in ${mergeBackVerdict.defaultBranch}`}
              >
                <AlertTriangle className="size-3 shrink-0" />
                Likely not merged into {mergeBackVerdict.defaultBranch}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 text-muted-foreground text-xs"
                data-testid="merge-back-couldnt-verify"
                title={
                  mergeBackVerdict.reason === 'check-failed'
                    ? 'the merge-back check could not be completed'
                    : mergeBackVerdict.expectedTagName
                      ? // WR-08: name the pattern actually searched. `findReleaseTag`
                        // strips an optional leading `v` and matches either spelling,
                        // so "no v33.5.0 tag found" described a narrower lookup than
                        // the one performed.
                        `no tracking MR and no tag matching ${mergeBackVerdict.expectedTagName} (with or without a leading v) found`
                      : 'no tracking MR and no release tag found'
                }
              >
                Couldn't verify
              </span>
            )}
          </MetaRow>
        )}

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
                <div className="mt-1.5 space-y-0.5 density-compact:space-y-0 density-comfortable:space-y-1">
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
                      <LinkContextMenu href={mr.web_url}>
                        <button
                          type="button"
                          onClick={() => openExternal(mr.web_url)}
                          className="text-xs font-mono hover:underline shrink-0"
                        >
                          !{mr.iid}
                        </button>
                      </LinkContextMenu>
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

        <div data-testid="sidebar-descriptions" className="space-y-4 border-t pt-4">
          <DescriptionsSection
            gitlabMatchType={gitlabMatch.type}
            matchedMilestone={matchedMilestone}
            versionDescription={version.description}
          />
        </div>
      </div>
    </div>
  );
}
