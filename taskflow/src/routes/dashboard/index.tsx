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
      {/* Low-poly triangle mesh — orange + cyan facets */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top-right cluster — orange dominant */}
        <polygon points="1200,0 900,0 1100,220"    fill="#f97316" fillOpacity="0.10" />
        <polygon points="900,0 1100,220 800,180"   fill="#06b6d4" fillOpacity="0.07" />
        <polygon points="1100,220 1200,0 1200,320"  fill="#f97316" fillOpacity="0.07" />
        <polygon points="800,180 1100,220 950,400"  fill="#06b6d4" fillOpacity="0.06" />
        <polygon points="1200,0 1200,320 1100,220"  fill="#06b6d4" fillOpacity="0.05" />
        <polygon points="900,0 700,0 800,180"       fill="#f97316" fillOpacity="0.06" />
        <polygon points="1200,320 1200,560 950,400" fill="#f97316" fillOpacity="0.05" />
        <polygon points="950,400 1200,560 1100,620" fill="#06b6d4" fillOpacity="0.06" />

        {/* Bottom-left cluster — cyan dominant */}
        <polygon points="0,800 300,800 100,560"    fill="#06b6d4" fillOpacity="0.10" />
        <polygon points="300,800 100,560 400,620"  fill="#f97316" fillOpacity="0.07" />
        <polygon points="0,800 0,480 100,560"      fill="#06b6d4" fillOpacity="0.07" />
        <polygon points="400,620 100,560 280,420"  fill="#06b6d4" fillOpacity="0.06" />
        <polygon points="0,480 100,560 0,800"      fill="#f97316" fillOpacity="0.04" />
        <polygon points="300,800 500,800 400,620"  fill="#06b6d4" fillOpacity="0.05" />
        <polygon points="0,480 0,260 180,360"      fill="#f97316" fillOpacity="0.05" />
        <polygon points="180,360 280,420 0,480"    fill="#06b6d4" fillOpacity="0.04" />
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
