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
      {/* Smooth flowing waves — staggered across all edges */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Orange — long gentle arcs from top/right */}
        <path d="M1100,0 C900,120 600,80 300,200 C100,290 -20,310 -80,340"         fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.26" strokeLinecap="round"/>
        <path d="M820,0 C640,140 420,120 200,260 C60,360 -30,400 -80,440"           fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.18" strokeLinecap="round"/>
        <path d="M500,0 C380,160 240,180 100,320 C20,420 -30,480 -80,540"           fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.13" strokeLinecap="round"/>
        <path d="M1200,160 C1020,260 760,240 520,380 C320,500 140,540 -80,640"      fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.09" strokeLinecap="round"/>
        <path d="M1200,420 C1060,500 840,480 620,580 C420,670 200,700 -80,760"      fill="none" stroke="#f97316" strokeWidth="0.75" strokeOpacity="0.05" strokeLinecap="round"/>

        {/* Cyan — long gentle arcs from bottom/left */}
        <path d="M100,800 C280,640 540,620 780,480 C960,370 1080,340 1280,280"      fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.24" strokeLinecap="round"/>
        <path d="M400,800 C540,660 740,640 960,520 C1100,430 1180,400 1280,370"     fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.17" strokeLinecap="round"/>
        <path d="M720,800 C800,680 940,660 1080,580 C1160,530 1220,510 1280,490"    fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.11" strokeLinecap="round"/>
        <path d="M0,580 C160,480 380,460 620,360 C820,270 1020,260 1280,200"        fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.08" strokeLinecap="round"/>
        <path d="M0,360 C140,300 340,290 580,220 C780,160 1000,160 1280,120"        fill="none" stroke="#06b6d4" strokeWidth="0.75" strokeOpacity="0.05" strokeLinecap="round"/>
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
