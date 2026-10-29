import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  breakdownTotal,
  RELEASE_SEGMENT_CLASS,
  RELEASE_SEGMENT_ORDER,
  type StatusBreakdown,
} from '@/lib/release-list';
import {
  CHIP_LANE_TOP,
  chipShortName,
  chipStatus,
  formatRange,
  laterCount,
  placeChipLanes,
  placeTickRows,
  tickLabel,
  timelinePercent,
  timelineReleases,
  timelineWeeks,
  timelineWindow,
} from '@/lib/release-timeline';
import { cn } from '@/lib/utils';
import type { JiraFixVersion } from '@/services/jira';

type DotState = 'released' | 'overdue' | 'next' | 'planned';

const DOT_CLASS: Record<DotState, string> = {
  released: 'bg-green-500',
  overdue: 'bg-red-500',
  next: 'bg-foreground',
  planned: 'bg-muted-foreground',
};

const TICK_ROW_CLASS = ['bottom-0', '-bottom-3.5'] as const;

interface Props {
  versions: readonly JiraFixVersion[];
  today: string;
  nextId: string | null;
  breakdowns: ReadonlyMap<string, StatusBreakdown>;
  loadingIds: ReadonlySet<string>;
  onOpen: (versionId: string) => void;
}

function SegmentBar({ b }: { b: StatusBreakdown }) {
  const total = breakdownTotal(b);
  return (
    <div
      data-testid="timeline-chip-bar"
      className="flex h-1 w-full overflow-hidden rounded-full bg-muted"
    >
      {RELEASE_SEGMENT_ORDER.map((k) =>
        b[k] > 0 ? (
          <div
            key={k}
            className={RELEASE_SEGMENT_CLASS[k]}
            style={{ width: `${(b[k] / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function ReleaseTimeline({
  versions,
  today,
  nextId,
  breakdowns,
  loadingIds,
  onOpen,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 4 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const weeks = timelineWeeks(width);
  const all = timelineReleases(versions);
  const overdue = all
    .filter((v) => !v.released && (v.releaseDate as string) < today)
    .map((v) => v.releaseDate as string)
    .sort();
  const win = timelineWindow({ today, weeks, earliestOverdue: overdue[0] ?? null, offset });
  const later = laterCount(all, win);
  const inWindow = all.filter(
    (v) => (v.releaseDate as string) >= win.start && (v.releaseDate as string) <= win.end,
  );

  const items = inWindow.map((v) => ({
    v,
    id: v.id,
    date: v.releaseDate as string,
    pct: timelinePercent(v.releaseDate as string, win),
    x: (timelinePercent(v.releaseDate as string, win) / 100) * width,
  }));
  const tickRows = placeTickRows(
    items.map((i) => ({ id: i.id, x: i.x, label: tickLabel(i.date) })),
  );
  const lanes = placeChipLanes(items, nextId);
  const todayInWindow = today >= win.start && today <= win.end;

  return (
    <section aria-label="Release timeline" className="-mx-6 bg-muted/45 px-10 pt-2.5 pb-3.5">
      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <span data-testid="timeline-range" className="tabular-nums">
          {formatRange(win, later)}
        </span>
        <button
          type="button"
          disabled={offset === 0}
          onClick={() => setOffset(0)}
          className="ml-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground disabled:text-muted-foreground disabled:opacity-55"
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Show earlier weeks"
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          className="rounded-md p-1 hover:bg-muted hover:text-foreground disabled:opacity-35"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Show later weeks"
          disabled={later === 0}
          onClick={() => setOffset((o) => o + 1)}
          className="rounded-md p-1 hover:bg-muted hover:text-foreground disabled:opacity-35"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div ref={trackRef} className="relative mt-2.5 h-[166px]">
        {width > 0 && (
          <>
            {items.map((i) => (
              <div
                key={`grid-${i.id}`}
                className="absolute top-0 bottom-[18px] border-l border-dashed border-border"
                style={{ left: `${i.pct}%` }}
              />
            ))}
            {items.map((i) => {
              const row = tickRows.get(i.id);
              if (row == null) return null;
              return (
                <span
                  key={`tick-${i.id}`}
                  className={cn(
                    'absolute -translate-x-1/2 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums',
                    TICK_ROW_CLASS[row],
                  )}
                  style={{ left: `${i.pct}%` }}
                >
                  {tickLabel(i.date)}
                </span>
              );
            })}
            <div className="absolute inset-x-0 bottom-[18px] h-px bg-border" />
            {todayInWindow && (
              <div
                data-testid="timeline-today"
                className="absolute top-0 bottom-[18px] border-l-[1.5px] border-foreground"
                style={{ left: `${timelinePercent(today, win)}%` }}
              >
                <span className="absolute -top-3.5 -left-3.5 rounded bg-background px-1 text-[10px] font-semibold uppercase tracking-widest">
                  Today
                </span>
              </div>
            )}
            {items.map((i) => {
              const state: DotState = i.v.released
                ? 'released'
                : i.id === nextId
                  ? 'next'
                  : i.date < today
                    ? 'overdue'
                    : 'planned';
              return (
                <span
                  key={`dot-${i.id}`}
                  data-testid="timeline-dot"
                  data-state={state}
                  className={cn(
                    'absolute bottom-[14px] size-2.5 -translate-x-1/2 rounded-full',
                    DOT_CLASS[state],
                  )}
                  style={{ left: `${i.pct}%` }}
                />
              );
            })}
            {items.map((i) => {
              const isNext = i.id === nextId;
              const released = i.v.released;
              const isOverdue = !released && i.date < today;
              const b = breakdowns.get(i.id);
              const status = chipStatus(b, released);
              const loading = loadingIds.has(i.id);
              const lane = lanes.get(i.id) ?? 0;
              const name = chipShortName(i.v.name);
              const total = b ? breakdownTotal(b) : 0;
              return (
                <button
                  key={`chip-${i.id}`}
                  type="button"
                  data-testid="timeline-chip"
                  data-next={isNext ? 'true' : undefined}
                  aria-label={`Open release ${i.v.name}`}
                  title={i.v.name}
                  onClick={() => onOpen(i.id)}
                  className={cn(
                    'absolute flex -translate-x-1/2 flex-col gap-0.5 rounded-[9px] border bg-background text-left hover:border-muted-foreground',
                    isNext
                      ? 'w-[104px] border-foreground px-2 py-[5px]'
                      : 'w-[98px] border-border px-[7px] py-1',
                    released && 'border-green-600/70 bg-green-500/15',
                    isOverdue && !isNext && 'border-red-500',
                  )}
                  style={{ left: `${i.pct}%`, top: CHIP_LANE_TOP[lane] }}
                >
                  {isNext && (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Next
                    </span>
                  )}
                  <span
                    className={cn(
                      'truncate text-xs font-semibold',
                      isNext ? 'max-w-[88px]' : 'max-w-[82px]',
                      released && 'text-green-700 dark:text-green-400',
                    )}
                  >
                    {name}
                  </span>
                  {isNext && !released ? (
                    !b ? (
                      <Skeleton className="h-1 w-full" />
                    ) : total === 0 ? (
                      <span className="text-[11px] text-muted-foreground">No issues</span>
                    ) : (
                      <>
                        <SegmentBar b={b} />
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {b.done}/{total} done
                        </span>
                      </>
                    )
                  ) : status ? (
                    <span className="text-[11px] text-muted-foreground tabular-nums">{status}</span>
                  ) : loading ? (
                    <Skeleton className="h-2.5 w-12" />
                  ) : null}
                </button>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
