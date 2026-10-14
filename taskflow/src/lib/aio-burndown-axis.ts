const DAY_MS = 86_400_000;
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
 * X ticks, evenly spaced: the start and end instants (anchored to the plot edges) plus
 * equally spaced instants between them, as many as fit without labels colliding. When the span
 * is a whole number of days the count is nudged (down to 2 fewer) so the steps are whole days,
 * putting every tick at the same time of day as the start. Labels are local dates. The year is
 * shown (on every label) only when the range crosses years or is not in the current year.
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
  const label = (t: number) => {
    const d = new Date(t);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}${withYear ? ` '${String(d.getFullYear()).slice(2)}` : ''}`;
  };

  const widest = Math.max(labelWidth(label(from)), labelWidth(label(to)));
  // Centre-to-centre distance must clear a label width plus padding.
  const maxCount = Math.max(2, Math.floor(plotWidth / (widest + LABEL_PAD_PX)) + 1);
  const spanDays = Math.round((to - from) / DAY_MS);
  let count = Math.min(maxCount, Math.max(2, spanDays + 1));
  for (let n = count; n >= Math.max(2, count - 2); n--) {
    if (spanDays > 0 && spanDays % (n - 1) === 0) {
      count = n;
      break;
    }
  }
  return Array.from({ length: count }, (_, i) => {
    const t = i === count - 1 ? to : from + ((to - from) * i) / (count - 1);
    return {
      t,
      label: label(t),
      anchor: i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle',
    } satisfies XTick;
  });
}
