import { timeTicks } from '@/lib/epic-progress';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Approximate width of one 11px glyph, to keep labels from colliding. */
const CHAR_PX = 6;
/** Minimum clear space between two neighbouring x labels. */
const LABEL_PAD_PX = 14;
/** Most gridline intervals on the y axis (so at most 6 gridlines including 0). */
const MAX_INTERVALS = 5;
/** Headroom the top tick must clear above the total, so the line does not hug the top. */
const HEADROOM = 1.04;

export interface YScale {
  max: number;
  ticks: number[];
}

/**
 * "Nice" integer y scale: round steps (1, 2, 2.5, 5 x 10^k) giving 2..5 intervals from 0 to a top
 * tick that clears `total` with a little headroom. Adapts to tiny totals (3 -> 0..4 by 1).
 */
export function niceYScale(total: number): YScale {
  const t = Math.max(1, Math.floor(total));
  for (let mag = 1; ; mag *= 10) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = m * mag;
      if (!Number.isInteger(step)) continue;
      const n = Math.ceil((t * HEADROOM) / step);
      if (n <= MAX_INTERVALS) {
        const count = Math.max(n, 2);
        return { max: count * step, ticks: Array.from({ length: count + 1 }, (_, i) => i * step) };
      }
    }
  }
}

export interface XTick {
  t: number;
  label: string;
  anchor: 'start' | 'middle' | 'end';
}

const labelWidth = (label: string) => label.length * CHAR_PX;

/**
 * X ticks in LOCAL time: the start and end instants (anchored to the plot edges) plus calendar
 * ticks at local midnight, so they line up with the non-working bands and the ideal line's day
 * boundaries. Interior ticks that would collide with a neighbour or an edge label are dropped.
 * The year is shown (on every label, for consistency) only when the range crosses years or is
 * not in the current year.
 */
export function burndownXTicks(
  from: number,
  to: number,
  plotWidth: number,
  now: number = Date.now(),
): XTick[] {
  if (!(to > from) || plotWidth <= 0) return [];
  const f = new Date(from);
  const e = new Date(to);
  const withYear =
    f.getFullYear() !== e.getFullYear() || f.getFullYear() !== new Date(now).getFullYear();
  const label = (d: Date) =>
    `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? ` '${String(d.getFullYear()).slice(2)}` : ''}`;
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const px = (t: number) => ((t - from) / (to - from)) * plotWidth;
  const startLabel = label(f);
  const endLabel = label(e);
  const kept: { x0: number; x1: number }[] = [
    { x0: 0, x1: labelWidth(startLabel) },
    { x0: plotWidth - labelWidth(endLabel), x1: plotWidth },
  ];

  const interior: XTick[] = [];
  const cands = timeTicks(key(f), key(e), plotWidth * 1.6).map((c) => {
    const u = new Date(c.t);
    const local = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
    return { t: local.getTime(), label: label(local) };
  });
  // Interior labels sit at least ~0.9 of the typical calendar step away from the edge labels'
  // centres, so the first/last gap is not much tighter than the ones between them.
  const inner = cands.filter((c) => c.t > from && c.t < to);
  const diffs = inner.slice(1).map((c, i) => px(c.t) - px(inner[i].t));
  const step =
    diffs.length > 0 ? [...diffs].sort((a, b) => a - b)[Math.floor(diffs.length / 2)] : 0;
  const startC = labelWidth(startLabel) / 2;
  const endC = plotWidth - labelWidth(endLabel) / 2;
  for (const c of inner) {
    const cx = px(c.t);
    if (Math.abs(cx - startC) < step * 0.9 || Math.abs(cx - endC) < step * 0.9) continue;
    const w = labelWidth(c.label);
    const x0 = px(c.t) - w / 2;
    const x1 = x0 + w;
    if (kept.some((k) => x0 < k.x1 + LABEL_PAD_PX && x1 > k.x0 - LABEL_PAD_PX)) continue;
    kept.push({ x0, x1 });
    interior.push({ t: c.t, label: c.label, anchor: 'middle' });
  }
  return [
    { t: from, label: startLabel, anchor: 'start' },
    ...interior.sort((a, b) => a.t - b.t),
    { t: to, label: endLabel, anchor: 'end' },
  ];
}
