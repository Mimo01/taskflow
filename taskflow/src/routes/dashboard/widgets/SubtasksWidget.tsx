/**
 * SubtasksWidget -- wrapper around SubtasksPanel for the widget grid.
 *
 * Loads Jira credentials internally from Stronghold and auth store,
 * shows skeleton while loading, then renders the underlying panel.
 */

import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import SubtasksPanel from '../SubtasksPanel';

export default function SubtasksWidget(_props: { widgetId: string }) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const { onIssueClick } = useOutletContext<{
    onIssueClick?: (key: string) => void;
  }>();

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
    <SubtasksPanel
      jiraBaseUrl={jiraBaseUrl}
      jiraToken={jiraToken}
      activeJiraProject={activeJiraProject}
      onIssueClick={onIssueClick}
    />
  );
}
