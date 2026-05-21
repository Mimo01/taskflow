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
        <path d="M-100,80  C180,40  480,200 720,110 C940,30  1100,140 1300,70"   fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.22" strokeLinecap="round"/>
        <path d="M-100,310 C220,230 520,420 780,300 C980,210 1140,360 1300,280"  fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
        <path d="M-100,190 C260,150 540,280 800,180 C1020,100 1160,230 1300,160" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.13" strokeLinecap="round"/>
        <path d="M-100,500 C200,560 460,420 740,510 C940,580 1120,440 1300,520"  fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.14" strokeLinecap="round"/>
        <path d="M-100,420 C280,340 580,500 860,390 C1060,310 1180,440 1300,370" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.08" strokeLinecap="round"/>
        <path d="M-100,650 C240,720 500,580 780,670 C1000,740 1160,610 1300,680" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.09" strokeLinecap="round"/>
        <path d="M-100,750 C300,690 600,790 900,710 C1100,650 1220,730 1300,700" fill="none" stroke="#f97316" strokeWidth="0.5"  strokeOpacity="0.06" strokeLinecap="round"/>
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
