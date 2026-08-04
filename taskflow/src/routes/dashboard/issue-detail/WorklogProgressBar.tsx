/**
 * WorklogProgressBar — standup-style logged-vs-estimated progress bar for the
 * Worklog view of Issue Detail.
 *
 * Visual pattern copied verbatim from `TodayInProgressSection.ProgressBar`
 * (same Progress primitive, color thresholds, and caption typography). The
 * only differences are a full-width container (instead of `w-20`) suited to
 * the detail pane, and aggregation across subtasks for non-subtask issues.
 *
 * Totals come from `aggregateTimeTracking`, fed by the issue's own
 * `timetracking` plus the already-fetched `subtaskEnrichmentQuery` data —
 * no new network query is introduced here.
 */
import { Progress } from '@/components/ui/progress';
import type { JiraIssueDetail } from '@/services/jira';
import { formatDuration } from '@/services/jira/duration';
import { aggregateTimeTracking, type SubtaskWithTimeTracking } from './aggregateTimeTracking';

interface WorklogProgressBarProps {
  issue: JiraIssueDetail;
  subtasks: SubtaskWithTimeTracking[] | undefined;
}

export function WorklogProgressBar({ issue, subtasks }: WorklogProgressBarProps) {
  if (issue.fields.issuetype.name === 'Epic') return null;

  const isSubtask = issue.fields.issuetype.subtask;
  const { spentSeconds, estimateSeconds } = aggregateTimeTracking(
    issue.fields.timetracking,
    subtasks,
    { isSubtask },
  );

  if (!estimateSeconds || estimateSeconds <= 0) return null;

  const fillPct = Math.min(100, Math.round((spentSeconds / estimateSeconds) * 100));
  const indicatorColor =
    spentSeconds >= estimateSeconds
      ? 'bg-red-500'
      : fillPct >= 75
        ? 'bg-amber-500'
        : 'bg-green-500';

  return (
    <div className="flex items-center gap-2 py-2">
      <Progress value={fillPct} className="w-full" indicatorClassName={indicatorColor} />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDuration(spentSeconds)} / {formatDuration(estimateSeconds)}
      </span>
    </div>
  );
}
