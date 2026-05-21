import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import DashboardSprintCard from './DashboardSprintCard';
import DashboardInProgressCard from './DashboardInProgressCard';
import DashboardReleaseCard from './DashboardReleaseCard';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
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

  // Jira displayName is "Surname Firstname [Status]" — index 1 is first name, fallback to index 0
  const tokens = jiraUserDisplayName?.trim().split(/\s+/) ?? [];
  const firstName = tokens[1] ?? tokens[0] ?? null;
  const timeGreeting = getTimeGreeting();

  return (
    <div className="relative flex flex-col min-h-full bg-white dark:bg-background">
      {/* Corner half-disc wash + halftone dot grid */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="wash-orange" cx="100%" cy="0%" r="70%">
            <stop offset="0%"   stopColor="#f97316" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="wash-cyan" cx="0%" cy="100%" r="70%">
            <stop offset="0%"   stopColor="#06b6d4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
          {/* Halftone dot: orange, sized by proximity to top-right */}
          <pattern id="dots-orange" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="5" fill="#f97316" fillOpacity="0.22" />
          </pattern>
          {/* Halftone dot: cyan, sized by proximity to bottom-left */}
          <pattern id="dots-cyan" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="5" fill="#06b6d4" fillOpacity="0.20" />
          </pattern>
          <radialGradient id="mask-tr-grad" cx="100%" cy="0%" r="75%">
            <stop offset="0%"   stopColor="white" stopOpacity="1" />
            <stop offset="55%"  stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mask-bl-grad" cx="0%" cy="100%" r="75%">
            <stop offset="0%"   stopColor="white" stopOpacity="1" />
            <stop offset="55%"  stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="m-tr"><rect width="1200" height="800" fill="url(#mask-tr-grad)" /></mask>
          <mask id="m-bl"><rect width="1200" height="800" fill="url(#mask-bl-grad)" /></mask>
        </defs>

        {/* Soft colour wash */}
        <rect width="1200" height="800" fill="url(#wash-orange)" />
        <rect width="1200" height="800" fill="url(#wash-cyan)" />

        {/* Dot grids masked to each corner */}
        <rect width="1200" height="800" fill="url(#dots-orange)" mask="url(#m-tr)" />
        <rect width="1200" height="800" fill="url(#dots-cyan)"   mask="url(#m-bl)" />
      </svg>

      <section className="relative px-8 py-14">
        <p className="text-xs font-medium text-muted-foreground tracking-widest uppercase mb-3">{timeGreeting.replace(',', '')}</p>
        <h1 className="text-6xl font-extrabold tracking-tight text-foreground">{firstName ?? '—'}</h1>
        <p className="text-sm text-muted-foreground mt-3">{today}</p>
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
