import { Rocket } from 'lucide-react';
import { ReleasePackageCell } from '@/components/release/ReleasePackageCell';
import { ReleaseStatusPill } from '@/components/release/ReleaseStatusPill';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { type AgendaKind, type AgendaRelease, isStarted } from '@/lib/release-agenda';
import {
  breakdownTotal,
  type DerivedPackage,
  RELEASE_SEGMENT_CLASS,
  RELEASE_SEGMENT_ORDER,
  releaseTooltipRows,
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
  variant,
}: {
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  variant: 'row' | 'card';
}) {
  const wrapper = cn('flex h-5 w-full items-center', variant === 'card' ? 'gap-3' : 'gap-2');
  if (!breakdown) {
    return (
      <div data-testid="release-issues" className={wrapper}>
        {loading ? (
          <Skeleton className={variant === 'card' ? 'h-2 w-full' : 'h-1.5 w-[92px]'} />
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
  if (!isStarted(breakdown)) {
    if (variant === 'card') {
      return (
        <div data-testid="release-issues" className={wrapper}>
          <SegmentedBar breakdown={breakdown} className="h-2 flex-1" />
          <span className="text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums">
            0/{total} done
          </span>
        </div>
      );
    }
    return (
      <div data-testid="release-issues" className={wrapper}>
        <span className="text-[12.5px] whitespace-nowrap text-muted-foreground">
          <span className="font-medium text-foreground">{total}</span> to do
        </span>
      </div>
    );
  }

  const isCard = variant === 'card';
  return (
    <div data-testid="release-issues" className={wrapper}>
      <Tooltip>
        <TooltipTrigger
          delay={0}
          render={<div />}
          role="img"
          aria-label={`${breakdown.done} of ${total} issues done`}
          className={cn('relative z-10 flex items-center', isCard && 'flex-1')}
        >
          <SegmentedBar
            breakdown={breakdown}
            className={isCard ? 'h-2 w-full' : 'h-1.5 w-[92px]'}
          />
        </TooltipTrigger>
        <TooltipContent>
          <TooltipBody title={`${total} issues`}>
            {releaseTooltipRows(breakdown).map((r) => (
              <TooltipRow
                key={r.label}
                color={r.color}
                label={r.label}
                value={r.value}
                sub={`${Math.round((r.value / total) * 100)}%`}
              />
            ))}
          </TooltipBody>
        </TooltipContent>
      </Tooltip>
      <span className="text-xs font-medium whitespace-nowrap tabular-nums">
        {isCard ? `${breakdown.done}/${total} done` : `${breakdown.done}/${total}`}
      </span>
    </div>
  );
}

/** Up to 3 overlapping avatars plus a +N chip. */
export function ReleaseTeam({ assignees }: { assignees: readonly VersionAssignee[] }) {
  const shown = assignees.slice(0, 3);
  const extra = assignees.length - shown.length;
  return (
    <span
      data-testid="release-team"
      className="inline-flex items-center"
      title={assignees.map((a) => a.displayName).join(', ')}
    >
      {shown.map((a) => (
        <CachedAvatar
          key={a.key}
          url={a.avatarUrl}
          name={a.displayName}
          size={20}
          className="-ml-1 rounded-full ring-2 ring-background first:ml-0"
        />
      ))}
      {extra > 0 && (
        <span className="-ml-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
          +{extra}
        </span>
      )}
    </span>
  );
}

/** The prominent next-release card (F5): kicker, name + pill, package + team, one bar. */
export function NextReleaseCard({
  entry,
  breakdown,
  loading,
  team,
  showPackage,
  pkg,
  pkgLoading,
  onOpen,
}: {
  entry: AgendaRelease;
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  team: readonly VersionAssignee[];
  showPackage: boolean;
  pkg: DerivedPackage | null;
  pkgLoading: boolean;
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
      <div className="relative flex items-center justify-between gap-3 text-xs text-muted-foreground">
        {showPackage &&
          (pkg || pkgLoading ? (
            <ReleasePackageCell pkg={pkg} loading={pkgLoading} />
          ) : (
            <span data-testid="row-deployment-package">No RM package</span>
          ))}
        <span className="ml-auto">
          <ReleaseTeam assignees={team} />
        </span>
      </div>
      <div className="relative">
        <ReleaseIssuesSlot breakdown={breakdown} loading={loading} variant="card" />
      </div>
    </Card>
  );
}
