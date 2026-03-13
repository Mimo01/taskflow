/**
 * SprintHealthPanel — DASH-03
 *
 * Shows sprint health at a glance:
 * - "N days left" (hidden when endDate unavailable)
 * - "N% done" computed from story points (zero-denominator guarded)
 * - "N at-risk" in-progress stories with no time logged
 * - List of at-risk item keys + summaries
 *
 * Uses 4-element sprint-board cache key matching SprintProgressTab.
 * Uses ['jira-active-sprint', activeJiraProject] for endDate.
 */
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/stores/settings.store';
import { fetchSprintIssues, fetchActiveSprint } from '@/services/jira';
import type { JiraIssue } from '@/services/jira';

export interface SprintHealthPanelProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
}

function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function SprintHealthPanel({ jiraBaseUrl, jiraToken, activeJiraProject }: SprintHealthPanelProps) {
  const { storyPointsFieldKey } = useSettingsStore();

  const { data: sprintIssuesRaw, isLoading: issuesLoading } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const { data: activeSprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['jira-active-sprint', activeJiraProject],
    queryFn: () => fetchActiveSprint(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const isLoading = issuesLoading || sprintLoading;

  // Normalise: fetchSprintIssues returns JiraIssue[] directly
  const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];

  const stories = sprintIssues.filter((i) => !i.fields.issuetype.subtask);

  const donePoints = stories
    .filter((i) => i.fields.status.statusCategory?.key === 'done')
    .reduce(
      (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
      0,
    );

  const totalPoints = stories.reduce(
    (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
    0,
  );

  const donePct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  const daysLeft = getDaysRemaining(activeSprint?.endDate);

  const atRiskIssues = stories.filter(
    (i) =>
      i.fields.status.statusCategory?.key === 'indeterminate' &&
      (i.fields.timetracking?.timeSpentSeconds ?? 0) === 0,
  );

  // Build summary line parts
  const summaryParts: string[] = [];
  if (daysLeft !== null) summaryParts.push(`${daysLeft} days left`);
  summaryParts.push(`${donePct}% done`);
  summaryParts.push(`${atRiskIssues.length} at-risk`);
  const summaryLine = summaryParts.join(' · ');

  const noData = !isLoading && sprintIssues.length === 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Sprint Health
      </h2>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-5 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && noData && (
        <p className="text-sm text-muted-foreground">No sprint data available</p>
      )}

      {!isLoading && !noData && (
        <>
          <p className="text-sm font-medium">{summaryLine}</p>

          {atRiskIssues.length > 0 && (
            <ul className="flex flex-col gap-0.5 mt-1">
              {atRiskIssues.map((i) => (
                <li key={i.key} className="text-xs text-muted-foreground truncate">
                  {i.key} {i.fields.summary}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
