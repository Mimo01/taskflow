import { TriangleAlert } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { deriveTimeSegments, estimateOf, loggedOf, remainingOf } from '@/lib/epic-progress';
import { healthClass, isDoneStatus } from '@/lib/time-progress';
import { cn } from '@/lib/utils';
import { TimeBar } from '@/routes/dashboard/issue-detail/EpicBands';
import { MARKER_ICON } from '@/routes/dashboard/issue-detail/epic-markers';
import type { JiraIssue } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';

interface IssueTimeBarProps {
  issue: JiraIssue;
  /** Width / responsive classes on the trigger (default `w-16`). */
  className?: string;
  testId?: string;
  /** What to render when there is no time data: an empty track, or a blank same-width spacer. */
  empty?: 'track' | 'spacer';
  /** Show a "logged / estimate" caption under the bar (className then sizes the whole stack). */
  caption?: boolean;
  /** `status` (default): bar coloured by status category. `health`: green / amber / red by logged vs estimate. */
  colorBy?: 'status' | 'health';
}

/**
 * Epic-style time bar + tooltip, shared by every place that shows an issue's time.
 * Same TimeBar as the epic bars: total = logged + remaining, tick at the estimate.
 */
export function IssueTimeBar({ caption = false, ...props }: IssueTimeBarProps) {
  if (!caption) return <TimeBarTrigger {...props} />;
  const { issue, className = 'w-16' } = props;
  const est = estimateOf(issue);
  const logged = loggedOf(issue);
  if (props.empty === 'spacer' && logged + remainingOf(issue) === 0 && est === 0) {
    return <TimeBarTrigger {...props} />;
  }
  return (
    <div className={cn('flex shrink-0 flex-col gap-0.5', className)}>
      <TimeBarTrigger {...props} className="w-full" />
      <span
        data-testid="time-bar-caption"
        className="truncate whitespace-nowrap text-xs tabular-nums text-muted-foreground"
      >
        {est > 0 ? `${formatDuration(logged)} / ${formatDuration(est)}` : formatDuration(logged)}
      </span>
    </div>
  );
}

function TimeBarTrigger({
  issue,
  className = 'w-16',
  testId = 'story-time-bar',
  empty = 'track',
  colorBy = 'status',
}: Omit<IssueTimeBarProps, 'caption'>) {
  const est = estimateOf(issue);
  const logged = loggedOf(issue);
  const remaining = remainingOf(issue);
  const total = logged + remaining;
  if (empty === 'spacer' && total === 0 && est === 0) {
    return <span aria-hidden data-testid={testId} className={cn('flex-none', className)} />;
  }
  const overrun = est > 0 && logged > est;
  const over = est > 0 ? Math.max(total - est, 0) : 0;
  const under = est > 0 ? Math.max(est - total, 0) : 0;
  return (
    <Tooltip>
      <TooltipTrigger
        delay={0}
        render={<span />}
        data-testid={testId}
        role="img"
        aria-label={
          total > 0 ? `Logged ${formatDuration(logged)} of ${formatDuration(total)}` : 'No estimate'
        }
        data-overrun={overrun ? 'true' : undefined}
        data-empty={total > 0 ? undefined : 'true'}
        className={cn('inline-flex flex-none items-center', className)}
      >
        <TimeBar
          segments={deriveTimeSegments([issue])}
          estimate={est}
          healthColor={
            colorBy === 'health'
              ? healthClass(logged, est, isDoneStatus(issue.fields.status?.statusCategory?.key))
              : undefined
          }
          className="h-1.5 rounded-full"
        />
      </TooltipTrigger>
      <TooltipContent>
        <TooltipBody note={est > 0 || remaining > 0 ? undefined : 'No estimate'}>
          {est > 0 ? (
            <TooltipRow
              icon={<MARKER_ICON.estimate className="size-3" />}
              label="Estimate"
              value={formatDuration(est)}
            />
          ) : null}
          <TooltipRow
            icon={<MARKER_ICON.logged className="size-3" />}
            label="Logged"
            value={formatDuration(logged)}
          />
          {est > 0 || remaining > 0 ? (
            <TooltipRow
              icon={<MARKER_ICON.remaining className="size-3" />}
              label="Remaining"
              value={formatDuration(remaining)}
            />
          ) : null}
          {over > 0 ? (
            <TooltipRow
              icon={<TriangleAlert className="size-3" />}
              label="Over by"
              value={formatDuration(over)}
            />
          ) : null}
          {under > 0 ? (
            <TooltipRow
              icon={<MARKER_ICON.estimate className="size-3" />}
              label="Under by"
              value={
                <span className="text-green-700 dark:text-green-400">{formatDuration(under)}</span>
              }
            />
          ) : null}
        </TooltipBody>
      </TooltipContent>
    </Tooltip>
  );
}

interface TimedIssueInput {
  id?: string;
  key?: string;
  statusCategoryKey?: unknown;
  originalEstimate?: number | null;
  logged?: number | null;
  remaining?: number | null;
}

/** Build the minimal JiraIssue shape the epic-progress time helpers read. Undefined stays absent. */
export function timedIssue({
  id,
  key,
  statusCategoryKey,
  originalEstimate,
  logged,
  remaining,
}: TimedIssueInput): JiraIssue {
  const fields: Record<string, unknown> = {
    status: { statusCategory: { key: statusCategoryKey } },
  };
  if (typeof originalEstimate === 'number') {
    fields.timeoriginalestimate = originalEstimate;
    fields.aggregatetimeoriginalestimate = originalEstimate;
  }
  if (typeof logged === 'number') fields.aggregatetimespent = logged;
  if (typeof remaining === 'number') fields.aggregatetimeestimate = remaining;
  return { id: id ?? key ?? '', key: key ?? '', fields } as unknown as JiraIssue;
}

interface JiraTimeFields {
  status?: { statusCategory?: unknown } | null;
  timetracking?: {
    originalEstimateSeconds?: number | null;
    timeSpentSeconds?: number | null;
    remainingEstimateSeconds?: number | null;
  } | null;
  aggregatetimeoriginalestimate?: number | null;
  aggregatetimespent?: number | null;
  aggregatetimeestimate?: number | null;
  timespent?: number | null;
}

/** Aggregate-first chain: aggregate fields, then own timespent, then nested timetracking. */
export function timedIssueFromJiraFields(fields: JiraTimeFields, key?: string): JiraIssue {
  const tt = fields.timetracking;
  const cat = fields.status?.statusCategory as { key?: unknown } | undefined;
  return timedIssue({
    key,
    statusCategoryKey: cat?.key,
    originalEstimate: fields.aggregatetimeoriginalestimate ?? tt?.originalEstimateSeconds,
    logged: fields.aggregatetimespent ?? fields.timespent ?? tt?.timeSpentSeconds,
    remaining: fields.aggregatetimeestimate ?? tt?.remainingEstimateSeconds,
  });
}
