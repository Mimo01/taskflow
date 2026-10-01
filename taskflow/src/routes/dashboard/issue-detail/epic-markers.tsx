/**
 * Marker + series vocabulary for the epic progress section (quick 261001-rtw).
 * Colour is reserved for statuses; everything else is a monochrome icon or a neutral
 * foreground / muted-foreground series. SERIES is the single source for chart props,
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
  User,
  Weight,
} from 'lucide-react';
import type { MarkerTone, TooltipMarker } from '@/components/ui/tooltip-body';
import type { Metric } from '@/lib/epic-progress';

export const MARKER_ICON = {
  date: CalendarDays,
  fromToday: CalendarClock,
  count: Hash,
  sp: Weight,
  time: Clock,
  logged: Clock,
  estimate: Timer,
  remaining: Hourglass,
  person: User,
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
 * Neutral series styles (foreground / muted-foreground; fills >= 0.08 over a >= 1px stroke so
 * they stay legible in dark mode; the band is 0.15).
 */
export const SERIES = {
  remaining: { stroke: FG, strokeWidth: 1.5, marker: 'line', tone: 'strong' },
  forecast: {
    stroke: FG,
    strokeWidth: 1.5,
    strokeDasharray: '4 4',
    marker: 'dashed',
    tone: 'strong',
  },
  band: { fill: MUTED, fillOpacity: 0.15, marker: 'band', tone: 'muted' },
  logged: { stroke: MUTED, strokeWidth: 2, marker: 'line', tone: 'muted' },
  estimate: {
    fill: MUTED,
    fillOpacity: 0.08,
    stroke: MUTED,
    strokeWidth: 1,
    marker: 'band',
    tone: 'muted',
  },
} as const satisfies Record<string, SeriesMarker & Record<string, unknown>>;
