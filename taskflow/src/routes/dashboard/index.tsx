'use no memo';

import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoardId } from '@/hooks/useBoardId';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import ActivityStrip from './ActivityStrip';
import DashboardReleaseCard from './DashboardReleaseCard';
import { computePersonalTileCounts, computeSpDone } from './dashboardMetrics';
import MrReviewQueue from './MrReviewQueue';
import SprintHealthSection from './SprintHealthSection';
import StatTile from './StatTile';
import WeeklyTrendChart from './WeeklyTrendChart';

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
  const [gitlabTokenLoading, setGitlabTokenLoading] = useState(true);
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
      setGitlabTokenLoading(true);
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null))
        .finally(() => setGitlabTokenLoading(false));
    } else {
      setGitlabTokenLoading(false);
    }
  }, [gitlabBaseUrl]);

  // Resolve the per-project chosen board id (falls back to first board) so the
  // sprint health section's active-sprint query honors the user's board choice.
  const { boardId } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);

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

  // Stat tiles — ONE shared sprint-board query (dedupes against SprintHealthSection via same cache key)
  const {
    data: sprintIssuesRaw,
    isLoading: tileLoading,
    error: tileError,
    refetch: refetchTiles,
  } = useQuery({
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

  const showTileSkeleton = useDelayedLoading(tileLoading);

  const sprintIssues = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];
  const tileCounts = computePersonalTileCounts(
    sprintIssues,
    jiraUserDisplayName ?? '',
    // Local calendar date (YYYY-MM-DD), NOT toISOString() — Jira `duedate` is a
    // local-floating date, so comparing against a UTC date miscounts "due today"
    // as overdue for users west of UTC in the evening (WR-02). en-CA yields ISO-style.
    new Date().toLocaleDateString('en-CA'),
  );
  const spDone = computeSpDone(sprintIssues, storyPointsFieldKey);

  // onIssueClick retained for potential future drill-down actions
  void onIssueClick;

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

        <h1 className="relative text-6xl font-semibold tracking-tight">
          {timeGreeting} {firstName ?? 'there'}
        </h1>
        <p className="relative text-sm text-muted-foreground mt-2">{today}</p>
      </section>

      {/* Stat tiles row — DASH-02 (4-tile grid replacing 3-card grid) */}
      <div className="relative px-6 pb-6">
        {showTileSkeleton && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-4 min-h-[80px] flex flex-col gap-3"
              >
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-7 w-1/3" />
              </div>
            ))}
          </div>
        )}
        {!showTileSkeleton && tileError && (
          <ErrorState error={tileError} onRetry={refetchTiles} viewName="stat tiles" />
        )}
        {!showTileSkeleton && !tileError && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatTile
              label="Open"
              value={tileCounts.open}
              icon={Activity}
              iconClass="text-sky-500"
            />
            <StatTile
              label="In Progress"
              value={tileCounts.inProgress}
              icon={Zap}
              iconClass="text-amber-500"
            />
            <StatTile
              label="Overdue"
              value={tileCounts.overdue}
              icon={Clock}
              iconClass="text-destructive"
              valueClass={tileCounts.overdue > 0 ? 'text-destructive' : undefined}
            />
            <StatTile
              label="SP Done"
              value={spDone}
              icon={CheckCircle2}
              iconClass="text-green-500"
            />
          </div>
        )}
      </div>

      {/* Sprint health + Weekly trend chart side-by-side — DASH-03 / DASH-04 */}
      <div className="relative px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SprintHealthSection
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
            storyPointsFieldKey={storyPointsFieldKey}
            boardId={boardId}
          />
          <WeeklyTrendChart
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            jiraUsername={jiraUsername ?? ''}
            tempoEnabled={tempoEnabled}
          />
        </div>
      </div>

      {/* MR review queue — full width — DASH-06 */}
      <div className="relative px-6 pb-6">
        <MrReviewQueue
          gitlabBaseUrl={gitlabBaseUrl ?? ''}
          gitlabToken={gitlabToken ?? ''}
          tokenLoading={gitlabTokenLoading}
        />
      </div>

      {/* Activity & Releases — two-column grid (D-16: DashboardReleaseCard relocated here) — DASH-05 */}
      <div className="relative px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityStrip
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
            jiraUsername={jiraUsername ?? null}
            gitlabBaseUrl={gitlabBaseUrl ?? ''}
            gitlabToken={gitlabToken ?? ''}
            activeGitlabProject={activeGitlabProject ?? 0}
            gitlabUsername={gitlabUsername ?? null}
            gitlabName={gitlabName ?? null}
            gitlabEmail={gitlabEmail ?? null}
          />
          <DashboardReleaseCard
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
          />
        </div>
      </div>
    </div>
  );
}
