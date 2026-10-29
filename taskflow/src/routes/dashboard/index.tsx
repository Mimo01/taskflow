'use no memo';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AmbientCurves } from '@/components/ambient-curves';
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

// ── Sprint working-day helpers (D-13) ───────────────────────────────────────
// Weekends (Sat/Sun) never count as sprint days. Holidays are not yet wired in —
// they would come from the Tempo work schedule; add YYYY-MM-DD dates here (or swap
// for a fetched set) to exclude them too.
const SPRINT_HOLIDAYS = new Set<string>();

/** Day-of-week for a YYYY-MM-DD string via UTC (no local-timezone shift). */
function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun … 6 Sat
}

function isWeekendDay(dateStr: string): boolean {
  const dow = dayOfWeek(dateStr);
  return dow === 0 || dow === 6;
}

function isNonWorkingDay(dateStr: string): boolean {
  return isWeekendDay(dateStr) || SPRINT_HOLIDAYS.has(dateStr);
}

function addCalendarDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Count working days (Mon–Fri, minus holidays) in [start, end] inclusive. */
function countWorkingDays(startStr: string, endStr: string): number {
  if (startStr > endStr) return 0;
  let count = 0;
  let cur = startStr;
  for (let i = 0; i < 400 && cur <= endStr; i++) {
    if (!isNonWorkingDay(cur)) count++;
    cur = addCalendarDays(cur, 1);
  }
  return count;
}

/** First working day strictly after `dateStr`. */
function nextWorkingDay(dateStr: string): string {
  let cur = addCalendarDays(dateStr, 1);
  for (let i = 0; i < 14 && isNonWorkingDay(cur); i++) {
    cur = addCalendarDays(cur, 1);
  }
  return cur;
}

/** "Monday, 17 Jun" for a YYYY-MM-DD string (UTC-stable). */
function formatResumeLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

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
  const navigate = useNavigate();

  // D-13: Sprint-position subline. Working days only — weekends (and holidays, when
  // wired) never count. On a non-working day, show when the sprint resumes instead.
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local calendar
  const sprintClause = (() => {
    if (!activeSprint?.startDate || !activeSprint?.endDate) return '';
    const start = activeSprint.startDate.slice(0, 10);
    const end = activeSprint.endDate.slice(0, 10);
    // Outside the sprint window → no clause
    if (today < start || today > end) return '';

    if (isNonWorkingDay(today)) {
      const label = isWeekendDay(today) ? 'Weekend' : 'Holiday';
      const resume = nextWorkingDay(today);
      return ` · ${label} · sprint resumes ${formatResumeLabel(resume)}`;
    }

    // Start day counts as day 0 → both elapsed and total drop the inclusive start day.
    const elapsed = countWorkingDays(start, today) - 1;
    const total = countWorkingDays(start, end) - 1;
    return ` · Sprint day ${elapsed} of ${total}`;
  })();

  // onIssueClick retained for potential future drill-down actions
  void onIssueClick;

  return (
    <div className="relative flex flex-col h-full overflow-auto bg-background">
      {/* Hero — restored ambient orange/cyan curve background + centered greeting.
          Only change vs the original pre-polish hero is the D-13 sprint-day clause on the subline. */}
      <section className="relative px-8 py-16 text-center overflow-hidden shrink-0">
        <AmbientCurves />
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
            onActivate={() => navigate('/my-tasks')}
          />
          <UpcomingReleasesTimeline
            jiraBaseUrl={jiraBaseUrl ?? ''}
            jiraToken={jiraToken ?? ''}
            activeJiraProject={activeJiraProject ?? ''}
            onActivate={() => navigate('/releases')}
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
          onActivate={() => navigate(tempoEnabled ? '/worklogs' : '/sprint-board')}
        />
      </div>
    </div>
  );
}
