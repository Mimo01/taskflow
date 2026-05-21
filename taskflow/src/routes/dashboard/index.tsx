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
        {/* Orange waves — spread across top and right edges */}
        <path d="M600,-20 C720,60 800,120 780,260 C760,400 680,480 600,600" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.28" strokeLinecap="round"/>
        <path d="M900,-20 C980,80 1020,180 980,340 C940,480 840,560 760,700" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
        <path d="M1250,100 C1160,200 1060,280 960,420 C860,560 820,660 740,820" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.15" strokeLinecap="round"/>
        <path d="M1250,350 C1140,420 1020,480 900,580 C780,680 700,740 620,830" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.10" strokeLinecap="round"/>
        <path d="M380,-20 C460,100 500,200 460,360 C420,520 360,600 300,760" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.08" strokeLinecap="round"/>

        {/* Cyan waves — spread across bottom and left edges */}
        <path d="M600,820 C520,700 480,600 500,460 C520,320 600,240 640,100" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.26" strokeLinecap="round"/>
        <path d="M300,820 C240,700 220,580 260,440 C300,300 400,220 460,80" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round"/>
        <path d="M-50,500 C60,440 160,380 280,300 C400,220 480,160 560,40" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.14" strokeLinecap="round"/>
        <path d="M-50,260 C80,240 200,220 320,180 C440,140 540,100 660,-20" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.09" strokeLinecap="round"/>
        <path d="M900,820 C860,720 820,620 820,500 C820,380 860,300 880,180" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.07" strokeLinecap="round"/>
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
