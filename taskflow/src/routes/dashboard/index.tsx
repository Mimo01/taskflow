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
    <div className="flex flex-col min-h-full bg-background">
      <section className="relative overflow-hidden px-8 py-12 text-center">
        {/* Concentric arcs — orange top-right, cyan bottom-left */}
        <svg
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 800 300"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="800" cy="0" r="80"  fill="#f97316" fillOpacity="0.10" />
          <circle cx="800" cy="0" r="140" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.25" />
          <circle cx="800" cy="0" r="210" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.20" />
          <circle cx="800" cy="0" r="290" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.14" />
          <circle cx="800" cy="0" r="380" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.10" />
          <circle cx="800" cy="0" r="480" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.07" />
          <circle cx="0"   cy="300" r="60"  fill="#06b6d4" fillOpacity="0.10" />
          <circle cx="0"   cy="300" r="120" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.20" />
          <circle cx="0"   cy="300" r="200" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.12" />
          <circle cx="0"   cy="300" r="300" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.08" />
        </svg>

        <div className="relative">
          <h1 className="text-4xl font-semibold tracking-tight">{timeGreeting} {firstName ?? 'there'}</h1>
          <p className="text-sm text-muted-foreground mt-2">{today}</p>
        </div>
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
