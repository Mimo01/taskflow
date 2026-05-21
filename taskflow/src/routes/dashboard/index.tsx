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
      {/* Undulating wave lines — orange top-right, cyan bottom-left */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Orange undulating waves from top-right */}
        <path d="M1200,0 C1050,40 900,20 750,80 C600,140 450,100 300,160 C150,220 50,200 -50,240" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.28" strokeLinecap="round"/>
        <path d="M1200,0 C1060,100 880,60 720,140 C560,220 420,180 260,260 C120,330 20,320 -50,370" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
        <path d="M1200,0 C1080,160 880,110 700,210 C520,310 400,270 220,370 C80,450 0,450 -50,500" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.14" strokeLinecap="round"/>
        <path d="M1200,0 C1100,220 900,170 700,290 C500,410 360,380 180,480 C60,550 -10,560 -50,610" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.09" strokeLinecap="round"/>
        <path d="M1200,0 C1120,300 920,250 720,380 C520,510 340,490 140,600 C20,670 -30,680 -50,730" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.05" strokeLinecap="round"/>

        {/* Cyan undulating waves from bottom-left */}
        <path d="M0,800 C100,680 80,580 200,500 C320,420 360,480 480,400 C600,320 680,360 800,280 C940,190 1060,220 1200,160" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.26" strokeLinecap="round"/>
        <path d="M0,800 C80,700 60,620 160,560 C280,490 340,550 460,480 C600,400 680,440 820,360 C960,280 1080,310 1200,260" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round"/>
        <path d="M0,800 C60,730 40,670 120,620 C240,560 320,620 440,560 C600,480 680,520 840,450 C980,380 1100,410 1200,360" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.12" strokeLinecap="round"/>
        <path d="M0,800 C40,760 20,720 80,690 C200,640 300,700 420,650 C600,580 700,620 860,560 C1000,500 1110,530 1200,490" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.07" strokeLinecap="round"/>
        <path d="M0,800 C20,790 10,770 60,750 C180,710 280,770 420,740 C620,700 720,730 900,690 C1040,660 1140,680 1200,660" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.04" strokeLinecap="round"/>
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
