/**
 * LogsTimeline — the Timeline view of the Logs tab.
 *
 * A simple load waterfall: requests grouped by page load (newest on top), one line per request on a
 * name | bar | duration grid. Only the newest load is open by default; the user's choice per load
 * lives in the dev-tools view store. Colour is status only. Bars are percent-positioned, so there is
 * no measuring; closed loads render just their header.
 */
import { ChevronRight } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { isPending } from '../../lib/dev-tools/log-entry';
import { urlPath } from '../../lib/dev-tools/log-stats';
import { queueSplit } from '../../lib/dev-tools/queue-handoff';
import {
  barGeometry,
  formatMs,
  isLoadOpen,
  type Load,
  loadSpan,
  loadTicks,
  type RowTone,
  requestLabel,
  rowStatus,
  tooltipLines,
  visibleRequestIds,
} from '../../lib/dev-tools/timeline-loads';
import { cn } from '../../lib/utils';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { isTabStop } from './dev-tools-ui';
import { useDevToolsViewStore } from './dev-tools-view.store';

const GRID = 'grid grid-cols-[minmax(11rem,30%)_1fr_4.5rem] items-center';
const TIP_WIDTH = 320;

const BAR_TONE: Record<RowTone, string> = {
  ok: 'bg-foreground/30',
  warn: 'bg-amber-500/55',
  error: 'bg-red-500/60',
  pending: 'bg-foreground/10 ring-1 ring-inset ring-foreground/30 motion-safe:animate-pulse',
};
const WAIT_TONE: Record<RowTone, string> = {
  ok: 'bg-foreground/10',
  warn: 'bg-amber-500/15',
  error: 'bg-red-500/15',
  pending: 'bg-foreground/10',
};
const STATUS_TEXT = {
  warn: 'text-amber-700 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  pending: 'text-muted-foreground/70',
} as const;

interface TipState {
  entryId: string;
  x: number;
  y: number;
}

interface LogsTimelineProps {
  loads: Load[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
}

export default function LogsTimeline({ loads, selectedId, onSelect, now }: LogsTimelineProps) {
  const loadOpen = useDevToolsViewStore((s) => s.loadOpen);
  const setLoadOpen = useDevToolsViewStore((s) => s.setLoadOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const visibleIds = visibleRequestIds(loads, loadOpen);

  const onPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-timeline-row]');
    const id = row?.dataset.id;
    if (!id) {
      setTip(null);
      return;
    }
    const root = rootRef.current;
    const rect = root?.getBoundingClientRect();
    const maxX = Math.max(0, (root?.clientWidth ?? TIP_WIDTH) - TIP_WIDTH);
    const x = Math.min(Math.max(0, (e.clientX || 0) - (rect?.left ?? 0) + 12), maxX);
    const y = (e.clientY || 0) - (rect?.top ?? 0) + 14;
    setTip({ entryId: id, x, y });
  };

  let tipLines: string[] | null = null;
  if (tip) {
    for (const load of loads) {
      const entry = load.entries.find((en) => en.id === tip.entryId);
      if (entry) {
        tipLines = tooltipLines(entry, load, load.hasPending ? now : load.doneEnd);
        break;
      }
    }
  }

  return (
    <div
      ref={rootRef}
      data-testid="logs-timeline"
      className="relative"
      onPointerOver={onPointer}
      onPointerMove={onPointer}
      onPointerLeave={() => setTip(null)}
    >
      {loads.map((load, index) => {
        const open = isLoadOpen(loadOpen, load.id, index);
        const effNow = load.hasPending ? now : load.doneEnd;
        const span = loadSpan(load, effNow);
        const ticks = loadTicks(span);
        const count = load.entries.length;
        return (
          <LoadGroup
            key={load.id}
            load={load}
            open={open}
            effNow={effNow}
            span={span}
            ticks={ticks}
            count={count}
            selectedId={selectedId}
            visibleIds={visibleIds}
            onToggle={() => setLoadOpen(load.id, !open)}
            onSelect={onSelect}
          />
        );
      })}
      {tip && tipLines && (
        <div
          role="tooltip"
          data-testid="timeline-tooltip"
          className="pointer-events-none absolute z-30 grid gap-0.5 rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: tip.x, top: tip.y, width: TIP_WIDTH }}
        >
          <div className="truncate font-mono">{tipLines[0]}</div>
          <div>{tipLines[1]}</div>
          <div className="text-muted-foreground">{tipLines[2]}</div>
        </div>
      )}
    </div>
  );
}

function LoadGroup({
  load,
  open,
  effNow,
  span,
  ticks,
  count,
  selectedId,
  visibleIds,
  onToggle,
  onSelect,
}: {
  load: Load;
  open: boolean;
  effNow: number;
  span: number;
  ticks: ReturnType<typeof loadTicks>;
  count: number;
  selectedId: string | null;
  visibleIds: string[];
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        data-testid="timeline-load"
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          GRID,
          'sticky top-0 z-20 h-8 w-full border-t bg-background text-left text-xs first:border-t-0 hover:bg-accent/50',
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap pl-2.5">
          <ChevronRight
            className={cn('size-3 shrink-0 text-muted-foreground', open && 'rotate-90')}
            aria-hidden
          />
          <span className="truncate font-medium">{load.name}</span>
          <span className="text-muted-foreground tabular-nums">
            · {count} {count === 1 ? 'request' : 'requests'} · {formatMs(span)}
          </span>
        </span>
        <span className="relative h-full text-[11px] text-muted-foreground/80 tabular-nums">
          {open && (
            <>
              <span className="absolute bottom-1 left-0">0</span>
              {ticks.map((t) => (
                <span
                  key={t.t}
                  className="absolute bottom-1 -translate-x-1/2"
                  style={{ left: `${t.pct}%` }}
                >
                  {t.label}
                </span>
              ))}
            </>
          )}
        </span>
        <span className="pr-4 text-right text-muted-foreground/80 tabular-nums">
          {new Date(load.start).toLocaleTimeString()}
        </span>
      </button>
      {open &&
        load.entries.map((entry) => (
          <TimelineRow
            key={entry.id}
            entry={entry}
            load={load}
            span={span}
            ticks={ticks}
            now={effNow}
            selected={entry.id === selectedId}
            tabStop={isTabStop(visibleIds, selectedId, entry.id)}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function TimelineRow({
  entry,
  load,
  span,
  ticks,
  now,
  selected,
  tabStop,
  onSelect,
}: {
  entry: ApiLogEntry;
  load: Load;
  span: number;
  ticks: ReturnType<typeof loadTicks>;
  now: number;
  selected: boolean;
  tabStop: boolean;
  onSelect: (id: string) => void;
}) {
  const status = rowStatus(entry);
  const geo = barGeometry(entry, load, span, now);
  return (
    <div
      data-timeline-row
      data-id={entry.id}
      className={cn(
        'group relative h-[26px] text-xs hover:bg-accent/50',
        selected && 'bg-accent shadow-[inset_2px_0_0_var(--primary)]',
      )}
    >
      <button
        type="button"
        data-testid="devtools-row"
        aria-label={`${entry.method} ${urlPath(entry.url)}`}
        aria-current={selected ? 'true' : undefined}
        tabIndex={tabStop ? 0 : -1}
        onClick={() => onSelect(entry.id)}
        className="absolute inset-0 z-0 cursor-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <div className={cn(GRID, 'pointer-events-none relative z-10 h-full')}>
        <div className="truncate pl-7 pr-2.5">
          {requestLabel(entry)}
          {status && <span className={cn('ml-1.5', STATUS_TEXT[status.tone])}>{status.text}</span>}
        </div>
        <div className="relative h-full">
          {ticks.map((t) => (
            <span
              key={t.t}
              className="absolute inset-y-0 w-px bg-border/70"
              style={{ left: `${t.pct}%` }}
            />
          ))}
          {geo.wait && (
            <span
              data-testid="timeline-queued"
              className={cn('absolute top-2 h-2.5 rounded-l-sm', WAIT_TONE[geo.tone])}
              style={{ left: `${geo.wait.left}%`, width: `${geo.wait.width}%` }}
            />
          )}
          <span
            data-testid="timeline-bar"
            className={cn('absolute top-2 h-2.5 rounded-sm', BAR_TONE[geo.tone])}
            style={{ left: `${geo.left}%`, width: `${geo.width}%` }}
          />
        </div>
        <div className="pr-4 text-right text-muted-foreground tabular-nums">
          {isPending(entry) ? '…' : formatMs(queueSplit(entry).networkMs)}
        </div>
      </div>
    </div>
  );
}
