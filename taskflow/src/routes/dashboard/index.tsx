import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import DashboardSprintCard from './DashboardSprintCard';
import DashboardInProgressCard from './DashboardInProgressCard';
import DashboardReleaseCard from './DashboardReleaseCard';

function getGreeting(firstName: string | null): string {
  const hour = new Date().getHours();
  const name = firstName ?? 'there';
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
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

  // Extract first name: take the first whitespace-delimited token
  const firstName = jiraUserDisplayName?.trim().split(/\s+/)[0] ?? null;
  const greeting = getGreeting(firstName);

  return (
    <div className="relative flex flex-col min-h-full bg-white dark:bg-background">
      {/* Flowing sine waves — stacked horizontal bands, orange + cyan */}
      <svg
        aria-hidden="true"
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Filled wave bands */}
        <path d="M0,180 C150,120 300,240 450,180 C600,120 750,240 900,180 C1050,120 1150,200 1200,170 L1200,800 L0,800 Z" fill="#f97316" fillOpacity="0.05" />
        <path d="M0,280 C200,200 350,340 550,260 C700,200 850,320 1050,250 C1120,225 1170,245 1200,240 L1200,800 L0,800 Z" fill="#06b6d4" fillOpacity="0.06" />
        <path d="M0,400 C180,330 320,460 500,390 C660,330 800,440 980,370 C1080,340 1150,360 1200,355 L1200,800 L0,800 Z" fill="#f97316" fillOpacity="0.04" />

        {/* Stroke-only waves layered on top */}
        <path d="M0,140 C150,80 300,200 450,140 C600,80 750,200 900,140 C1050,80 1150,160 1200,130" fill="none" stroke="#f97316" strokeWidth="2" strokeOpacity="0.22" strokeLinecap="round" />
        <path d="M0,220 C200,155 380,285 560,215 C720,155 880,275 1060,205 C1130,180 1175,195 1200,190" fill="none" stroke="#06b6d4" strokeWidth="2" strokeOpacity="0.20" strokeLinecap="round" />
        <path d="M0,320 C170,255 330,375 510,305 C670,245 840,355 1020,290 C1110,260 1165,275 1200,270" fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.15" strokeLinecap="round" />
        <path d="M0,420 C190,360 360,470 540,400 C700,340 870,450 1050,385 C1130,355 1175,370 1200,365" fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.14" strokeLinecap="round" />
        <path d="M0,520 C160,460 340,560 520,495 C690,435 860,545 1040,480 C1120,450 1170,465 1200,460" fill="none" stroke="#f97316" strokeWidth="1"   strokeOpacity="0.10" strokeLinecap="round" />
        <path d="M0,620 C180,560 360,660 540,595 C710,535 880,640 1060,575 C1130,548 1175,560 1200,555" fill="none" stroke="#06b6d4" strokeWidth="1"   strokeOpacity="0.09" strokeLinecap="round" />
      </svg>

      <section className="relative px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{greeting}</h1>
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
