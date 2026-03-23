/**
 * SprintHealthWidget -- wrapper around SprintHealthPanel for the widget grid.
 *
 * Loads Jira credentials internally from Stronghold and auth store,
 * shows skeleton while loading, then renders the underlying panel.
 */

import { useEffect, useState } from 'react';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { Skeleton } from '@/components/ui/skeleton';
import SprintHealthPanel from '../SprintHealthPanel';

export default function SprintHealthWidget(_props: { widgetId: string }) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then(setJiraToken)
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  if (!jiraToken || !jiraBaseUrl || !activeJiraProject) {
    return (
      <div className="space-y-2 p-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  return (
    <SprintHealthPanel
      jiraBaseUrl={jiraBaseUrl}
      jiraToken={jiraToken}
      activeJiraProject={activeJiraProject}
    />
  );
}
