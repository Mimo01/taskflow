/**
 * WorkloadWidget -- compact team workload for the widget grid.
 *
 * Shows team member list with assigned issue counts as horizontal bars.
 * Loads Jira token internally and shares the TanStack Query cache with WorkloadTab.
 */

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

interface CompactWorkloadRow {
  name: string;
  count: number;
  points: number;
}

export default function WorkloadWidget(_props: { widgetId: string }) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { storyPointsFieldKey } = useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then(setJiraToken)
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    staleTime: 30_000,
  });

  const rows = useMemo((): CompactWorkloadRow[] => {
    const issues = data ?? [];
    const stories = issues.filter((i) => !i.fields.issuetype?.subtask);
    const map = new Map<string, CompactWorkloadRow>();
    for (const story of stories) {
      const name = story.fields.assignee?.displayName ?? 'Unassigned';
      const pts = (story.fields[storyPointsFieldKey] as number | null) ?? 0;
      const existing = map.get(name) ?? { name, count: 0, points: 0 };
      existing.count++;
      existing.points += pts;
      map.set(name, existing);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.points - a.points || a.name.localeCompare(b.name),
    );
  }, [data, storyPointsFieldKey]);

  const maxPts = useMemo(() => Math.max(1, ...rows.map((r) => r.points)), [rows]);

  if (!jiraToken || !jiraBaseUrl || !activeJiraProject || isLoading) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load workload'}
        </span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Users className="size-5" />
          <span className="text-sm">No workload data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 p-2 overflow-auto">
      {rows.map((row) => (
        <div key={row.name} className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{row.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {row.count} tasks / {row.points} pts
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((row.points / maxPts) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
