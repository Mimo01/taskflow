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
      {/* Radial spokes — alternating orange + cyan lines from top-right, rings from bottom-left */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Orange spokes radiating from top-right */}
        {([210,225,240,255,270,285,300,315,330,345,360,375,390,405,420] as number[]).map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const len = 900;
          return (
            <line
              key={angle}
              x1={1200} y1={0}
              x2={1200 + Math.cos(rad) * len}
              y2={0 + Math.sin(rad) * len}
              stroke={i % 2 === 0 ? '#f97316' : '#06b6d4'}
              strokeWidth={i % 2 === 0 ? 1.5 : 1}
              strokeOpacity={i % 2 === 0 ? 0.18 : 0.14}
              strokeLinecap="round"
            />
          );
        })}

        {/* Soft filled wedge behind spokes */}
        <path d="M1200,0 L300,0 L0,400 L0,0 Z" fill="#f97316" fillOpacity="0.04" />
        <path d="M1200,0 L1200,500 L600,800 L0,800 L0,400 Z" fill="#06b6d4" fillOpacity="0.04" />

        {/* Ring accents at origin */}
        <circle cx="1200" cy="0" r="100" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.20" />
        <circle cx="1200" cy="0" r="200" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.14" />
        <circle cx="1200" cy="0" r="320" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.09" />
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
