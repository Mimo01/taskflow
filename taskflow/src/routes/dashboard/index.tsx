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
      {/* Horizontal flowing waves — orange upper, cyan lower */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M-100,120 C200,80 500,160 800,100 C1000,60 1150,120 1300,90"  fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.22" strokeLinecap="round"/>
        <path d="M-100,220 C250,170 550,260 850,190 C1050,140 1180,200 1300,170" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.14" strokeLinecap="round"/>
        <path d="M-100,340 C300,290 600,370 900,300 C1080,260 1200,310 1300,290" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.08" strokeLinecap="round"/>

        <path d="M-100,480 C200,520 500,440 800,500 C1000,540 1150,480 1300,510" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
        <path d="M-100,600 C250,640 550,560 850,620 C1050,660 1180,600 1300,630" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.13" strokeLinecap="round"/>
        <path d="M-100,700 C300,740 600,670 900,720 C1080,750 1200,710 1300,730" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.07" strokeLinecap="round"/>
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
