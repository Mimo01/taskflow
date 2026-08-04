/**
 * TimeTrackingSummary -- Sidebar time tracking summary (progress bar only).
 *
 * Shows a spent-vs-estimate progress bar with a "{spent} / {estimate}"
 * caption when an estimate is available, or just "Spent: X" text otherwise.
 * Visual pattern matches the My Tasks page's `StackedTimeBar` (`MyTaskRow.tsx`): shared `Progress`
 * primitive, `h-1.5 w-full rounded-full` track, same color thresholds (green
 * under 75%, amber from 75% up to 100%, red on overrun), and the caption
 * stacked below the bar rather than beside it. The bar is intentionally
 * omitted (not rendered as a misleading 0%/full bar) when there's no estimate
 * at all.
 *
 * Primary data source: Jira's own server-computed AGGREGATE system fields
 * (`aggregatetimeoriginalestimate`, `aggregatetimeestimate`,
 * `aggregatetimespent`, `timespent`) -- distinct from the nested
 * `fields.timetracking.*Seconds` sub-object. These aggregate fields are
 * computed reliably by Jira itself, summing the issue's own time tracking
 * PLUS all of its subtasks', including for worklogs written by 3rd-party
 * providers like Tempo (verified directly against a real failing issue's raw
 * REST response: `aggregatetimespent`/`timespent` correctly reflected Tempo-
 * logged time, and `aggregatetimeoriginalestimate` correctly reflected the
 * sum of subtask estimates, when the parent issue's own nested `timetracking`
 * sub-object was empty).
 *
 * Falls back to the nested `timetracking` sub-object's own
 * originalEstimateSeconds/remainingEstimateSeconds/timeSpentSeconds only when
 * the aggregate fields are entirely absent (e.g. an older Jira instance that
 * doesn't return them) -- this keeps the component correct even without the
 * aggregate fields, without needing any client-side worklog-summing or
 * subtask-aggregation logic (that approach -- summing worklogs and/or
 * subtasks by hand -- was tried across several rounds and was solving the
 * wrong layer: Jira already computes and exposes this aggregate natively).
 *
 * The progress percentage itself prefers Jira's own `aggregateprogress.percent`
 * (server-computed, own + subtasks, consistent with the spent/estimate fields
 * above) and only falls back to a locally-computed spent/estimate ratio when
 * `aggregateprogress` isn't present.
 */
import { Progress } from '@/components/ui/progress';
import { formatDuration } from '@/services/jira/duration';
import { MetaRow } from './MetaRow';

interface TimeTrackingData {
  originalEstimate?: string;
  remainingEstimate?: string;
  timeSpent?: string;
  originalEstimateSeconds?: number;
  remainingEstimateSeconds?: number;
  timeSpentSeconds?: number;
}

interface TimeTrackingSummaryProps {
  timetracking: TimeTrackingData | undefined;
  /** Jira's server-computed aggregate original estimate (own + subtasks), in seconds. */
  aggregatetimeoriginalestimate?: number | null;
  /** Jira's server-computed aggregate remaining estimate (own + subtasks), in seconds. */
  aggregatetimeestimate?: number | null;
  /** Jira's server-computed aggregate time spent (own + subtasks), in seconds. */
  aggregatetimespent?: number | null;
  /** Jira's own (non-aggregate) time spent on this issue, in seconds. */
  timespent?: number | null;
  /** Jira's server-computed aggregate progress (own + subtasks); `percent` is preferred over deriving one from spent/estimate. */
  aggregateprogress?: { progress: number; total: number; percent?: number } | null;
}

export function TimeTrackingSummary({
  timetracking,
  aggregatetimeoriginalestimate,
  aggregatetimeestimate,
  aggregatetimespent,
  timespent,
  aggregateprogress,
}: TimeTrackingSummaryProps) {
  const spent = aggregatetimespent ?? timespent ?? timetracking?.timeSpentSeconds ?? 0;
  const estimate =
    aggregatetimeoriginalestimate ??
    aggregatetimeestimate ??
    timetracking?.originalEstimateSeconds ??
    timetracking?.remainingEstimateSeconds ??
    0;
  const hasData = spent > 0 || estimate > 0;

  // Bar only makes sense when there's an estimate to measure progress against;
  // omit it entirely otherwise rather than showing a misleading 0%/full bar.
  const rawPercent = aggregateprogress?.percent ?? Math.round((spent / estimate) * 100);
  const fillPct = Math.min(100, Math.max(0, rawPercent));
  const isOverrun = spent >= estimate && estimate > 0;
  const indicatorColor = isOverrun ? 'bg-red-500' : fillPct >= 75 ? 'bg-amber-500' : 'bg-green-500';

  return (
    <MetaRow label="Time Tracking">
      {!hasData ? (
        <span className="text-xs text-muted-foreground">No time logged</span>
      ) : estimate > 0 ? (
        <div className="flex flex-col gap-0.5">
          <Progress
            value={fillPct}
            className="h-1.5 w-full rounded-full"
            indicatorClassName={`${indicatorColor} rounded-full`}
          />
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatDuration(spent)} / {formatDuration(estimate)}
          </span>
        </div>
      ) : (
        <div className="space-y-1">
          <span className="text-xs">
            Spent: {spent > 0 ? formatDuration(spent) : (timetracking?.timeSpent ?? '—')}
          </span>
          <span className="text-xs text-muted-foreground ml-2">No estimate</span>
        </div>
      )}
    </MetaRow>
  );
}
