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
    <div className="relative flex flex-col min-h-full bg-background">
      {/* Concentric arcs spanning full page — orange top-right, cyan bottom-left */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="1200" cy="0" r="100" fill="#f97316" fillOpacity="0.09" />
        <circle cx="1200" cy="0" r="180" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.22" />
        <circle cx="1200" cy="0" r="280" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.18" />
        <circle cx="1200" cy="0" r="400" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.13" />
        <circle cx="1200" cy="0" r="540" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.09" />
        <circle cx="1200" cy="0" r="700" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.06" />
        <circle cx="1200" cy="0" r="880" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.04" />
        <circle cx="0" cy="800" r="80"  fill="#06b6d4" fillOpacity="0.09" />
        <circle cx="0" cy="800" r="160" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.20" />
        <circle cx="0" cy="800" r="260" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.15" />
        <circle cx="0" cy="800" r="380" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.10" />
        <circle cx="0" cy="800" r="520" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.07" />
        <circle cx="0" cy="800" r="680" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.04" />
      </svg>

      <section className="relative px-8 py-12 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{timeGreeting} {firstName ?? 'there'}</h1>
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
