import type { JiraIssue } from '@/services/jira';

function trackingOf(issue: JiraIssue) {
  const t = issue.fields.timetracking as
    | {
        timeSpentSeconds?: number;
        originalEstimateSeconds?: number;
        remainingEstimateSeconds?: number;
      }
    | null
    | undefined;
  return {
    spent: t?.timeSpentSeconds ?? 0,
    estimate: t?.originalEstimateSeconds ?? 0,
    remaining: t?.remainingEstimateSeconds,
  };
}

/** Story + its listed subtasks: summed logged / original estimate / remaining (My Tasks, Standup). */
export function accumulateTime(parent: JiraIssue, subtasks: JiraIssue[]) {
  const parentT = trackingOf(parent);
  const subs = subtasks.map(trackingOf);
  const anyRemaining =
    parentT.remaining !== undefined || subs.some((t) => t.remaining !== undefined);
  return {
    accumulatedSpentSeconds: parentT.spent + subs.reduce((n, t) => n + t.spent, 0),
    accumulatedEstimateSeconds: parentT.estimate + subs.reduce((n, t) => n + t.estimate, 0),
    accumulatedRemainingSeconds: anyRemaining
      ? (parentT.remaining ?? 0) + subs.reduce((n, t) => n + (t.remaining ?? 0), 0)
      : undefined,
  };
}
