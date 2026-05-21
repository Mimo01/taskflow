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
      {/* Scattered dot field — orange + cyan bubbles of varying sizes */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large background wash circles */}
        <circle cx="1050" cy="80"  r="320" fill="#f97316" fillOpacity="0.06" />
        <circle cx="180"  cy="700" r="280" fill="#06b6d4" fillOpacity="0.07" />
        <circle cx="900"  cy="600" r="180" fill="#06b6d4" fillOpacity="0.05" />
        <circle cx="260"  cy="160" r="150" fill="#f97316" fillOpacity="0.05" />

        {/* Medium dots */}
        <circle cx="1100" cy="300" r="48" fill="#f97316" fillOpacity="0.12" />
        <circle cx="80"   cy="420" r="42" fill="#06b6d4" fillOpacity="0.14" />
        <circle cx="640"  cy="720" r="36" fill="#f97316" fillOpacity="0.10" />
        <circle cx="440"  cy="60"  r="32" fill="#06b6d4" fillOpacity="0.12" />
        <circle cx="820"  cy="180" r="28" fill="#06b6d4" fillOpacity="0.10" />
        <circle cx="300"  cy="560" r="24" fill="#f97316" fillOpacity="0.13" />

        {/* Small accent dots */}
        <circle cx="700"  cy="40"  r="12" fill="#f97316" fillOpacity="0.20" />
        <circle cx="1150" cy="500" r="10" fill="#06b6d4" fillOpacity="0.22" />
        <circle cx="160"  cy="260" r="10" fill="#f97316" fillOpacity="0.18" />
        <circle cx="560"  cy="660" r="8"  fill="#06b6d4" fillOpacity="0.20" />
        <circle cx="960"  cy="740" r="8"  fill="#f97316" fillOpacity="0.18" />
        <circle cx="380"  cy="360" r="6"  fill="#06b6d4" fillOpacity="0.16" />
        <circle cx="1020" cy="440" r="6"  fill="#f97316" fillOpacity="0.16" />
        <circle cx="740"  cy="520" r="5"  fill="#06b6d4" fillOpacity="0.18" />
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
