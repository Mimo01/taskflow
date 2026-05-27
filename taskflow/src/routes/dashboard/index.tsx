import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import DashboardInProgressCard from './DashboardInProgressCard';
import DashboardReleaseCard from './DashboardReleaseCard';
import DashboardSprintCard from './DashboardSprintCard';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

const AMBIENT_CURVES: ReadonlyArray<{ d: string; color: 'orange' | 'blue'; w: number; o: number }> =
  [
    { d: 'M -50 220 Q 400 90 1250 -20', color: 'orange', w: 1, o: 0.35 },
    { d: 'M -50 320 Q 500 160 1250 80', color: 'orange', w: 0.8, o: 0.25 },
    { d: 'M -50 420 Q 600 240 1250 180', color: 'orange', w: 0.6, o: 0.18 },
    { d: 'M -50 760 Q 500 540 1250 380', color: 'blue', w: 1, o: 0.32 },
    { d: 'M -50 860 Q 600 640 1250 480', color: 'blue', w: 0.8, o: 0.24 },
    { d: 'M -50 960 Q 700 740 1250 580', color: 'blue', w: 0.6, o: 0.18 },
    { d: 'M -50 540 Q 550 380 1250 240', color: 'orange', w: 0.5, o: 0.14 },
    { d: 'M -50 660 Q 600 460 1250 320', color: 'blue', w: 0.5, o: 0.14 },
  ];

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

  // Jira displayName varies by instance format, e.g.:
  //   "Jane Doe"            — Firstname Surname (standard)
  //   "DOE Jane ACME (ext.)" — SURNAME Firstname OrgCode (status) (some on-prem configs)
  // Strategy: strip bracketed [X] and parenthesized (X) tokens, then prefer the first
  // mixed-case token (not all-uppercase) as the given name. If all tokens are uppercase,
  // fall back to the first token.
  const tokens = (jiraUserDisplayName?.trim().split(/\s+/) ?? []).filter(
    (t) => !/^\[.*\]$/.test(t) && !/^\(.*\)$/.test(t),
  );
  const firstName = tokens.find((t) => t !== t.toUpperCase()) ?? tokens[0] ?? null;
  const timeGreeting = getTimeGreeting();

  return (
    <div className="relative flex flex-col min-h-full bg-background">
      <section className="relative px-8 py-20 text-center overflow-hidden">
        {/* Ambient background curves — orange top-right, blue bottom-left */}
        <svg
          aria-hidden="true"
          viewBox="0 0 1200 900"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {AMBIENT_CURVES.map((c, i) => (
            <path
              key={i}
              d={c.d}
              fill="none"
              stroke={c.color === 'orange' ? '#f97316' : '#06b6d4'}
              strokeWidth={c.w}
              strokeLinecap="round"
              opacity={c.o}
            />
          ))}
        </svg>

        <h1 className="relative text-6xl font-semibold tracking-tight">
          {timeGreeting} {firstName ?? 'there'}
        </h1>
        <p className="relative text-sm text-muted-foreground mt-2">{today}</p>
      </section>

      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        <DashboardSprintCard
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
          storyPointsFieldKey={storyPointsFieldKey}
        />
        <div className="order-last sm:col-span-2 lg:col-span-1 lg:order-none">
          <DashboardInProgressCard
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
            jiraUserDisplayName={jiraUserDisplayName ?? ''}
            storyPointsFieldKey={storyPointsFieldKey}
            onIssueClick={onIssueClick}
          />
        </div>
        <DashboardReleaseCard
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          activeJiraProject={activeJiraProject ?? ''}
        />
      </div>
    </div>
  );
}
