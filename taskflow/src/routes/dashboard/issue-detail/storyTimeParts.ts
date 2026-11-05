/**
 * Time parts behind a detail-page bar. A story with subtasks is an aggregate: one part per
 * subtask (its own status + time) plus a "story itself" part sized so the parts add up to Jira's
 * aggregate totals (Tempo-only logging can leave nested timetracking empty). Any other issue is
 * a single part. IssueTimeBar splits several parts by status; one part is health-coloured.
 */
import { skipToken, useQuery } from '@tanstack/react-query';
import {
  timedIssue,
  timedIssueFromJiraFields,
  timedIssueOwn,
} from '@/components/jira/IssueTimeBar';
import { estimateOf, loggedOf, remainingOf } from '@/lib/epic-progress';
import type { JiraIssue } from '@/services/jira';

type TimeFields = Parameters<typeof timedIssueFromJiraFields>[0];

export function storyTimeParts(
  fields: TimeFields,
  key: string | undefined,
  subtasks: JiraIssue[] | undefined,
): JiraIssue | JiraIssue[] {
  const total = timedIssueFromJiraFields(fields, key);
  if (!subtasks || subtasks.length === 0) return total;
  const subs = subtasks.map(timedIssueOwn);
  const sum = (f: (i: JiraIssue) => number) => subs.reduce((n, i) => n + f(i), 0);
  const own = timedIssue({
    key,
    statusCategoryKey: (fields.status?.statusCategory as { key?: unknown } | undefined)?.key,
    originalEstimate: Math.max(estimateOf(total) - sum(estimateOf), 0),
    logged: Math.max(loggedOf(total) - sum(loggedOf), 0),
    remaining: Math.max(remainingOf(total) - sum(remainingOf), 0),
  });
  return [own, ...subs];
}

/** Passive read of the subtask enrichment cache filled by IssueDetailView (never fetches). */
export function useCachedEnrichedSubtasks(
  issueKey: string,
  jiraBaseUrl: string,
  subtaskKeys: string[] | undefined,
): JiraIssue[] | undefined {
  const { data } = useQuery<JiraIssue[]>({
    queryKey: ['jira-subtask-enrichment', issueKey, jiraBaseUrl, (subtaskKeys ?? []).join(',')],
    queryFn: skipToken,
  });
  return data;
}
