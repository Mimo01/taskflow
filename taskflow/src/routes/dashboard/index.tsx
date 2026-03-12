/**
 * Dashboard — role-aware overview page with live summary cards.
 *
 * Developer role (default when role is null or 'developer'):
 *   Cards: Active Sprint Tasks | Open MRs | MRs Needing Attention
 *
 * PM role:
 *   Cards: Sprint Completion | Team Workload | Next Release
 *
 * Data is fetched via React Query using the same query keys as the tab
 * components so the cache is shared and no duplicate requests are made.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { fetchSprintIssues, fetchFixVersions } from '@/services/jira';
import { fetchAssignedMRs, fetchReviewerMRs, validateGitLab } from '@/services/gitlab';
import { readSecret } from '@/services/stronghold';

export default function Dashboard() {
  const role = useSettingsStore((s) => s.role);
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) readSecret('jira-pat').then(t => setJiraToken(t)).catch(() => setJiraToken(null));
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) readSecret('gitlab-pat').then(t => setGitlabToken(t)).catch(() => setGitlabToken(null));
  }, [gitlabBaseUrl]);

  // Developer cards queries
  // Card 1: Active Sprint Tasks — assigned to me
  const { data: myTasks, isLoading: loadingMyTasks, isError: errorMyTasks } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, true),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken && role !== 'pm',
    staleTime: 30_000,
  });

  // Card 2: Open MRs (assigned to me)
  const { data: assignedMrs, isLoading: loadingAssignedMrs, isError: errorAssignedMrs } = useQuery({
    queryKey: ['gitlab-mrs', gitlabBaseUrl],
    queryFn: async () => {
      const [assigned] = await Promise.all([fetchAssignedMRs(gitlabBaseUrl!, gitlabToken!)]);
      return assigned;
    },
    enabled: !!gitlabBaseUrl && !!gitlabToken && role !== 'pm',
    staleTime: 30_000,
  });

  // Card 3: MRs Needing Attention (reviewer MRs) — need current user ID
  const { data: currentUser } = useQuery({
    queryKey: ['gitlab-current-user', gitlabBaseUrl],
    queryFn: () => validateGitLab(gitlabBaseUrl!, gitlabToken!),
    staleTime: Infinity,
    enabled: !!gitlabBaseUrl && !!gitlabToken && role !== 'pm',
  });
  const { data: reviewerMrs, isLoading: loadingReviewerMrs, isError: errorReviewerMrs } = useQuery({
    queryKey: ['gitlab-reviewer-mrs-dashboard', gitlabBaseUrl, currentUser?.id],
    queryFn: () => fetchReviewerMRs(gitlabBaseUrl!, gitlabToken!, currentUser!.id),
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!currentUser?.id && role !== 'pm',
    staleTime: 30_000,
  });

  // PM cards queries
  // Card 1: Sprint Completion % — share cache with SprintProgressTab
  const { data: sprintIssues, isLoading: loadingSprintIssues, isError: errorSprintIssues } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject],
    queryFn: () => fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken && role === 'pm',
    staleTime: 30_000,
  });

  // Card 3: Next Release — share cache with ReleasesTab
  const { data: fixVersions, isLoading: loadingFixVersions, isError: errorFixVersions } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: () => fetchFixVersions(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken && role === 'pm',
    staleTime: 5 * 60_000,
  });

  // Derived values
  const activeTasksCount = myTasks?.length ?? null;
  const openMrCount = assignedMrs?.length ?? null;
  const attentionMrCount = reviewerMrs?.length ?? null;

  const sprintDone = sprintIssues?.filter(i => i.fields.status.statusCategory?.key === 'done').length ?? 0;
  const sprintTotal = sprintIssues?.length ?? 0;
  const sprintCompletionStr = sprintTotal > 0 ? `${Math.round((sprintDone / sprintTotal) * 100)}%` : null;

  const inProgressCount = sprintIssues?.filter(i => i.fields.status.statusCategory?.key === 'indeterminate').length ?? null;

  const versions = fixVersions ?? [];
  const nextRelease = versions
    .filter(v => !v.released && v.releaseDate)
    .sort((a, b) => new Date(a.releaseDate!).getTime() - new Date(b.releaseDate!).getTime())[0];
  const nextReleaseStr = nextRelease ? `${nextRelease.name} · ${nextRelease.releaseDate}` : null;

  // Card render helper
  function cardValue(loading: boolean, error: boolean, value: number | string | null): React.ReactNode {
    if (loading) return <span className="animate-pulse text-muted-foreground">—</span>;
    if (error) return <span className="text-destructive text-sm">Error</span>;
    if (value === null) return <span className="text-muted-foreground">—</span>;
    return <>{value}</>;
  }

  // Card definitions
  const devCards = [
    {
      label: 'Active Sprint Tasks',
      loading: loadingMyTasks,
      error: errorMyTasks,
      value: activeTasksCount,
    },
    {
      label: 'Open MRs',
      loading: loadingAssignedMrs,
      error: errorAssignedMrs,
      value: openMrCount,
    },
    {
      label: 'MRs Needing Attention',
      loading: loadingReviewerMrs,
      error: errorReviewerMrs,
      value: attentionMrCount,
    },
  ];

  const pmCards = [
    {
      label: 'Sprint Completion',
      loading: loadingSprintIssues,
      error: errorSprintIssues,
      value: sprintCompletionStr,
    },
    {
      label: 'Team Workload',
      loading: loadingSprintIssues,
      error: errorSprintIssues,
      value: inProgressCount,
    },
    {
      label: 'Next Release',
      loading: loadingFixVersions,
      error: errorFixVersions,
      value: nextReleaseStr,
    },
  ];

  const cards = role === 'pm' ? pmCards : devCards;

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold mt-1">
              {cardValue(card.loading, card.error, card.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
