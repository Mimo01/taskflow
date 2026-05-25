/**
 * TodayColumn — Today section of the Standup Notes page.
 *
 * Owns three independent TanStack queries:
 *   1. sprint-board-today-full: full current sprint issues (D-04/D-05; filtered client-side)
 *   2. today-tempo: Tempo worklogs for today (logged-time chips)
 *   3. reviewer-mrs: GitLab MRs awaiting my review
 *
 * T-62-06: jiraToken / gitlabToken MUST NOT appear in any queryKey.
 * Tokens live inside queryFn closures only.
 *
 * Pitfall 1: Uses distinct key 'sprint-board-today-full' (NOT 'sprint-board') to
 * avoid contaminating the shared sprint board cache used by SprintBoardTab
 * and DashboardInProgressCard.
 *
 * Phase 62 rule: todayString() uses explicit Y-M-D formatting — never
 * toLocaleDateString() which varies by OS locale.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchParticipatedMRs, fetchReviewerMRs } from '@/services/gitlab';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { fetchWorklogs } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { filterSprintItems } from './filterSprintItems';
import TodayInProgressSection from './TodayInProgressSection';
import TodayMrsSection from './TodayMrsSection';
import TodayParticipatingSection from './TodayParticipatingSection';
import TodayUpNextSection from './TodayUpNextSection';

// ─── Day/month name tables (no toLocaleDateString — Phase 62 rule) ────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Returns today as a YYYY-MM-DD string, TZ-safe (Phase 62 standing rule).
 * Mirrors LogWorkPopover.todayString() — not exported from there.
 */
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Formats today's date as "Weekday, D Month YYYY".
 * No toLocaleDateString — explicit array lookups per Phase 62 rule.
 */
function formatTodayDate(): string {
  const today = new Date();
  const dayName = DAYS[today.getDay()];
  const day = today.getDate();
  const month = MONTHS[today.getMonth()];
  const year = today.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayColumnProps {
  onIssueClick: (key: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayColumn({ onIssueClick }: TodayColumnProps) {
  // ─── Auth store ─────────────────────────────────────────────────────────────
  const {
    jiraBaseUrl,
    gitlabBaseUrl,
    activeJiraProject,
    jiraUsername,
    gitlabUserId,
  } = useAuthStore();

  // jiraUserDisplayName is separate — fine-grained selector (Phase 68 rule)
  const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);

  // ─── Settings store — one selector per field (IN-01: Phase 68 rule) ─────────
  const tempoEnabled = useSettingsStore((s) => s.tempoEnabled);
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);

  // ─── Token loading (Pattern 2 / T-62-06) ─────────────────────────────────────
  // Tokens held in local state for `enabled` guards; never placed in any queryKey.
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then((t) => setGitlabToken(t))
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  // ─── TZ-safe today date (memoized — stable for this mount) ───────────────────
  const todayStr = useMemo(() => todayString(), []);

  // ─── Query 1: Full sprint issues (filtered client-side in filterSprintItems) ──
  // Key: 'sprint-board-today-full' — distinct from 'sprint-board' to avoid
  // contaminating the shared full-team cache used by SprintBoardTab/DashboardInProgressCard.
  // assignedToMe=false fetches the whole sprint so client-side filtering can include
  // parents where I own a subtask even if I'm not assigned to the parent itself.
  const sprintQuery = useQuery({
    queryKey: ['jira-issues', 'sprint-board-today-full', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, false, storyPointsFieldKey),
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
    staleTime: 30_000,
  });

  // ─── Query 2: Today Tempo worklogs (for logged-time chips) ───────────────────
  const todayTempoQuery = useQuery({
    queryKey: ['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? ''],
    queryFn: () =>
      fetchWorklogs(jiraBaseUrl!, jiraToken!, [jiraUsername!], todayStr, todayStr),
    enabled: !!jiraBaseUrl && !!jiraToken && tempoEnabled && !!jiraUsername,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Query 3: Reviewer MRs awaiting my review ────────────────────────────────
  const reviewerMrsQuery = useQuery({
    queryKey: ['standup', 'reviewer-mrs', gitlabBaseUrl, gitlabUserId],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchReviewerMRs(gitlabBaseUrl!, token, gitlabUserId!);
    },
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Query 4: MRs I've participated in (commented on) — role-independent ──────
  // T-62-06: token is read inside queryFn, NOT placed in queryKey.
  const participatingMrsQuery = useQuery({
    queryKey: ['standup', 'participating-mrs', gitlabBaseUrl, gitlabUserId],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchParticipatedMRs(gitlabBaseUrl!, token, gitlabUserId!, 30);
    },
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Derived data ─────────────────────────────────────────────────────────────

  // Split sprint issues into In Progress / Up Next using the verified helper
  const { inProgress, upNext } = useMemo(
    () => filterSprintItems(sprintQuery.data ?? [], jiraUserDisplayName ?? ''),
    [sprintQuery.data, jiraUserDisplayName],
  );

  // Build a per-issue seconds map from today's Tempo worklogs
  const todayLoggedByIssue = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of todayTempoQuery.data ?? []) {
      map.set(w.issue.key, (map.get(w.issue.key) ?? 0) + w.timeSpentSeconds);
    }
    return map;
  }, [todayTempoQuery.data]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const queryClient = useQueryClient();

  /**
   * Invalidate today's Tempo query after a successful Log Work submission so
   * the logged-time chips refresh immediately.
   */
  function handleLogWorkSuccess() {
    void queryClient.invalidateQueries({
      queryKey: ['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? ''],
    });
  }

  // ─── Loading state helpers (for empty-state gate) ─────────────────────────────
  const sprintLoading = useDelayedLoading(sprintQuery.isLoading);

  // ─── Full-column empty state gate ────────────────────────────────────────────
  // Fire only when ALL sections have resolved with 0 items and none are loading/erroring.
  const hasAnyData =
    inProgress.length > 0 ||
    upNext.length > 0 ||
    (reviewerMrsQuery.data?.length ?? 0) > 0 ||
    (participatingMrsQuery.data?.length ?? 0) > 0;

  const allSettledEmpty =
    !hasAnyData &&
    !sprintQuery.isLoading &&
    !sprintLoading &&
    !reviewerMrsQuery.isLoading &&
    !participatingMrsQuery.isLoading &&
    !sprintQuery.isError &&
    !reviewerMrsQuery.isError &&
    !participatingMrsQuery.isError;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-6 py-4">
      {/* Column heading */}
      <div className="mb-2">
        <h2 className="text-xl font-semibold">Today</h2>
        <p className="text-xs text-muted-foreground">{formatTodayDate()}</p>
      </div>

      {/* Section 1: In Progress (D-01: fixed order) */}
      <TodayInProgressSection
        rows={inProgress}
        todayLoggedByIssue={todayLoggedByIssue}
        storyPointsFieldKey={storyPointsFieldKey}
        jiraBaseUrl={jiraBaseUrl ?? ''}
        todayStr={todayStr}
        isLoading={sprintQuery.isLoading}
        isError={sprintQuery.isError}
        error={sprintQuery.error}
        onRetry={() => void sprintQuery.refetch()}
        onIssueClick={onIssueClick}
        onLogWorkSuccess={handleLogWorkSuccess}
      />

      {/* Section 2: Up Next (D-01: fixed order) */}
      <TodayUpNextSection
        rows={upNext}
        storyPointsFieldKey={storyPointsFieldKey}
        jiraBaseUrl={jiraBaseUrl ?? ''}
        todayStr={todayStr}
        isLoading={sprintQuery.isLoading}
        isError={sprintQuery.isError}
        error={sprintQuery.error}
        onRetry={() => void sprintQuery.refetch()}
        onIssueClick={onIssueClick}
        onLogWorkSuccess={handleLogWorkSuccess}
      />

      {/* Section 3: MRs Awaiting You — hidden when GitLab not connected (D-02, D-10) */}
      {!!gitlabBaseUrl && (
        <TodayMrsSection
          items={reviewerMrsQuery.data ?? []}
          isLoading={reviewerMrsQuery.isLoading}
          isError={reviewerMrsQuery.isError}
          error={reviewerMrsQuery.error}
          onRetry={() => void reviewerMrsQuery.refetch()}
        />
      )}

      {/* Section 4: Participating MRs (commented on) — role-independent, hidden when GitLab not connected */}
      {!!gitlabBaseUrl && (
        <TodayParticipatingSection
          items={participatingMrsQuery.data ?? []}
          isLoading={participatingMrsQuery.isLoading}
          isError={participatingMrsQuery.isError}
          error={participatingMrsQuery.error}
          onRetry={() => void participatingMrsQuery.refetch()}
        />
      )}

      {/* Full-column empty state — only when all sections resolved empty */}
      {allSettledEmpty && (
        <EmptyState
          icon={Clock}
          title="Nothing planned for today"
          subtitle="No items in progress, nothing up next, and no MRs awaiting review."
        />
      )}

    </div>
  );
}
