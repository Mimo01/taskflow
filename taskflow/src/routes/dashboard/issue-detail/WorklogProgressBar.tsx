/**
 * WorklogProgressBar — the shared per-issue time bar (`StackedTimeBar`, 261105-dsl option A)
 * at the top of Issue Detail's Worklog view: full width, caption beside it, hover breakdown.
 * Same data as the sidebar Time Tracking row (Jira aggregates + the already-fetched
 * `subtaskEnrichmentQuery` data, split by subtask status) — no new network query.
 */
import { StackedTimeBar } from '@/components/jira/StackedTimeBar';
import { type TimedSource, timeBarIssues, timeBarModel } from '@/lib/time-bar';
import type { JiraIssueDetail } from '@/services/jira';

interface WorklogProgressBarProps {
  issue: JiraIssueDetail;
  subtasks: readonly TimedSource[] | undefined;
}

export function WorklogProgressBar({ issue, subtasks }: WorklogProgressBarProps) {
  if (issue.fields.issuetype.name === 'Epic') return null;

  const issues = timeBarIssues(issue as unknown as TimedSource, subtasks, {
    isSubtask: issue.fields.issuetype.subtask,
  });
  const m = timeBarModel(issues);
  if (m.estimate <= 0 && m.logged <= 0) return null;

  return (
    <div className="py-2">
      <StackedTimeBar
        issues={issues}
        widthClassName="w-full"
        barClassName="h-2"
        caption="right"
        testId="worklog-time-bar"
      />
    </div>
  );
}
