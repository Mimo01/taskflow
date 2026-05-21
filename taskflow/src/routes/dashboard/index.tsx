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
      {/* Wave lines emanating from top-right (orange) and bottom-left (cyan) */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Orange waves from top-right */}
        <path d="M1200,0 C950,-30 700,80 500,180 C300,280 100,260 -50,320" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.30" strokeLinecap="round"/>
        <path d="M1200,0 C980,60 780,140 580,260 C380,380 160,380 -50,460" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.22" strokeLinecap="round"/>
        <path d="M1200,0 C1020,120 860,200 660,340 C460,480 220,500 -50,600" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.15" strokeLinecap="round"/>
        <path d="M1200,0 C1060,180 940,280 740,420 C540,560 280,600 -50,720" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.10" strokeLinecap="round"/>
        <path d="M1200,0 C1100,260 1020,380 820,520 C620,660 340,700 -50,820" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.06" strokeLinecap="round"/>

        {/* Cyan waves from bottom-left */}
        <path d="M0,800 C80,580 240,480 440,380 C640,280 860,280 1100,200" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.28" strokeLinecap="round"/>
        <path d="M0,800 C60,620 180,540 380,460 C580,380 820,400 1100,340" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
        <path d="M0,800 C40,660 120,600 320,540 C520,480 780,520 1100,480" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.13" strokeLinecap="round"/>
        <path d="M0,800 C20,700 60,660 260,620 C460,580 740,640 1100,620" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.08" strokeLinecap="round"/>
        <path d="M0,800 C0,740 20,720 200,700 C400,680 700,740 1100,740" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.05" strokeLinecap="round"/>
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
