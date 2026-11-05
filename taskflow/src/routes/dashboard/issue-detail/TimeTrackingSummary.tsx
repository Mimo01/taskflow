/**
 * TimeTrackingSummary -- Sidebar time tracking field.
 *
 * Shows the shared epic-style `IssueTimeBar` (logged vs remaining, tick at the
 * estimate; tooltip carries the full breakdown) at the full width of the value
 * column, with a one-line "{logged} / {estimate}" caption beside it (or
 * "{logged} · No estimate" when there is no estimate). The sidebar keeps the
 * caption because the numbers are the field's value.
 *
 * Primary data source: Jira's own server-computed AGGREGATE system fields
 * (`aggregatetimeoriginalestimate`, `aggregatetimeestimate`,
 * `aggregatetimespent`, `timespent`) -- distinct from the nested
 * `fields.timetracking.*Seconds` sub-object. Jira computes these reliably,
 * summing the issue's own time tracking PLUS all of its subtasks', including
 * worklogs written by 3rd-party providers like Tempo (where the issue's own
 * nested `timetracking` sub-object can be empty). The nested sub-object is only
 * a fallback when an aggregate field is absent (see `timedIssueFromJiraFields`).
 * No client-side worklog or subtask summing is needed: Jira already does it.
 */
import { IssueTimeBar, timedIssueFromJiraFields } from '@/components/jira/IssueTimeBar';
import { estimateOf, loggedOf, remainingOf } from '@/lib/epic-progress';
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
  /** Status category key of the issue (`done` / `indeterminate` / `new`). */
  statusCategoryKey?: unknown;
}

/** One-line caption shared by the sidebar and the Worklog bar. */
export function timeCaption(logged: number, est: number): string {
  return est > 0
    ? `${formatDuration(logged)} / ${formatDuration(est)}`
    : `${formatDuration(logged)} · No estimate`;
}

export function TimeTrackingSummary({
  timetracking,
  aggregatetimeoriginalestimate,
  aggregatetimeestimate,
  aggregatetimespent,
  timespent,
  statusCategoryKey,
}: TimeTrackingSummaryProps) {
  const issue = timedIssueFromJiraFields({
    status: { statusCategory: { key: statusCategoryKey } },
    timetracking,
    aggregatetimeoriginalestimate,
    aggregatetimeestimate,
    aggregatetimespent,
    timespent,
  });
  const est = estimateOf(issue);
  const logged = loggedOf(issue);
  const hasData = est > 0 || logged > 0 || remainingOf(issue) > 0;

  return (
    <MetaRow label="Time Tracking">
      {!hasData ? (
        <span className="text-xs text-muted-foreground">No time logged</span>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <IssueTimeBar issue={issue} className="min-w-0 flex-1" testId="sidebar-time-bar" />
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {timeCaption(logged, est)}
          </span>
        </div>
      )}
    </MetaRow>
  );
}
