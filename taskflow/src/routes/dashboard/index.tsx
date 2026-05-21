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
        {/* Orange waves from top-right — staggered vertically */}
        <path d="M1200,-10 C880,40 680,120 460,210 C260,295 80,270 -50,330" fill="none" stroke="#f97316" strokeWidth="2"    strokeOpacity="0.28" strokeLinecap="round"/>
        <path d="M1200,50  C920,110 720,190 520,310 C340,420 140,420 -50,500" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
        <path d="M1200,110 C980,180 800,270 600,400 C420,510 200,530 -50,630" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.13" strokeLinecap="round"/>
        <path d="M1200,170 C1040,260 880,360 680,490 C500,600 260,640 -50,750" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.08" strokeLinecap="round"/>
        <path d="M1200,240 C1080,360 960,460 760,590 C580,700 320,740 -50,850" fill="none" stroke="#f97316" strokeWidth="0.5"  strokeOpacity="0.05" strokeLinecap="round"/>

        {/* Cyan waves from bottom-left — staggered vertically */}
        <path d="M0,650 C100,470 280,390 480,300 C660,215 880,220 1100,150" fill="none" stroke="#06b6d4" strokeWidth="2"    strokeOpacity="0.26" strokeLinecap="round"/>
        <path d="M0,700 C80,530 220,460 420,390 C600,325 840,350 1100,290" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round"/>
        <path d="M0,745 C60,620 160,560 360,510 C540,465 800,500 1100,460" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.12" strokeLinecap="round"/>
        <path d="M0,785 C40,715 100,685 280,660 C480,635 750,670 1100,645" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.07" strokeLinecap="round"/>
        <path d="M0,825 C80,800 180,785 340,778 C540,770 780,800 1100,790" fill="none" stroke="#06b6d4" strokeWidth="0.5"  strokeOpacity="0.04" strokeLinecap="round"/>
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
