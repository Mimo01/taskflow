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
      {/* Undulating waves — staggered starts across all edges */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Orange — from top edge, varied x origins */}
        <path d="M1100,0 C960,60 780,30 620,110 C460,190 300,150 140,230 C20,290 -40,280 -80,310"    fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.26" strokeLinecap="round"/>
        <path d="M800,0  C700,80 540,50 400,140 C260,230 140,200 20,290 C-60,350 -80,370 -100,410"   fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round"/>
        <path d="M480,0  C420,100 300,80 200,180 C100,280 60,260 -40,360 C-100,430 -110,450 -120,500" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.13" strokeLinecap="round"/>
        {/* Orange — from right edge, varied y origins */}
        <path d="M1200,120 C1100,200 960,160 820,260 C680,360 580,330 420,430 C260,530 120,510 -60,580" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.10" strokeLinecap="round"/>
        <path d="M1200,340 C1120,400 980,370 840,460 C700,550 580,520 400,610 C220,700 80,680 -60,740"  fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.06" strokeLinecap="round"/>

        {/* Cyan — from bottom edge, varied x origins */}
        <path d="M100,800  C160,680 120,580 260,500 C400,420 440,480 580,400 C720,320 800,360 960,270 C1080,200 1140,220 1200,180" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.24" strokeLinecap="round"/>
        <path d="M420,800  C440,700 400,620 520,550 C660,470 700,530 840,460 C980,390 1060,420 1200,370"  fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.17" strokeLinecap="round"/>
        <path d="M740,800  C720,720 680,660 780,600 C900,530 940,580 1060,520 C1150,470 1180,490 1200,470" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.11" strokeLinecap="round"/>
        {/* Cyan — from left edge, varied y origins */}
        <path d="M0,560 C80,500 60,440 180,390 C320,330 380,380 520,330 C680,270 760,310 940,250 C1080,200 1150,220 1200,200" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.08" strokeLinecap="round"/>
        <path d="M0,340 C60,300 40,260 140,230 C280,190 340,240 480,200 C640,155 720,185 900,150 C1040,120 1140,140 1200,130" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.05" strokeLinecap="round"/>
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
