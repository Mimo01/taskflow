/**
 * TimelineConcurrencyStrip — thin step-area chart of requests in flight over the timeline window.
 *
 * Neutral on purpose (no status colour, no red at saturation): the in-flight series is a filled
 * area, requests waiting for a Jira slot stack above it as an outline, and a dashed line marks the
 * Jira concurrency limit so saturation (flat at the limit with the outline above) is obvious.
 * Dragging across the strip brushes a new window for the timeline.
 */
import { useMemo, useState } from 'react';
import { JIRA_CONCURRENCY } from '../../lib/concurrency';
import { brushWindow, type TimeScale } from '../../lib/dev-tools/time-scale';
import { concurrencySeries, queuedSeries } from '../../lib/dev-tools/timeline-layout';

const HEIGHT = 40;
const TOP = 12;
const BASE = HEIGHT - 2;

export interface StripSpan {
  /** Actual request start (not the queued time). */
  start: number;
  end: number;
  queuedAt?: number;
}

interface Props {
  spans: StripSpan[];
  range: [number, number];
  scale: TimeScale;
  width: number;
  onBrush: (window: [number, number]) => void;
}

type Point = [number, number];

/** Sum of two step series (each point holds its value until the next point). */
function sumSteps(a: Point[], b: Point[]): Point[] {
  const times = [...new Set([...a, ...b].map((p) => p[0]))].sort((x, y) => x - y);
  const valueAt = (series: Point[], t: number) => {
    let v = 0;
    for (const p of series) {
      if (p[0] <= t) v = p[1];
      else break;
    }
    return v;
  };
  return times.map((t) => [t, valueAt(a, t) + valueAt(b, t)]);
}

export default function TimelineConcurrencyStrip({ spans, range, scale, width, onBrush }: Props) {
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);

  const { inFlight, queued, hasQueued, max } = useMemo(() => {
    const flight = concurrencySeries(spans, range);
    const q = queuedSeries(spans, range);
    const stacked = sumSteps(flight.points, q.points);
    const stackedPeak = stacked.reduce((m, p) => Math.max(m, p[1]), 0);
    return {
      inFlight: flight,
      queued: stacked,
      hasQueued: spans.some((s) => s.queuedAt !== undefined),
      max: Math.max(stackedPeak, JIRA_CONCURRENCY + 1),
    };
  }, [spans, range]);

  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const stepPath = (points: Point[]) => {
    let d = '';
    points.forEach(([t, v], i) => {
      const px = scale.x(t);
      d += i === 0 ? `M${px},${y(v)}` : `H${px}V${y(v)}`;
    });
    return d;
  };
  const areaPath = `${stepPath(inFlight.points)}V${BASE}H${scale.x(inFlight.points[0][0])}Z`;
  const limitY = y(JIRA_CONCURRENCY);
  const peakX = inFlight.peakAt === null ? 0 : scale.x(inFlight.peakAt);

  const localX = (e: React.PointerEvent<SVGSVGElement>) =>
    e.clientX - e.currentTarget.getBoundingClientRect().left;

  return (
    <svg
      data-testid="concurrency-strip"
      width={width}
      height={HEIGHT}
      className="block touch-none cursor-crosshair select-none rounded-md border bg-background"
      role="img"
      aria-label="Requests in flight over time. Drag to zoom."
      onPointerDown={(e) => {
        // Primary button only: a right-click opens the context menu and no pointerup follows.
        if (e.button !== 0) return;
        const x = localX(e);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDrag({ x0: x, x1: x });
      }}
      onPointerMove={(e) => {
        if (drag) setDrag({ x0: drag.x0, x1: localX(e) });
      }}
      onPointerUp={(e) => {
        if (!drag) return;
        const next = brushWindow(drag.x0, localX(e), scale);
        setDrag(null);
        if (next) onBrush(next);
      }}
      onPointerCancel={() => setDrag(null)}
      onLostPointerCapture={() => setDrag(null)}
    >
      <path d={areaPath} className="fill-muted-foreground/25 stroke-muted-foreground/60" />
      {hasQueued && (
        <path
          data-testid="queued-series"
          d={stepPath(queued)}
          className="fill-none stroke-muted-foreground"
          strokeDasharray="3 2"
        />
      )}
      <g data-testid="limit-line">
        <line
          x1={0}
          x2={width}
          y1={limitY}
          y2={limitY}
          className="stroke-muted-foreground/70"
          strokeDasharray="4 3"
        />
        <text
          x={width - 4}
          y={limitY - 2}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {`limit ${JIRA_CONCURRENCY}`}
        </text>
      </g>
      <text
        x={Math.min(Math.max(peakX, 4), width - 4)}
        y={10}
        textAnchor={peakX > width - 60 ? 'end' : 'start'}
        className="fill-muted-foreground text-[10px] tabular-nums"
      >
        {`peak ${inFlight.peak}`}
      </text>
      {drag && (
        <rect
          data-testid="brush-selection"
          x={Math.min(drag.x0, drag.x1)}
          y={0}
          width={Math.abs(drag.x1 - drag.x0)}
          height={HEIGHT}
          className="fill-primary/15 stroke-primary/50"
        />
      )}
    </svg>
  );
}
