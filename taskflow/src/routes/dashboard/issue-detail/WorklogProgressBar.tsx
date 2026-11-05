/**
 * WorklogProgressBar — standup-style logged-vs-estimated progress bar for the
 * Worklog view of Issue Detail.
 *
 * Visual pattern copied verbatim from `TodayInProgressSection.ProgressBar`
 * (same Progress primitive and caption typography; colour/fill come from the shared
 * `timeProgress` helper). The
 * only differences are a full-width container (instead of `w-20`) suited to
 * the detail pane, and aggregation across subtasks for non-subtask issues.
 *
 * Totals come from `aggregateTimeTracking`, fed by the issue's own
 * `timetracking` plus the already-fetched `subtaskEnrichmentQuery` data —
 * no new network query is introduced here.
 */
import { spentSegments, toCat } from '@/components/jira/StackedTimeBar';
import { isDoneStatus } from '@/lib/time-progress';
import type { JiraIssueDetail } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { aggregateTimeTracking, type SubtaskWithTimeTracking } from './aggregateTimeTracking';
import { TimeBar } from './EpicBands';

interface WorklogProgressBarProps {
  issue: JiraIssueDetail;
  subtasks: SubtaskWithTimeTracking[] | undefined;
}

export function WorklogProgressBar({ issue, subtasks }: WorklogProgressBarProps) {
  if (issue.fields.issuetype.name === 'Epic') return null;

  const isDone = isDoneStatus(issue.fields.status?.statusCategory?.key);
  const isSubtask = issue.fields.issuetype.subtask;
  const { spentSeconds, estimateSeconds } = aggregateTimeTracking(
    issue.fields.timetracking,
    subtasks,
    { isSubtask, isDone },
  );

  if (!estimateSeconds || estimateSeconds <= 0) return null;

  return (
    <div className="flex items-center gap-2 py-2">
      <TimeBar
        segments={spentSegments(
          spentSeconds,
          estimateSeconds,
          isDone,
          toCat(issue.fields.status?.statusCategory?.key),
        )}
        estimate={estimateSeconds}
        className="h-1.5 w-full rounded-full"
      />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDuration(spentSeconds)} / {formatDuration(estimateSeconds)}
      </span>
    </div>
  );
}
