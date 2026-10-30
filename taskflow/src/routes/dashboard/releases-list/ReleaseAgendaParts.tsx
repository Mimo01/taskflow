import { Rocket } from 'lucide-react';
import { BreakdownErrorDash } from '@/components/release/ReleaseIssueGraph';
import { ReleasePackageCell } from '@/components/release/ReleasePackageCell';
import { ReleaseStatusPill } from '@/components/release/ReleaseStatusPill';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import type { AgendaKind, AgendaRelease } from '@/lib/release-agenda';
import {
  breakdownTotal,
  type DerivedPackage,
  RELEASE_SEGMENT_CLASS,
  RELEASE_SEGMENT_ORDER,
  type StatusBreakdown,
} from '@/lib/release-list';
import { cn } from '@/lib/utils';
import type { VersionAssignee } from '@/services/jira';

const DOT_BORDER: Record<AgendaKind, string> = {
  planned: 'border-muted-foreground/40',
  near: 'border-muted-foreground/40',
  overdue: 'border-red-500',
  undated: 'border-dashed border-amber-500',
  next: 'border-foreground',
};

/** Hollow ring dot on the rail (never filled). */
export function AgendaDot({ kind, quiet }: { kind: AgendaKind; quiet: boolean }) {
  return (
    <span
      data-testid="agenda-dot"
      className={cn(
        '-translate-x-1/2 absolute left-1/2 rounded-full border-2 bg-background shadow-[0_0_0_3px_var(--background)]',
        quiet ? 'top-[11px] size-2.5' : 'top-[15px] size-3',
        DOT_BORDER[kind],
      )}
    />
  );
}

function SegmentedBar({ breakdown, className }: { breakdown: StatusBreakdown; className: string }) {
  const total = breakdownTotal(breakdown);
  return (
    <div
      data-testid="release-issues-bar"
      className={cn('flex flex-none overflow-hidden rounded-full bg-muted', className)}
    >
      {RELEASE_SEGMENT_ORDER.filter((k) => breakdown[k] > 0).map((k) => (
        <div
          key={k}
          className={cn('h-full', RELEASE_SEGMENT_CLASS[k])}
          style={{ width: `${(breakdown[k] / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Issues column content. The wrapper has a fixed height in every state so the
 * skeleton, bar, text and dash occupy the same box (D-09: no slot shift).
 */
export function ReleaseIssuesSlot({
  breakdown,
  loading,
  error = false,
  variant,
}: {
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  /** The counts fetch failed: a muted dash with a failure tooltip, not the idle dash. */
  error?: boolean;
  variant: 'row' | 'card';
}) {
  const wrapper = cn('flex h-5 w-full items-center', variant === 'card' ? 'gap-3' : 'gap-2');
  if (!breakdown) {
    return (
      <div data-testid="release-issues" className={wrapper}>
        {loading ? (
          <Skeleton className={variant === 'card' ? 'h-2 w-full' : 'h-1.5 w-[92px]'} />
        ) : error ? (
          <BreakdownErrorDash />
        ) : (
          <span className="text-xs text-muted-foreground">–</span>
        )}
      </div>
    );
  }
  const total = breakdownTotal(breakdown);
  if (total === 0) {
    return (
      <div data-testid="release-issues" className={wrapper}>
        <span className="text-[12.5px] whitespace-nowrap text-muted-foreground/75">
          No issues yet
        </span>
      </div>
    );
  }
  const isCard = variant === 'card';
  return (
    <div data-testid="release-issues" className={wrapper}>
      <div
        role="img"
        aria-label={`${breakdown.done} of ${total} issues done`}
        className={cn('flex items-center', isCard && 'flex-1')}
      >
        <SegmentedBar breakdown={breakdown} className={isCard ? 'h-2 w-full' : 'h-1.5 w-[92px]'} />
      </div>
      <span className="text-xs font-medium whitespace-nowrap tabular-nums">
        {isCard ? `${breakdown.done}/${total} done` : `${breakdown.done}/${total}`}
      </span>
    </div>
  );
}

/**
 * Up to `max` overlapping avatars plus a +N chip, busiest first (assignees arrive sorted
 * by issue count), with the leftmost avatar on top. Hovering lists everyone with their
 * issue count. The trigger sits above the row's overlay button, so `onClick` opens the release.
 */
export function ReleaseTeam({
  assignees,
  max,
  onClick,
}: {
  assignees: readonly VersionAssignee[];
  max: number;
  onClick?: () => void;
}) {
  if (assignees.length === 0) return null;
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  const issues = assignees.reduce((n, a) => n + a.count, 0);
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={<span />}
        data-testid="release-team"
        aria-label={`Team: ${assignees.map((a) => a.displayName).join(', ')}`}
        onClick={onClick}
        className="pointer-events-auto relative z-10 inline-flex cursor-pointer items-center"
      >
        {shown.map((a, i) => (
          <span
            key={a.key}
            style={{ zIndex: shown.length - i }}
            className="relative -ml-1 rounded-full first:ml-0"
          >
            <CachedAvatar
              url={a.avatarUrl}
              name={a.displayName}
              size={20}
              className="rounded-full ring-2 ring-background"
            />
          </span>
        ))}
        {extra > 0 && (
          <span className="relative -ml-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
            +{extra}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>
        <TooltipBody
          title={`${assignees.length} ${assignees.length === 1 ? 'person' : 'people'} · ${issues} ${issues === 1 ? 'issue' : 'issues'}`}
        >
          {assignees.map((a) => (
            <div key={a.key} data-testid="release-team-row" className="flex items-center gap-2">
              <CachedAvatar
                url={a.avatarUrl}
                name={a.displayName}
                size={16}
                className="rounded-full"
              />
              <span className="min-w-0 flex-1 truncate">{a.displayName}</span>
              <span className="pl-3 font-medium tabular-nums">{a.count}</span>
            </div>
          ))}
        </TooltipBody>
      </TooltipContent>
    </Tooltip>
  );
}

/** The prominent next-release card (F5): kicker, name + pill, package + team, one bar. */
export function NextReleaseCard({
  entry,
  breakdown,
  loading,
  error = false,
  team,
  showPackage,
  pkg,
  pkgLoading,
  pkgError = false,
  onOpen,
}: {
  entry: AgendaRelease;
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  error?: boolean;
  team: readonly VersionAssignee[];
  showPackage: boolean;
  pkg: DerivedPackage | null;
  pkgLoading: boolean;
  pkgError?: boolean;
  onOpen: (id: string) => void;
}) {
  const { version } = entry;
  return (
    <Card
      size="sm"
      data-testid="next-release-card"
      className="relative cursor-pointer gap-1.5 px-3.5 hover:ring-muted-foreground"
    >
      <button
        type="button"
        aria-label={`Open release ${version.name}`}
        className="absolute inset-0 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={() => onOpen(version.id)}
      />
      <Rocket
        data-testid="next-release-rocket"
        aria-hidden="true"
        className="pointer-events-none absolute -top-3.5 -right-2.5 size-[72px] text-amber-500/10 dark:text-amber-400/15"
      />
      <div className="pointer-events-none relative text-[11px] font-bold tracking-[.06em] text-muted-foreground/70 uppercase">
        Next release
      </div>
      <div className="pointer-events-none relative flex items-center justify-between gap-2.5">
        <span className="truncate text-base font-semibold" title={version.name}>
          {version.name}
        </span>
        <ReleaseStatusPill pill={entry.countdown} />
      </div>
      <div className="pointer-events-none relative flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {showPackage &&
          (pkg || pkgLoading ? (
            <ReleasePackageCell pkg={pkg} loading={pkgLoading} error={pkgError} />
          ) : (
            <span data-testid="row-deployment-package">No RM package</span>
          ))}
        <span className="ml-auto">
          <ReleaseTeam assignees={team} max={8} onClick={() => onOpen(version.id)} />
        </span>
      </div>
      <div className="pointer-events-none relative">
        <ReleaseIssuesSlot breakdown={breakdown} loading={loading} error={error} variant="card" />
      </div>
    </Card>
  );
}
