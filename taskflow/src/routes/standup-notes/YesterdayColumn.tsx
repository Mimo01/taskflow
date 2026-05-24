/**
 * YesterdayColumn — stub for Task 1 TypeScript check.
 * Full implementation in Task 2.
 */

import type { UseQueryResult } from '@tanstack/react-query';
import type { JiraActivityItem } from '@/services/jira';
import type { GitLabCommit, GitLabUserMREvent } from '@/services/gitlab';
import type { TempoWorklog } from '@/services/tempo';

export interface YesterdayColumnProps {
  tempoEnabled: boolean;
  yesterdayDate: string;
  dateLabel: string;
  tempoQuery: UseQueryResult<TempoWorklog[], Error>;
  jiraActivityQuery: UseQueryResult<JiraActivityItem[], Error>;
  commitsQuery: UseQueryResult<GitLabCommit[], Error>;
  mrEventsQuery: UseQueryResult<GitLabUserMREvent[], Error>;
}

export interface MarkdownSources {
  tempoData?: TempoWorklog[];
  jiraData?: JiraActivityItem[];
  commitsData?: GitLabCommit[];
  mrEventsData?: GitLabUserMREvent[];
}

/**
 * Generate a markdown summary for clipboard.
 * Stub implementation for Task 1 — full version in Task 2.
 */
export function generateMarkdown(sources: MarkdownSources, date: string): string {
  const lines: string[] = [`## Yesterday (${date})`, ''];
  if (
    !sources.tempoData?.length &&
    !sources.jiraData?.length &&
    !sources.commitsData?.length &&
    !sources.mrEventsData?.length
  ) {
    lines.push('Nothing to recap.');
  }
  return lines.join('\n');
}

export default function YesterdayColumn({
  yesterdayDate,
  dateLabel,
}: YesterdayColumnProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Yesterday</h2>
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>
      <p className="text-xs text-muted-foreground">{yesterdayDate}</p>
    </div>
  );
}
