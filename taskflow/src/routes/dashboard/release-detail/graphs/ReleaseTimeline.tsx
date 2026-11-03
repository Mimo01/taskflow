import { type CSSProperties, useEffect, useState } from 'react';
import { dateKeyMs } from '@/lib/epic-progress';
import type { BurnupAxis } from '../releaseBurnup';
import {
  formatTrainSummary,
  type PlacedTrainLabel,
  placeTrainLabels,
  type ReleaseTrain,
} from '../releaseTrain';

export interface TimelineSummary {
  done: number;
  total: number;
  today: string;
  releaseDate: string | null;
  released: boolean;
  /** This release's version name, shown under the right end of the track. */
  versionName?: string | null;
  /** Upcoming release: render the release train instead of the plain track. */
  train?: ReleaseTrain | null;
}

function frac(day: string, start: string, end: string): number {
  const span = dateKeyMs(end) - dateKeyMs(start);
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (dateKeyMs(day) - dateKeyMs(start)) / span));
}

/** Left/centre/right anchoring so edge labels stay inside the track. */
function anchor(f: number): { left: string; transform: string } {
  const transform =
    f < 0.12 ? 'translateX(-6px)' : f > 0.88 ? 'translateX(calc(-100% + 6px))' : 'translateX(-50%)';
  return { left: `${f * 100}%`, transform };
}

/**
 * Stands in for the burnup while the release has fewer than two days of
 * history. An upcoming release shows the release train (TODAY -> releases
 * ahead -> RELEASE); released / past-due / undated keep the plain
 * start -> today -> release track. (The countdown lives in the page header's
 * status pill, not here.)
 */
export function ReleaseTimeline({
  axis,
  summary,
  className,
}: {
  axis: BurnupAxis | null;
  summary: TimelineSummary;
  className?: string;
}) {
  if (summary.train) return <TrainTrack train={summary.train} className={className} />;
  const end = axis ? axis.end : summary.today;
  const start = axis ? axis.start : summary.today;
  const todayF = frac(summary.today, start, end);
  const releaseF =
    summary.releaseDate && axis?.showRelease ? frac(summary.releaseDate, start, end) : null;
  return (
    <div data-testid="release-graph-burnup-thin" className={className}>
      <div className="px-2 pb-1" aria-hidden="true">
        <div className="relative h-12">
          <div className="absolute inset-x-0 top-[23px] h-1.5 -translate-y-1/2 rounded-full bg-muted" />
          <div
            className="absolute left-0 top-[23px] h-1.5 -translate-y-1/2 rounded-full bg-foreground/20"
            style={{ width: `${todayF * 100}%` }}
          />
          {/* Start dot only when it is not the same spot as TODAY. */}
          {todayF > 0 ? (
            <div className="absolute left-0 top-[23px] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/60" />
          ) : null}
          <div
            className="absolute top-[23px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${todayF * 100}%` }}
          />
          <div
            className="absolute top-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-foreground"
            style={anchor(todayF)}
          >
            Today
          </div>
          {releaseF !== null ? (
            <>
              <div
                className="absolute top-[23px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-foreground bg-background"
                style={{ left: `${releaseF * 100}%` }}
              />
              <div
                className="absolute top-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground"
                style={anchor(releaseF)}
              >
                Release
              </div>
            </>
          ) : null}
          {/* Version names only (no dates): previous release left, this one right. */}
          {axis?.previousName ? (
            <div
              data-testid="timeline-previous-name"
              className="absolute bottom-0 left-0 max-w-[48%] truncate text-xs text-muted-foreground"
            >
              {axis.previousName}
            </div>
          ) : null}
          {summary.versionName ? (
            <div
              data-testid="timeline-version-name"
              className="absolute bottom-0 right-0 max-w-[48%] truncate text-right text-xs text-muted-foreground"
            >
              {summary.versionName}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const TRACK_FALLBACK_PX = 300;
const NAME_MAX_PX = 96;
/** Vertical centre of the rail inside the 44px label/track/caption block. */
const RAIL_Y = 'top-[22px]';

const pct = (f: number) => `${f * 100}%`;

/** Pixel placement from placeTrainLabels; edge labels anchor to their edge. */
function labelStyle(p: PlacedTrainLabel): CSSProperties {
  const maxWidth = p.maxPx;
  if (p.align === 'start') return { left: p.x0, maxWidth };
  if (p.align === 'end') return { right: `calc(100% - ${p.x1}px)`, maxWidth };
  return { left: (p.x0 + p.x1) / 2, transform: 'translateX(-50%)', maxWidth };
}

/**
 * Release train (261103-jqy): TODAY (left) -> releases ahead -> RELEASE (right),
 * this release's window emphasised, one muted summary line underneath. Neutral
 * tokens only; names that would collide are dropped, their ticks stay.
 */
function TrainTrack({ train, className }: { train: ReleaseTrain; className?: string }) {
  const [trackEl, setTrackEl] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    if (!trackEl) return;
    setMeasured(trackEl.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setMeasured(w);
    });
    ro.observe(trackEl);
    return () => ro.disconnect();
  }, [trackEl]);
  const trackPx = measured > 0 ? measured : TRACK_FALLBACK_PX;

  const windowTick = train.ticks.find((t) => t.windowStart) ?? null;
  const top = placeTrainLabels(
    [
      { key: 'today', f: train.todayF, text: 'Today', priority: 3, maxPx: NAME_MAX_PX },
      { key: 'release', f: 1, text: train.releaseName, priority: 3, maxPx: NAME_MAX_PX },
      ...train.ticks.map((t) => ({
        key: `tick-${t.id}`,
        f: t.f,
        text: t.name,
        priority: t.windowStart ? 2 : 1,
        maxPx: NAME_MAX_PX,
      })),
    ],
    trackPx,
  );
  const captions = placeTrainLabels(
    [
      { key: 'release', f: 1, text: 'Release', priority: 3, maxPx: NAME_MAX_PX },
      ...(windowTick
        ? [
            {
              key: 'window',
              f: windowTick.f,
              text: 'window opens',
              priority: 2,
              maxPx: NAME_MAX_PX,
            },
          ]
        : []),
    ],
    trackPx,
  );
  const summaryLine = formatTrainSummary(train);

  return (
    <div
      data-testid="release-graph-burnup-thin"
      className={className}
      role="img"
      aria-label={`Today to ${train.releaseName}: ${summaryLine}`}
    >
      <div className="px-2" aria-hidden="true">
        <div ref={setTrackEl} className="relative h-11">
          {top.map((p) =>
            p.visible ? (
              <div
                key={p.key}
                className={`absolute top-0 truncate whitespace-nowrap leading-[14px] ${
                  p.key === 'today'
                    ? 'text-[10px] uppercase tracking-wide text-foreground'
                    : p.key === 'release'
                      ? 'text-xs text-foreground'
                      : 'text-xs text-muted-foreground'
                }`}
                style={labelStyle(p)}
              >
                {p.text}
              </div>
            ) : null,
          )}
          <div
            className={`absolute inset-x-0 ${RAIL_Y} h-1.5 -translate-y-1/2 rounded-full bg-muted`}
          />
          {train.windowStartF !== null ? (
            <div
              data-testid="train-window"
              className={`absolute right-0 ${RAIL_Y} h-1.5 -translate-y-1/2 rounded-full bg-foreground/25`}
              style={{ left: pct(train.windowStartF) }}
            />
          ) : null}
          {train.windowOpen && train.windowStartF !== null ? (
            <div
              className={`absolute ${RAIL_Y} h-1.5 -translate-y-1/2 rounded-full bg-foreground/50`}
              style={{
                left: pct(train.windowStartF),
                width: pct(Math.max(0, train.todayF - train.windowStartF)),
              }}
            />
          ) : null}
          {train.ticks.map((t) => (
            <div
              key={t.id}
              data-testid="train-tick"
              title={t.name}
              className={`absolute ${RAIL_Y} w-px -translate-x-1/2 -translate-y-1/2 ${
                t.windowStart ? 'h-3.5 bg-foreground/60' : 'h-2.5 bg-muted-foreground/60'
              }`}
              style={{ left: pct(t.f) }}
            />
          ))}
          <div
            className={`absolute ${RAIL_Y} size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background`}
            style={{ left: '100%' }}
          />
          <div
            data-testid="train-today"
            className={`absolute ${RAIL_Y} size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground`}
            style={{ left: pct(train.todayF) }}
          />
          {captions.map((p) =>
            p.visible ? (
              <div
                key={p.key}
                className="absolute bottom-0 truncate whitespace-nowrap text-[10px] uppercase leading-[14px] tracking-wide text-muted-foreground"
                style={labelStyle(p)}
              >
                {p.text}
              </div>
            ) : null,
          )}
        </div>
      </div>
      <div
        data-testid="train-summary"
        className="mt-1 truncate whitespace-nowrap px-2 text-xs text-muted-foreground"
      >
        {summaryLine}
      </div>
    </div>
  );
}
