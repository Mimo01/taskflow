/**
 * Dashboard — role-aware overview page with enriched panel components.
 *
 * Developer role (default when role is null or 'developer' or 'tech-lead'):
 *   Panels (2-column grid): SubtasksPanel | MrHealthPanel | SprintHealthPanel
 *
 * PM role:
 *   Panel (single column): SprintHealthPanel
 *
 * Panel components manage their own data fetching via React Query.
 * This file only handles token loading and passing credentials as props.
 */
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { readSecret } from '@/services/stronghold';
import SubtasksPanel from './SubtasksPanel';
import MrHealthPanel from './MrHealthPanel';
import SprintHealthPanel from './SprintHealthPanel';

export default function Dashboard() {
  const role = useSettingsStore((s) => s.role);
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Track last-refreshed time by subscribing to the my-tasks query (shared cache with SubtasksPanel)
  const [updatedAt, setUpdatedAt] = useState<number>(
    () => queryClient.getQueryState(['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey])?.dataUpdatedAt ?? 0
  );
  useEffect(() => {
    return queryClient.getQueryCache().subscribe(() => {
      const ts = queryClient.getQueryState(['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey])?.dataUpdatedAt;
      if (ts) setUpdatedAt(ts);
    });
  }, [queryClient, activeJiraProject, storyPointsFieldKey]);
  const lastRefreshed = updatedAt
    ? `Refreshed: ${new Date(updatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  useEffect(() => {
    if (jiraBaseUrl) readSecret('jira-pat').then(t => setJiraToken(t)).catch(() => setJiraToken(null));
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) readSecret('gitlab-pat').then(t => setGitlabToken(t)).catch(() => setGitlabToken(null));
  }, [gitlabBaseUrl]);

  function handleRefresh() {
    queryClient.invalidateQueries();
  }

  const header = (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{lastRefreshed}</span>
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>
    </div>
  );

  if (role === 'pm') {
    return (
      <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
        {header}
        <div className="grid grid-cols-1 gap-4">
          <SprintHealthPanel
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
          />
        </div>
      </div>
    );
  }

  // Developer / tech-lead (default)
  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      {header}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubtasksPanel
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
        />
        <MrHealthPanel
          gitlabBaseUrl={gitlabBaseUrl ?? ''}
          gitlabToken={gitlabToken ?? ''}
        />
        <SprintHealthPanel
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
        />
      </div>
    </div>
  );
}
