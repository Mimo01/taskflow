/**
 * TimeTrackingSummary -- the issue sidebar's Time Tracking row: the shared per-issue time bar
 * (`StackedTimeBar`, 261105-dsl option A) full width with its caption below and a hover
 * breakdown.
 *
 * Totals come from Jira's server-computed AGGREGATE fields (`aggregatetimeoriginalestimate`,
 * `aggregatetimeestimate`, `aggregatetimespent`) when present: they sum the issue's own time
 * PLUS its subtasks', including Tempo-logged worklogs the nested `timetracking` object can miss
 * (verified against a real issue whose own `timetracking` was empty). With the enriched
 * subtasks passed in, the bar also splits by subtask status (the story's own part is the
 * aggregate minus its subtasks, so the totals still equal Jira's). Without aggregates it falls
 * back to the nested `timetracking` object; see `timeBarIssues` in lib/time-bar.ts.
 */
import { StackedTimeBar } from '@/components/jira/StackedTimeBar';
import { type TimedSource, timeBarIssues, timeBarModel } from '@/lib/time-bar';
import { MetaRow } from './MetaRow';

interface TimeTrackingSummaryProps {
  /** The issue (its fields carry status, timetracking and the aggregate time fields). */
  issue: TimedSource & { fields: { issuetype?: { subtask?: boolean } } };
  /** Enriched subtasks (own timetracking + status), when loaded. */
  subtasks?: readonly TimedSource[] | null;
}

export function TimeTrackingSummary({ issue, subtasks }: TimeTrackingSummaryProps) {
  const isSubtask = issue.fields.issuetype?.subtask === true;
  const issues = timeBarIssues(issue, subtasks, { isSubtask });
  const m = timeBarModel(issues);
  const hasData = m.logged > 0 || m.estimate > 0;

  return (
    <MetaRow label="Time Tracking">
      {hasData ? (
        <StackedTimeBar
          issues={issues}
          widthClassName="w-full"
          barClassName="h-2"
          testId="time-tracking-bar"
        />
      ) : (
        <span className="text-xs text-muted-foreground">No time logged</span>
      )}
    </MetaRow>
  );
}
