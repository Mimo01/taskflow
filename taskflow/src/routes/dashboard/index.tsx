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
        <path d="M1200,-20 C950,10 700,100 500,200 C300,300 100,280 -50,340" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.30" strokeLinecap="round"/>
        <path d="M1200,40  C980,90 780,170 580,290 C380,410 160,410 -50,490" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.22" strokeLinecap="round"/>
        <path d="M1200,90  C1020,160 860,240 660,370 C460,500 220,520 -50,620" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.15" strokeLinecap="round"/>
        <path d="M1200,140 C1060,220 940,320 740,450 C540,580 280,620 -50,740" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.10" strokeLinecap="round"/>
        <path d="M1200,200 C1100,320 1020,430 820,560 C620,690 340,730 -50,840" fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.06" strokeLinecap="round"/>

        {/* Cyan waves from bottom-left — staggered vertically */}
        <path d="M0,660 C80,480 240,400 440,310 C640,220 860,230 1100,160" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.28" strokeLinecap="round"/>
        <path d="M0,710 C60,540 180,470 380,400 C580,330 820,360 1100,300" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.20" strokeLinecap="round"/>
        <path d="M0,750 C40,620 120,560 320,510 C520,460 780,500 1100,460" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.13" strokeLinecap="round"/>
        <path d="M0,790 C20,710 60,680 260,650 C460,620 740,670 1100,640" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.08" strokeLinecap="round"/>
        <path d="M0,830 C60,790 140,770 300,760 C500,750 750,790 1100,780" fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.05" strokeLinecap="round"/>
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
