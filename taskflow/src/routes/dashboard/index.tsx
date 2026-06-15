'use no memo';

import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, Clock, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useBoardId } from '@/hooks/useBoardId';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchActiveSprint, fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import ActivityStrip from './ActivityStrip';
import BurndownChart from './BurndownChart';
import DashboardReleaseCard from './DashboardReleaseCard';
import { computePersonalTileCounts, computeSpDone } from './dashboardMetrics';
import SprintHealthSection from './SprintHealthSection';
import StatTile from './StatTile';
import VelocityChart from './VelocityChart';
import WeeklyTrendChart from './WeeklyTrendChart';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export default function Dashboard() {
  const {
    jiraBaseUrl,
    activeJiraProject,
    jiraUserDisplayName,
    jiraUsername,
    jiraUserKey,
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

  // Active sprint — cache-deduped with SprintHealthSection and the Sidebar prefetch.
  // Reuses the EXACT same queryKey ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]
  // so TanStack Query returns the cached result with zero extra network calls (D-09).
  const { data: activeSprintForBurndown } = useQuery({
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
  const activeSprintId = activeSprintForBurndown?.id ?? null;

  // onIssueClick retained for potential future drill-down actions
  void onIssueClick;

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      {/* Header — mirrors MyTasksPage: bold greeting title + date subtitle, no ambient SVG */}
      <div className="flex items-end justify-between gap-4 px-6 pt-5 pb-5 border-b border-border/50 shrink-0">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-3xl font-semibold text-foreground">
            {timeGreeting} {firstName ?? 'there'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{today}</p>
        </div>
      </div>

      {/* Unified content shell — single gutter + gap for every section row */}
      <div className="flex flex-col gap-4 px-6 py-4">
        {/* Stat tiles row — DASH-02 (4-tile grid replacing 3-card grid) */}
        {showTileSkeleton && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl ring-1 ring-foreground/10 bg-card p-3 min-h-[80px] flex flex-col gap-3"
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

        {/* Sprint health + Weekly trend chart side-by-side — DASH-03 / DASH-04 */}
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

        {/* Activity & Releases — two-column grid (D-16: DashboardReleaseCard relocated here) — DASH-05 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityStrip
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            jiraUserKey={jiraUserKey ?? null}
            activeJiraProject={activeJiraProject ?? ''}
            jiraUsername={jiraUsername ?? null}
            tempoEnabled={tempoEnabled}
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

        {/* Sprint Insights — INSIGHT-01 / INSIGHT-02
            boardId from useBoardId (never hardcoded); activeSprintId from cache-deduped
            fetchActiveSprint query (shares key with SprintHealthSection → zero extra network).
            Each card owns its loading/error/empty state — one card's failure never affects
            the other or any other Dashboard section (D-09 / T-85-04-03). */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <VelocityChart
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            jiraUserDisplayName={jiraUserDisplayName ?? ''}
            boardId={boardId}
            storyPointsFieldKey={storyPointsFieldKey}
            activeJiraProject={activeJiraProject ?? ''}
          />
          <BurndownChart
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            boardId={boardId}
            activeSprintId={activeSprintId}
          />
        </div>
      </div>
    </div>
  );
}
