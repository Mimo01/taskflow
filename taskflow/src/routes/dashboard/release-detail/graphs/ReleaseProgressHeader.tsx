import { dateKeyMs, formatDateKey } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';

export interface TimelineSummary {
  done: number;
  total: number;
  today: string;
  releaseDate: string | null;
  released: boolean;
}

const DAY = 86_400_000;

export function countdown(s: TimelineSummary): { big: string; small: string; tone: string } {
  if (!s.releaseDate)
    return {
      big: 'No release date',
      small: 'Set one to see a countdown',
      tone: 'text-amber-600 dark:text-amber-400',
    };
  const days = Math.round((dateKeyMs(s.releaseDate) - dateKeyMs(s.today)) / DAY);
  const when = formatDateKey(s.releaseDate);
  if (s.released)
    return { big: 'Released', small: `on ${when}`, tone: 'text-green-600 dark:text-green-400' };
  if (days > 0)
    return {
      big: `${days} ${days === 1 ? 'day' : 'days'} left`,
      small: `until ${when}`,
      tone: 'text-foreground',
    };
  if (days === 0) return { big: 'Due today', small: when, tone: 'text-foreground' };
  const late = -days;
  return {
    big: `${late} ${late === 1 ? 'day' : 'days'} overdue`,
    small: `was due ${when}`,
    tone: 'text-red-600 dark:text-red-400',
  };
}

/**
 * One-line countdown shared by the burnup chart and the thin-history timeline.
 * Countdown only: the full-width done bar owns the "N / M done" figure.
 */
export function ReleaseProgressHeader({
  summary,
  className,
}: {
  summary: TimelineSummary;
  className?: string;
}) {
  const cd = countdown(summary);
  return (
    <div
      data-testid="release-progress-header"
      className={cn('flex min-w-0 items-baseline gap-2', className)}
    >
      <span
        className={cn(
          // Never larger than the slot's section title (text-sm font-semibold).
          'shrink-0 whitespace-nowrap text-sm font-medium leading-5',
          cd.tone,
        )}
      >
        {cd.big}
      </span>
      <span className="min-w-0 truncate text-xs text-muted-foreground" title={cd.small}>
        {cd.small}
      </span>
    </div>
  );
}
