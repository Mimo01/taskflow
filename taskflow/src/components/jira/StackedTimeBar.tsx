/**
 * The one per-issue time bar (261105-dsl, sketch option A): My Tasks, standup Today rows,
 * issue sidebar, Worklog, epic Stories / story Subtasks rows. Draws the epic `TimeBar`
 * (status-coloured logged, faint remaining, amber/red beyond the estimate, tick only when past
 * it, dashed when unestimated) from `timeBarModel`, with an optional caption and a hover
 * tooltip (Estimate / Logged / Remaining / Over or Under by).
 */
import { TriangleAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { type TimeBarModel, timeBarModel } from '@/lib/time-bar';
import { cn } from '@/lib/utils';
import { TimeBar } from '@/routes/dashboard/issue-detail/EpicBands';
import { MARKER_ICON } from '@/routes/dashboard/issue-detail/epic-markers';
import type { JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';

/** Row bars everywhere: 96px, hidden on very narrow My Tasks containers. */
export const TIME_BAR_WIDTH_CLASS = 'w-24 @max-[580px]:hidden';

interface StackedTimeBarProps {
  /** Issues the bar covers, from `timeBarIssues` (one issue, or a story + its subtasks). */
  issues: readonly JiraIssue[];
  /** Width + responsive-hide classes (row bars); panes pass `w-full`. */
  widthClassName?: string;
  /** Bar height: rows h-1.5, detail panes h-2. */
  barClassName?: string;
  testId?: string;
  /** Caption under the bar, beside it (Worklog), or none (epic rows). */
  caption?: 'below' | 'right' | 'none';
  /** Render a dashed track + "No estimate" instead of a blank spacer when there is no time data. */
  alwaysShowTrack?: boolean;
}

const OVER_TEXT = {
  none: undefined,
  amber: 'font-medium text-amber-700 dark:text-amber-400',
  red: 'font-medium text-red-600 dark:text-red-400',
} as const;

function Caption({ m, className }: { m: TimeBarModel; className?: string }) {
  return (
    <span
      data-testid="time-bar-caption"
      className={cn(
        'text-xs text-muted-foreground tabular-nums whitespace-nowrap truncate',
        className,
      )}
    >
      {m.estimate > 0 && m.loggedOverrun !== 'none' ? (
        // Over: only the logged figure is coloured (amber, red past 125%).
        <>
          <span className={OVER_TEXT[m.loggedOverrun]} data-overrun={m.loggedOverrun}>
            {formatDuration(m.logged)}
          </span>
          {` / ${formatDuration(m.estimate)}`}
        </>
      ) : m.estimate > 0 ? (
        `${formatDuration(m.logged)} / ${formatDuration(m.estimate)}`
      ) : m.logged > 0 ? (
        `${formatDuration(m.logged)} · no estimate`
      ) : (
        'No estimate'
      )}
    </span>
  );
}

function Breakdown({ m }: { m: TimeBarModel }) {
  return (
    <TooltipBody note={m.estimate > 0 ? undefined : 'No estimate'}>
      {m.estimate > 0 ? (
        <TooltipRow
          icon={<MARKER_ICON.estimate className="size-3" />}
          label="Estimate"
          value={formatDuration(m.estimate)}
        />
      ) : null}
      <TooltipRow
        icon={<MARKER_ICON.logged className="size-3" />}
        label="Logged"
        value={formatDuration(m.logged)}
      />
      {m.estimate > 0 || m.remaining > 0 ? (
        <TooltipRow
          icon={<MARKER_ICON.remaining className="size-3" />}
          label="Remaining"
          value={formatDuration(m.remaining)}
        />
      ) : null}
      {m.over > 0 ? (
        <TooltipRow
          icon={<TriangleAlert className="size-3" />}
          label="Over by"
          value={formatDuration(m.over)}
        />
      ) : m.under > 0 ? (
        <TooltipRow
          icon={<MARKER_ICON.estimate className="size-3" />}
          label="Under by"
          value={
            <span className="text-green-700 dark:text-green-400">{formatDuration(m.under)}</span>
          }
        />
      ) : null}
    </TooltipBody>
  );
}

export function StackedTimeBar({
  issues,
  widthClassName = TIME_BAR_WIDTH_CLASS,
  barClassName = 'h-1.5',
  testId = 'my-task-time-bar',
  caption = 'below',
  alwaysShowTrack = false,
}: StackedTimeBarProps) {
  const m = timeBarModel(issues);
  const empty = m.estimate <= 0 && m.logged <= 0 && m.remaining <= 0;

  if (empty && !alwaysShowTrack) {
    return <div className={cn('shrink-0', widthClassName)} data-testid={testId} aria-hidden />;
  }

  const label =
    m.estimate > 0
      ? `Logged ${formatDuration(m.logged)} of ${formatDuration(m.estimate)} estimate, ${formatDuration(m.remaining)} remaining`
      : `Logged ${formatDuration(m.logged)}, no estimate`;

  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        // A span: epic Stories / Subtasks rows render the bar inside a <button>.
        render={<span />}
        data-testid={testId}
        role="img"
        aria-label={label}
        data-overrun={m.over > 0 ? 'true' : undefined}
        data-empty={empty ? 'true' : undefined}
        className={cn(
          'flex shrink-0 min-w-0',
          caption === 'right' ? 'flex-row items-center gap-2' : 'flex-col gap-0.5',
          widthClassName,
        )}
      >
        <TimeBar
          segments={m.segments}
          estimate={m.estimate}
          className={cn('rounded-full', barClassName, caption === 'right' && 'flex-1')}
          dashedWhenNoEstimate
        />
        {caption === 'none' ? null : (
          <Caption m={m} className={caption === 'right' ? 'flex-none' : undefined} />
        )}
      </TooltipTrigger>
      <TooltipContent>
        <Breakdown m={m} />
      </TooltipContent>
    </Tooltip>
  );
}
