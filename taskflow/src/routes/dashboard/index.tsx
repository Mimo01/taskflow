'use no memo';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useBoardId } from '@/hooks/useBoardId';
import { fetchActiveSprint, fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import HoursCommitsChart from './HoursCommitsChart';
import MyIssuesCard from './MyIssuesCard';
import UpcomingReleasesTimeline from './UpcomingReleasesTimeline';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

// Ambient hero background curves — orange top-right, cyan bottom-left.
// Restored verbatim from the pre-polish dashboard hero (260521-wbm AMBIENT_CURVES spec).
const AMBIENT_CURVES: ReadonlyArray<{ d: string; color: 'orange' | 'cyan'; w: number; o: number }> =
  [
    { d: 'M -50 220 Q 400 90 1250 -20', color: 'orange', w: 1, o: 0.35 },
    { d: 'M -50 320 Q 500 160 1250 80', color: 'orange', w: 0.8, o: 0.25 },
    { d: 'M -50 420 Q 600 240 1250 180', color: 'orange', w: 0.6, o: 0.18 },
    { d: 'M -50 760 Q 500 540 1250 380', color: 'cyan', w: 1, o: 0.32 },
    { d: 'M -50 860 Q 600 640 1250 480', color: 'cyan', w: 0.8, o: 0.24 },
    { d: 'M -50 960 Q 700 740 1250 580', color: 'cyan', w: 0.6, o: 0.18 },
    { d: 'M -50 540 Q 550 380 1250 240', color: 'orange', w: 0.5, o: 0.14 },
    { d: 'M -50 660 Q 600 460 1250 320', color: 'cyan', w: 0.5, o: 0.14 },
  ];

export default function Dashboard() {
  const {
    jiraBaseUrl,
    activeJiraProject,
    jiraUserDisplayName,
    jiraUsername,
    gitlabBaseUrl,
    gitlabUsername,
    gitlabName,
    gitlabEmail,
    activeGitlabProject,
  } = useAuthStore();
  const { storyPointsFieldKey, tempoEnabled } = useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);
  const { onIssueClick } = useOutletContext<{
    onIssueClick: (key: string, resetTrail?: boolean) => void;
    onOpenIssue: (key: string) => void;
  }>();

  // D-16: single point of PAT load; cards receive it as a prop
  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  // gitlab-pat load — same pattern as jira-pat above; token held in state, never in queryKey (T-84-02)
  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  // Resolve the per-project chosen board id (falls back to first board) so the
  // active-sprint query honors the user's board choice.
  const { boardId } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);

  // Sprint-board query — ONE shared cache key (dedupes against MyIssuesCard via same key)
  useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        false,
        storyPointsFieldKey,
      ),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  // Active sprint — cache-deduped with the Sidebar prefetch.
  // Reuses the EXACT same queryKey ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]
  // so TanStack Query returns the cached result with zero extra network calls (D-09).
  const { data: activeSprint } = useQuery({
    queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
    queryFn: () =>
      fetchActiveSprint(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        boardId ?? undefined,
      ),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && boardId != null,
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

  // D-13: Sprint-position subline. Both dates: local calendar. Hide clause when sprint null.
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local calendar
  const sprintClause = (() => {
    if (!activeSprint?.startDate || !activeSprint?.endDate) return '';
    const [sy, sm, sd] = activeSprint.startDate.slice(0, 10).split('-').map(Number);
    const [ey, em, ed] = activeSprint.endDate.slice(0, 10).split('-').map(Number);
    const [ty, tm, td] = today.split('-').map(Number);
    const elapsed =
      Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86_400_000) + 1;
    const total =
      Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000) + 1;
    return ` · Sprint day ${elapsed} of ${total}`;
  })();

  // onIssueClick retained for potential future drill-down actions
  void onIssueClick;

  return (
    <div className="relative flex flex-col h-full overflow-auto bg-background">
      {/* Hero — restored ambient orange/cyan curve background + centered greeting.
          Only change vs the original pre-polish hero is the D-13 sprint-day clause on the subline. */}
      <section className="relative px-8 py-16 text-center overflow-hidden shrink-0">
        <svg
          aria-hidden="true"
          viewBox="0 0 1200 900"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {AMBIENT_CURVES.map((c, i) => (
            <path
              // biome-ignore lint/suspicious/noArrayIndexKey: static constant array, no reorder
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
        <h1 className="relative text-6xl font-semibold tracking-tight text-foreground">
          {timeGreeting} {firstName ?? 'there'}
        </h1>
        <p className="relative text-sm text-muted-foreground mt-2">
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {sprintClause}
        </p>
      </section>

      {/* Unified content shell — 3-region layout (D-01) */}
      <div className="flex flex-col gap-4 px-6 py-4">
        {/* Top row: MY ISSUES (left) + UPCOMING RELEASES (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MyIssuesCard
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
            storyPointsFieldKey={storyPointsFieldKey}
            jiraUserDisplayName={jiraUserDisplayName ?? ''}
          />
          <UpcomingReleasesTimeline
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
          />
        </div>

        {/* Bottom row: PAST 7 DAYS chart — full-width (D-09/D-10/D-14) */}
        <HoursCommitsChart
          jiraBaseUrl={jiraBaseUrl ?? ''}
          jiraToken={jiraToken ?? ''}
          jiraUsername={jiraUsername ?? ''}
          tempoEnabled={tempoEnabled}
          gitlabBaseUrl={gitlabBaseUrl ?? ''}
          gitlabToken={gitlabToken ?? ''}
          activeGitlabProject={activeGitlabProject ?? 0}
          gitlabUsername={gitlabUsername ?? null}
          gitlabName={gitlabName ?? null}
          gitlabEmail={gitlabEmail ?? null}
        />
      </div>
    </div>
  );
}
