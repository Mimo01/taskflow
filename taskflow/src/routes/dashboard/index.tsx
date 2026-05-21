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
      {/* Abstract fluid blobs — brand orange + cyan, top-right corner anchor */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large orange blob, top-right */}
        <ellipse cx="1100" cy="-60" rx="380" ry="280" fill="#f97316" fillOpacity="0.10" transform="rotate(-20 1100 -60)" />
        {/* Cyan blob, overlapping */}
        <ellipse cx="980" cy="120" rx="260" ry="200" fill="#06b6d4" fillOpacity="0.10" transform="rotate(15 980 120)" />
        {/* Smaller orange accent, mid-right */}
        <ellipse cx="1180" cy="340" rx="160" ry="120" fill="#f97316" fillOpacity="0.07" transform="rotate(-10 1180 340)" />
        {/* Soft cyan tail, bottom-left */}
        <ellipse cx="80" cy="700" rx="300" ry="180" fill="#06b6d4" fillOpacity="0.06" transform="rotate(25 80 700)" />
        {/* Connecting flow line — orange */}
        <path
          d="M900,0 C860,80 960,160 880,260 C820,330 920,400 860,500"
          stroke="#f97316"
          strokeWidth="60"
          strokeLinecap="round"
          fill="none"
          strokeOpacity="0.05"
        />
        {/* Connecting flow line — cyan */}
        <path
          d="M1050,0 C1000,100 1080,200 1020,320 C970,420 1060,500 990,620"
          stroke="#06b6d4"
          strokeWidth="40"
          strokeLinecap="round"
          fill="none"
          strokeOpacity="0.06"
        />
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
