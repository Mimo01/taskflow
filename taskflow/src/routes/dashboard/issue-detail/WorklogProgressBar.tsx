/**
 * WorklogProgressBar — logged-vs-estimate bar for the Worklog view of Issue Detail.
 *
 * Uses the shared epic-style `IssueTimeBar` full width, with the same one-line
 * caption as the sidebar Time Tracking field. Numbers come from the issue's own
 * Jira aggregate fields (own + subtasks, computed by Jira), so no subtask data
 * or extra query is needed.
 */
import { IssueTimeBar, timedIssueFromJiraFields } from '@/components/jira/IssueTimeBar';
import { estimateOf, loggedOf, remainingOf } from '@/lib/epic-progress';
import type { JiraIssueDetail } from '@/services/jira';
import { timeCaption } from './TimeTrackingSummary';

interface WorklogProgressBarProps {
  issue: JiraIssueDetail;
}

export function WorklogProgressBar({ issue }: WorklogProgressBarProps) {
  if (issue.fields.issuetype.name === 'Epic') return null;

  const timed = timedIssueFromJiraFields(issue.fields, issue.key);
  const est = estimateOf(timed);
  const logged = loggedOf(timed);
  if (est <= 0 && logged <= 0 && remainingOf(timed) <= 0) return null;

  return (
    <div className="flex flex-col gap-0.5 py-2">
      <IssueTimeBar colorBy="health" issue={timed} className="w-full" testId="worklog-time-bar" />
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {timeCaption(logged, est)}
      </span>
    </div>
  );
}
