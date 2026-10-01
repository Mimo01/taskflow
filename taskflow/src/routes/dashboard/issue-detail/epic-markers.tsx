/**
 * Marker + series vocabulary for the epic progress section (quick 261001-rtw, 261001-sqm).
 * Colour = status meaning: Logged = Done, Remaining = In progress, Estimate = To do (both
 * charts share one Remaining rule). The forecast line and band stay neutral, and so does every
 * icon. SERIES is the single source for chart props,
 * tooltip row markers and legend glyphs so the three always agree.
 */
import {
  CalendarClock,
  CalendarDays,
  Clock,
  Hash,
  Hourglass,
  type LucideIcon,
  Timer,
  Weight,
} from 'lucide-react';
import type { MarkerTone, TooltipMarker } from '@/components/ui/tooltip-body';
import type { Metric } from '@/lib/epic-progress';
import { STATUS_CATEGORY_COLOR } from '@/lib/statusStyles';

export const MARKER_ICON = {
  date: CalendarDays,
  fromToday: CalendarClock,
  logged: Clock,
  estimate: Timer,
  remaining: Hourglass,
} as const satisfies Record<string, LucideIcon>;

export const METRIC_ICON: Record<Metric, LucideIcon> = {
  count: Hash,
  sp: Weight,
  time: Clock,
};

const FG = 'var(--color-foreground)';
const MUTED = 'var(--color-muted-foreground)';

interface SeriesMarker {
  marker: TooltipMarker;
  tone: MarkerTone;
}

/**
 * Series styles: status-coloured Logged / Remaining / Estimate, neutral forecast and band (fills
 * >= 0.08 over a >= 1px stroke so they stay legible in dark mode; the band is 0.15). `tone` is
 * kept on every entry; the status markers ignore it.
 */
export const SERIES = {
  remaining: {
    stroke: STATUS_CATEGORY_COLOR.indeterminate,
    strokeWidth: 2,
    marker: 'status-line',
    color: STATUS_CATEGORY_COLOR.indeterminate,
    tone: 'strong',
  },
  forecast: {
    stroke: FG,
    strokeWidth: 1.5,
    strokeDasharray: '4 4',
    marker: 'dashed',
    tone: 'strong',
  },
  band: { fill: MUTED, fillOpacity: 0.15, marker: 'band', tone: 'muted' },
  logged: {
    stroke: STATUS_CATEGORY_COLOR.done,
    strokeWidth: 2,
    marker: 'status-line',
    color: STATUS_CATEGORY_COLOR.done,
    tone: 'muted',
  },
  estimate: {
    fill: STATUS_CATEGORY_COLOR.new,
    fillOpacity: 0.15,
    stroke: STATUS_CATEGORY_COLOR.new,
    strokeWidth: 1,
    marker: 'status-area',
    color: STATUS_CATEGORY_COLOR.new,
    tone: 'muted',
  },
} as const satisfies Record<string, SeriesMarker & Record<string, unknown>>;
