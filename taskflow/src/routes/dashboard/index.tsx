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
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 to-background dark:from-primary/10 dark:to-background px-6 py-10 text-center">
        {/* Decorative sparkle SVG — themed via text-primary, decorative only */}
        <svg
          aria-hidden="true"
          className="absolute right-8 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none text-primary"
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Central sun / sparkle shape */}
          <circle cx="60" cy="60" r="18" fill="currentColor" fillOpacity="0.18" />
          {/* Rays */}
          <line x1="60" y1="10" x2="60" y2="32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.25" />
          <line x1="60" y1="88" x2="60" y2="110" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.25" />
          <line x1="10" y1="60" x2="32" y2="60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.25" />
          <line x1="88" y1="60" x2="110" y2="60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.25" />
          <line x1="25" y1="25" x2="41" y2="41" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.18" />
          <line x1="79" y1="79" x2="95" y2="95" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.18" />
          <line x1="95" y1="25" x2="79" y2="41" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.18" />
          <line x1="41" y1="79" x2="25" y2="95" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.18" />
          {/* Outer sparkle dots */}
          <circle cx="60" cy="6" r="3" fill="currentColor" fillOpacity="0.15" />
          <circle cx="60" cy="114" r="3" fill="currentColor" fillOpacity="0.15" />
          <circle cx="6" cy="60" r="3" fill="currentColor" fillOpacity="0.15" />
          <circle cx="114" cy="60" r="3" fill="currentColor" fillOpacity="0.15" />
        </svg>

        <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>
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
