/**
 * Dashboard — role-aware overview page with enriched panel components.
 *
 * Developer role (default when role is null or 'developer' or 'tech-lead'):
 *   Panels (2×2 grid): SubtasksPanel | MrHealthPanel | SprintHealthPanel | NotificationsPanel
 *
 * PM role:
 *   Panels (2-column grid): SprintHealthPanel | NotificationsPanel
 *
 * Panel components manage their own data fetching via React Query.
 * This file only handles token loading and passing credentials as props.
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSettingsStore } from '@/stores/settings.store';
import { useAuthStore } from '@/stores/auth.store';
import { validateGitLab } from '@/services/gitlab';
import { readSecret } from '@/services/stronghold';
import SubtasksPanel from './SubtasksPanel';
import MrHealthPanel from './MrHealthPanel';
import SprintHealthPanel from './SprintHealthPanel';
import NotificationsPanel from './NotificationsPanel';

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

  // Current user — needed for MrHealthPanel userId prop
  const { data: currentUser } = useQuery({
    queryKey: ['gitlab-current-user', gitlabBaseUrl],
    queryFn: () => validateGitLab(gitlabBaseUrl!, gitlabToken!),
    staleTime: Infinity,
    enabled: !!gitlabBaseUrl && !!gitlabToken,
  });

  if (role === 'pm') {
    return (
      <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
        <h1 className="text-xl font-semibold">Overview</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SprintHealthPanel
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
          />
          <NotificationsPanel />
        </div>
      </div>
    );
  }

  // Developer / tech-lead (default)
  return (
    <div className="flex flex-col h-full p-4 gap-4 overflow-y-auto">
      <h1 className="text-xl font-semibold">Overview</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubtasksPanel
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
        />
        <MrHealthPanel
          gitlabBaseUrl={gitlabBaseUrl ?? ''}
          gitlabToken={gitlabToken ?? ''}
          userId={currentUser?.id}
        />
        <SprintHealthPanel
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
        />
        <NotificationsPanel />
      </div>
    </div>
  );
}
