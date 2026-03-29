/**
 * SprintProgressWidget -- compact sprint progress for the widget grid.
 *
 * Reuses the same React Query key as SprintProgressTab to share cache.
 * Shows completion bar and status counts (To Do / In Progress / Done).
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function SprintProgressWidget(_props: { widgetId: string }) {
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

  const computed = (() => {
    const issues = data ?? [];
    const stories = issues.filter((i) => !i.fields.issuetype?.subtask);
    let todo = 0;
    let inProgress = 0;
    let done = 0;
    for (const s of stories) {
      const cat = s.fields.status.statusCategory?.key ?? 'new';
      if (cat === 'done') done++;
      else if (cat === 'indeterminate') inProgress++;
      else todo++;
    }
    const total = todo + inProgress + done;
    const todoPct = total > 0 ? Math.round((todo / total) * 100) : 0;
    const inProgPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const donePct = total > 0 ? 100 - todoPct - inProgPct : 0;
    return { todo, inProgress, done, total, todoPct, inProgPct, donePct };
  })();

  if (!jiraToken || !jiraBaseUrl || !activeJiraProject || isLoading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <span className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load sprint progress'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Completion percentage */}
      <div className="text-lg font-semibold tabular-nums">{computed.donePct}% done</div>

      {/* Stacked bar */}
      {computed.total > 0 && (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          <div style={{ width: `${computed.todoPct}%` }} className="bg-slate-400" />
          <div style={{ width: `${computed.inProgPct}%` }} className="bg-blue-500" />
          <div style={{ width: `${computed.donePct}%` }} className="bg-green-500" />
        </div>
      )}

      {/* Status counts */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-slate-400" />
            <span>To Do</span>
          </div>
          <span className="tabular-nums text-muted-foreground">{computed.todo}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-blue-500" />
            <span>In Progress</span>
          </div>
          <span className="tabular-nums text-muted-foreground">{computed.inProgress}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-green-500" />
            <span>Done</span>
          </div>
          <span className="tabular-nums text-muted-foreground">{computed.done}</span>
        </div>
      </div>
    </div>
  );
}
