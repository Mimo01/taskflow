import type { Cat, TimeSegment } from '@/lib/epic-progress';
import { OVERRUN_RED_RATIO } from '@/lib/time-progress';
import { cn } from '@/lib/utils';
import { TimeBar } from '@/routes/dashboard/issue-detail/EpicBands';
import { formatDuration } from '@/services/jira/duration';

/** Jira status category key -> Cat; undefined for unknown keys. */
export function toCat(key: string | undefined): Cat | undefined {
  return key === 'done' || key === 'indeterminate' || key === 'new' ? key : undefined;
}

/**
 * Segments for a single spent-vs-estimate bar in the epic/story TimeBar style: solid = logged
 * (status colour), faint = time left up to the estimate, amber/red beyond it.
 */
export function spentSegments(
  spentSeconds: number,
  estimateSeconds: number,
  isDone: boolean,
  cat?: Cat,
): TimeSegment[] {
  const c: Cat = cat ?? (isDone ? 'done' : 'indeterminate');
  const spent = Math.max(0, spentSeconds);
  const severe = spent > estimateSeconds * OVERRUN_RED_RATIO;
  const within = Math.min(spent, estimateSeconds);
  const out: TimeSegment[] = [];
  if (within > 0) out.push({ cat: c, part: 'logged', seconds: within, severe });
  if (spent > estimateSeconds)
    out.push({ cat: c, part: 'loggedOver', seconds: spent - estimateSeconds, severe });
  if (!isDone && spent < estimateSeconds)
    out.push({ cat: c, part: 'remaining', seconds: estimateSeconds - spent, severe });
  return out;
}

/** My Tasks default: full-page container breakpoints. Callers in narrower
 *  containers (e.g. the standup Today column) pass their own width rules. */
export const TIME_BAR_WIDTH_CLASS = 'w-[144px] @max-[720px]:w-24 @max-[580px]:hidden';

interface StackedTimeBarProps {
  spentSeconds: number;
  totalSeconds: number | undefined;
  /** Width + responsive-hide classes; shared by the spacer and filled branches. */
  widthClassName?: string;
  testId?: string;
  /** Render an empty track + "0m" caption instead of a blank spacer when there
   *  is no time data, so every row shows a bar (standup Today rows). */
  alwaysShowTrack?: boolean;
  /** Row's own status is done: fills green at/under estimate instead of amber. */
  isDone?: boolean;
  /** Status category, so the solid fill matches the status colour (defaults from isDone). */
  statusCategoryKey?: string;
}

/**
 * Progress track with a "spent / estimate" caption underneath. Renders an
 * equal-width empty spacer when there is no time data so rows stay aligned.
 */
export function StackedTimeBar({
  spentSeconds,
  totalSeconds,
  widthClassName = TIME_BAR_WIDTH_CLASS,
  testId = 'my-task-time-bar',
  alwaysShowTrack = false,
  isDone = false,
  statusCategoryKey,
}: StackedTimeBarProps) {
  const hasEst = typeof totalSeconds === 'number' && totalSeconds > 0;
  const hasSpent = spentSeconds > 0;

  if (!hasEst && !hasSpent && !alwaysShowTrack) {
    return <div className={cn('shrink-0', widthClassName)} data-testid={testId} aria-hidden />;
  }

  const est = hasEst ? (totalSeconds as number) : 0;

  const caption = hasEst
    ? `${formatDuration(spentSeconds)} / ${formatDuration(est)}`
    : formatDuration(spentSeconds);

  return (
    <div className={cn('shrink-0 flex flex-col gap-0.5', widthClassName)} data-testid={testId}>
      <TimeBar
        segments={hasEst ? spentSegments(spentSeconds, est, isDone, toCat(statusCategoryKey)) : []}
        estimate={est}
        className="h-1.5 rounded-full"
      />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap truncate">
        {caption}
      </span>
    </div>
  );
}
