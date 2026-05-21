import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import DashboardSprintCard from './DashboardSprintCard';
import DashboardInProgressCard from './DashboardInProgressCard';
import DashboardReleaseCard from './DashboardReleaseCard';

export default function Dashboard() {
  const { jiraBaseUrl, activeJiraProject, jiraUserDisplayName } = useAuthStore();
  const { storyPointsFieldKey } = useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const { onIssueClick } = useOutletContext<{ onIssueClick: (key: string) => void }>();

  // D-16: single point of PAT load; cards receive it as a prop
  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col">
      <section className="bg-gradient-to-br from-primary/5 to-background dark:from-primary/10 dark:to-background px-6 py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {jiraUserDisplayName ?? 'there'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        <DashboardSprintCard
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
          storyPointsFieldKey={storyPointsFieldKey}
        />
        <DashboardInProgressCard
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
          jiraUserDisplayName={jiraUserDisplayName ?? ''}
          storyPointsFieldKey={storyPointsFieldKey}
          onIssueClick={onIssueClick}
        />
        <DashboardReleaseCard
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
        />
      </div>
    </div>
  );
}
