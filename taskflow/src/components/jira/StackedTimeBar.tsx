import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/services/jira/duration';

/** My Tasks default: full-page container breakpoints. Callers in narrower
 *  containers (e.g. the standup Today column) pass their own width rules. */
export const TIME_BAR_WIDTH_CLASS = 'w-[144px] @max-[720px]:w-24 @max-[580px]:hidden';

interface StackedTimeBarProps {
  spentSeconds: number;
  totalSeconds: number | undefined;
  /** Width + responsive-hide classes; shared by the spacer and filled branches. */
  widthClassName?: string;
  testId?: string;
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
}: StackedTimeBarProps) {
  const hasEst = typeof totalSeconds === 'number' && totalSeconds > 0;
  const hasSpent = spentSeconds > 0;

  if (!hasEst && !hasSpent) {
    return <div className={cn('shrink-0', widthClassName)} data-testid={testId} aria-hidden />;
  }

  const est = hasEst ? (totalSeconds as number) : 0;
  const fillPct = hasEst ? Math.min(100, Math.round((spentSeconds / est) * 100)) : 0;
  const indicatorColor = hasEst
    ? spentSeconds >= est
      ? 'bg-red-500 rounded-full'
      : fillPct >= 75
        ? 'bg-amber-500 rounded-full'
        : 'bg-green-500 rounded-full'
    : undefined;

  const caption = hasEst
    ? `${formatDuration(spentSeconds)} / ${formatDuration(est)}`
    : formatDuration(spentSeconds);

  return (
    <div className={cn('shrink-0 flex flex-col gap-0.5', widthClassName)} data-testid={testId}>
      <Progress
        value={hasEst ? fillPct : 0}
        className="h-1.5 w-full rounded-full"
        indicatorClassName={indicatorColor}
      />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap truncate">
        {caption}
      </span>
    </div>
  );
}
