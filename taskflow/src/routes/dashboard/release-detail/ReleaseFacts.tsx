import {
  AlertTriangle,
  Check,
  ExternalLink,
  Gauge,
  GitBranch,
  GitMerge,
  type LucideIcon,
  Milestone,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { openExternal } from '@/lib/openExternal';
import { cn } from '@/lib/utils';
import type { GitLabMilestone } from '@/services/gitlab';
import type { JiraFixVersion } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
import type { MergeBackVerdict } from './mergeBackVerification';
import { formatEvidenceDate, formatVerdictDate } from './mergeBackVerification';
import type { BranchState } from './releaseBranch';

const PROBLEM = 'text-orange-600 dark:text-orange-400';
const HEALTHY = 'text-green-600 dark:text-green-400';

export type MetaItem = { id: string; node: ReactNode };

/** Dot-separated inline meta line (CycleHeader pattern). */
export function MetaLine({ items, className }: { items: MetaItem[]; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground',
        className,
      )}
    >
      {items.map((it, i) => (
        <Fragment key={it.id}>
          {i > 0 && (
            <span aria-hidden className="text-border">
              ·
            </span>
          )}
          {it.node}
        </Fragment>
      ))}
    </div>
  );
}

// Inline action. Bordered rather than ghost so it reads as clickable next to
// plain text facts.
export function RowAction({
  children,
  onClick,
  title,
  icon: Icon = Plus,
}: {
  children: ReactNode;
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

// Why an action is unavailable: the reason helps, a dead control does not.
function RowUnavailable({ children }: { children: ReactNode }) {
  return <span className="max-w-[180px] text-muted-foreground">{children}</span>;
}

/** WR-10 exhaustiveness guard: only callable with a value the switch has
 *  narrowed to `never`, so an unhandled `BranchState` kind is a compile error
 *  rather than a silent fall-through into the Create-branch arm. */
function assertNeverBranchState(_state: never): null {
  return null;
}

/**
 * Branch fact value. WR-10: exhaustive switch; the `default` arm's `never`
 * makes an unhandled kind a compile error, and the runtime fallback is inert
 * copy rather than the Create-branch button.
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
        <span className="text-muted-foreground" data-testid="branch-status-unresolvable">
          No branch name from this milestone title
        </span>
      );

    case 'invalid-ref':
      return (
        <span
          className="text-muted-foreground"
          title={`Invalid git ref: ${branchState.branchName}`}
          data-testid="branch-status-invalid-ref"
        >
          No branch name from this milestone title
        </span>
      );

    case 'check-failed':
      return (
        <>
          <span
            className={cn('inline-flex items-center gap-1', PROBLEM)}
            title={`Couldn't check ${branchState.branchName}`}
            data-testid="branch-status-check-failed"
          >
            <AlertTriangle className="size-3 shrink-0" />
            Couldn't check
          </span>
          <RowAction icon={RefreshCw} onClick={onRetryBranchCheck}>
            Retry branch check
          </RowAction>
        </>
      );

    case 'loading':
      return <span className="text-muted-foreground">Loading...</span>;

    case 'exists':
      return (
        <span
          className={cn('inline-flex max-w-full min-w-0 items-center gap-1', HEALTHY)}
          data-testid="branch-status-exists"
        >
          <span
            className="font-mono truncate"
            title={branchState.branchName}
            data-testid="branch-name"
          >
            {branchState.branchName}
          </span>
        </span>
      );

    case 'released': {
      // WR-03: the tag-channel distinction must be VISIBLE, not hover-only.
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
            className="inline-flex max-w-full min-w-0 items-center gap-1 text-muted-foreground"
            title={tooltipText}
            data-testid="branch-status-released"
          >
            Released
            {branchState.tagName ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono truncate" title={branchState.tagName}>
                  {branchState.tagName}
                </span>
              </>
            ) : branchState.tagChannel === 'pending' ? (
              <span className="italic truncate pr-0.5" data-testid="branch-status-tag-pending">
                · checking tag...
              </span>
            ) : branchState.tagChannel === 'failed' ? (
              <span className="italic truncate pr-0.5" data-testid="branch-status-tag-failed">
                · tag check failed
              </span>
            ) : null}
          </span>
          {/* Full sentence for assistive tech; kept outside the testid span so
              visible-text assertions stay honest. */}
          <span className="sr-only" data-testid="branch-status-released-description">
            {tooltipText}
          </span>
        </>
      );
    }

    case 'missing':
      return (
        <span className="inline-flex items-center gap-1" data-testid="branch-status-missing">
          {defaultBranch ? (
            <>
              <span className={PROBLEM}>Missing</span>
              <RowAction onClick={onCreateBranch}>Create branch</RowAction>
            </>
          ) : (
            <RowUnavailable>Default branch not loaded yet</RowUnavailable>
          )}
        </span>
      );

    // An unhandled kind is a COMPILE error; the runtime fallback is inert.
    default:
      return assertNeverBranchState(branchState);
  }
}

export interface ReleaseFactsProps {
  version: JiraFixVersion;
  gitlabConfigured: boolean;
  gitlabMatch: ReleaseMatch;
  matchedMilestone: GitLabMilestone | null;
  branchState: BranchState;
  mergeBackVerdict: MergeBackVerdict;
  defaultBranch: string | null;
  onCreateBranch: () => void;
  onRetryBranchCheck: () => void;
  onCreateMilestone: () => void;
  canCreateMilestone: boolean;
  hasStoryPoints: boolean;
  storyPoints: { total: number; completed: number };
}

// Icon property: muted icon + value (text-sm, weight 400). The name lives in the
// title and a screen-reader label; problems keep their colour and actions stay inline.
function Fact({
  id,
  name,
  icon: Icon,
  children,
}: {
  id: string;
  name: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={`release-fact-${id}`}
      title={name}
      className="flex min-h-6 min-w-0 items-center gap-1.5 text-sm text-foreground"
    >
      <Icon aria-hidden className="size-3.5 flex-none text-muted-foreground" />
      <span className="sr-only">{name}</span>
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1">{children}</span>
    </div>
  );
}

/**
 * One row of icon properties split by thin vertical hairlines. Each property
 * draws its own hairline on its left edge; the strip is pulled left by one
 * gutter inside an overflow-hidden clip, so the hairline of a property that
 * starts a line is clipped away and wrapped lines never begin with a stray bar.
 */
export function PropertyStrip({ items, className }: { items: MetaItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn('overflow-hidden py-0.5', className)}>
      <div
        data-testid="release-property-strip"
        className="-ml-4 flex flex-wrap items-center gap-y-2"
      >
        {items.map((it) => (
          <div
            key={it.id}
            data-testid="release-property"
            className="relative min-w-0 pl-4 pr-4 before:absolute before:left-0 before:top-1 before:h-4 before:border-l before:border-border before:content-['']"
          >
            {it.node}
          </div>
        ))}
      </div>
    </div>
  );
}

function milestoneValue(props: ReleaseFactsProps): ReactNode {
  const { gitlabMatch, canCreateMilestone, onCreateMilestone } = props;
  if (gitlabMatch.type === 'exact') {
    return gitlabMatch.candidateUrl ? (
      <LinkContextMenu href={gitlabMatch.candidateUrl}>
        <button
          type="button"
          onClick={() => openExternal(gitlabMatch.candidateUrl)}
          className="flex items-center gap-1 text-primary hover:underline"
          data-testid="gitlab-link-exact"
        >
          {gitlabMatch.candidateName}
          <ExternalLink className="size-3 shrink-0" />
        </button>
      </LinkContextMenu>
    ) : (
      <span data-testid="gitlab-link-exact">{gitlabMatch.candidateName}</span>
    );
  }
  if (gitlabMatch.type === 'fuzzy') {
    const cls = cn('border-b border-dashed border-muted-foreground', PROBLEM);
    return gitlabMatch.candidateUrl ? (
      <LinkContextMenu href={gitlabMatch.candidateUrl}>
        <button
          type="button"
          onClick={() => openExternal(gitlabMatch.candidateUrl)}
          className={cn(cls, 'flex items-center gap-1')}
          title={`Fuzzy match: ${gitlabMatch.candidateName}`}
          data-testid="gitlab-link-fuzzy"
        >
          {gitlabMatch.candidateName}
          <ExternalLink className="size-3 shrink-0" />
        </button>
      </LinkContextMenu>
    ) : (
      <span
        className={cls}
        title={`Fuzzy match: ${gitlabMatch.candidateName}`}
        data-testid="gitlab-link-fuzzy"
      >
        {gitlabMatch.candidateName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" data-testid="gitlab-link-none">
      {canCreateMilestone ? (
        <>
          <span className={PROBLEM}>Missing</span>
          <RowAction onClick={onCreateMilestone}>Create milestone</RowAction>
        </>
      ) : (
        <>
          <span className={PROBLEM}>Missing</span>
          <RowUnavailable>Set a release date first</RowUnavailable>
        </>
      )}
    </span>
  );
}

function mergeBackValue(verdict: MergeBackVerdict): ReactNode {
  if (verdict.kind === 'loading') {
    return (
      <span className="text-muted-foreground" data-testid="merge-back-loading">
        Loading...
      </span>
    );
  }
  if (verdict.kind === 'merged' && verdict.via === 'tracking-mr') {
    const date = formatVerdictDate(verdict.mergedAt);
    const evidence = formatEvidenceDate(verdict.mergedAt);
    return (
      <span
        className={cn('inline-flex items-center gap-1', HEALTHY)}
        data-testid="merge-back-merged"
        title={evidence ? `via !${verdict.mrIid}, merged ${evidence}` : `via !${verdict.mrIid}`}
      >
        <Check className="size-3 shrink-0" />
        into {verdict.defaultBranch}
        {date && ` · ${date}`}
      </span>
    );
  }
  if (verdict.kind === 'merged' && verdict.via === 'content-compare') {
    return (
      <span
        className={cn('inline-flex items-center gap-1', HEALTHY)}
        data-testid="merge-back-merged"
        title={`no diff between ${verdict.tagName} and ${verdict.defaultBranch}`}
      >
        <Check className="size-3 shrink-0" />
        into {verdict.defaultBranch}
      </span>
    );
  }
  if (verdict.kind === 'likely-not-merged') {
    return (
      <span
        className={cn('inline-flex items-center gap-1', PROBLEM)}
        data-testid="merge-back-likely-not-merged"
        title={`${verdict.tagName} has ${verdict.commitsNotInDefault} commits not in ${verdict.defaultBranch}`}
      >
        <AlertTriangle className="size-3 shrink-0" />
        Likely not into {verdict.defaultBranch}
      </span>
    );
  }
  if (verdict.kind === 'couldnt-verify') {
    return (
      <span
        className="inline-flex items-center gap-1 text-muted-foreground"
        data-testid="merge-back-couldnt-verify"
        title={
          verdict.reason === 'check-failed'
            ? 'the merge-back check could not be completed'
            : verdict.expectedTagName
              ? // WR-08: name the pattern actually searched (optional leading v).
                `no tracking MR and no tag matching ${verdict.expectedTagName} (with or without a leading v) found`
              : 'no tracking MR and no release tag found'
        }
      >
        Couldn't verify
      </span>
    );
  }
  return null;
}

export function releaseFactItems(props: ReleaseFactsProps): MetaItem[] {
  const items: MetaItem[] = [];
  const { gitlabConfigured, mergeBackVerdict } = props;

  if (gitlabConfigured) {
    items.push({
      id: 'milestone',
      node: (
        <Fact id="milestone" name="Milestone" icon={Milestone}>
          {milestoneValue(props)}
        </Fact>
      ),
    });
    items.push({
      id: 'branch',
      node: (
        <Fact id="branch" name="Branch" icon={GitBranch}>
          <BranchRowContent
            branchState={props.branchState}
            defaultBranch={props.defaultBranch}
            onCreateBranch={props.onCreateBranch}
            onRetryBranchCheck={props.onRetryBranchCheck}
          />
        </Fact>
      ),
    });
    if (mergeBackVerdict.kind !== 'hidden') {
      items.push({
        id: 'merged-back',
        node: (
          <Fact id="merged-back" name="Merged back" icon={GitMerge}>
            {mergeBackValue(mergeBackVerdict)}
          </Fact>
        ),
      });
    }
  }

  if (props.hasStoryPoints) {
    const { total, completed } = props.storyPoints;
    items.push({
      id: 'story-points',
      node: (
        <Fact id="story-points" name="Story points" icon={Gauge}>
          <Tooltip>
            <TooltipTrigger delay={0} render={<span />} className="tabular-nums">
              {total} SP
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody>
                <TooltipRow label="Done" value={completed} />
                <TooltipRow label="Total" value={total} />
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        </Fact>
      ),
    });
  }

  return items;
}

export function ReleaseFacts(props: ReleaseFactsProps) {
  return <PropertyStrip items={releaseFactItems(props)} />;
}
