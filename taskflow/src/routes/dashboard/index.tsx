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
      {/* Intersecting diagonal grids — orange NW→SE, cyan NE→SW */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Orange diagonal lines: top-left to bottom-right */}
          <pattern id="grid-orange" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="80" stroke="#f97316" strokeWidth="1" strokeOpacity="0.12" />
          </pattern>
          {/* Cyan diagonal lines: top-right to bottom-left */}
          <pattern id="grid-cyan" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="80" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.10" />
          </pattern>
          {/* Radial masks so grids fade toward the center */}
          <radialGradient id="fade-tr" cx="100%" cy="0%" r="80%">
            <stop offset="0%"   stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fade-bl" cx="0%" cy="100%" r="80%">
            <stop offset="0%"   stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="mask-tr"><rect width="1200" height="800" fill="url(#fade-tr)" /></mask>
          <mask id="mask-bl"><rect width="1200" height="800" fill="url(#fade-bl)" /></mask>
        </defs>

        {/* Orange grid fading in from top-right */}
        <rect width="1200" height="800" fill="url(#grid-orange)" mask="url(#mask-tr)" />
        {/* Cyan grid fading in from bottom-left */}
        <rect width="1200" height="800" fill="url(#grid-cyan)" mask="url(#mask-bl)" />

        {/* Anchor dots at each origin */}
        <circle cx="1200" cy="0"   r="5" fill="#f97316" fillOpacity="0.25" />
        <circle cx="1200" cy="0"   r="2" fill="#f97316" fillOpacity="0.50" />
        <circle cx="0"    cy="800" r="5" fill="#06b6d4" fillOpacity="0.25" />
        <circle cx="0"    cy="800" r="2" fill="#06b6d4" fillOpacity="0.50" />
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
