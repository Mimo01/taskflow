import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import DashboardSprintCard from './DashboardSprintCard';
import DashboardInProgressCard from './DashboardInProgressCard';
import DashboardReleaseCard from './DashboardReleaseCard';

function getGreeting(firstName: string | null): string {
  const hour = new Date().getHours();
  const name = firstName ?? 'there';
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

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

  // Extract first name: take the first whitespace-delimited token
  const firstName = jiraUserDisplayName?.trim().split(/\s+/)[0] ?? null;
  const greeting = getGreeting(firstName);

  return (
    <div className="relative flex flex-col min-h-full bg-white dark:bg-background">
      {/* Concentric arcs — brand orange + cyan, top-right corner */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="1200" cy="0" r="220" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.18" />
        <circle cx="1200" cy="0" r="320" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.15" />
        <circle cx="1200" cy="0" r="420" fill="none" stroke="#f97316" strokeWidth="1" strokeOpacity="0.10" />
        <circle cx="1200" cy="0" r="520" fill="none" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.08" />
        <circle cx="1200" cy="0" r="640" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.06" />
        <circle cx="1200" cy="0" r="780" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.05" />
        {/* Filled arc cap to make corner feel anchored */}
        <circle cx="1200" cy="0" r="120" fill="#f97316" fillOpacity="0.07" />
        <circle cx="1200" cy="0" r="60" fill="#06b6d4" fillOpacity="0.09" />
        {/* Subtle bottom-left echo */}
        <circle cx="0" cy="800" r="180" fill="none" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.07" />
        <circle cx="0" cy="800" r="280" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.05" />
      </svg>

      <section className="relative px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-2">{today}</p>
      </section>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
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
