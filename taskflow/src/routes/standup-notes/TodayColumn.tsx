/**
 * TodayColumn — Today section of the Standup Notes page.
 *
 * Owns four independent TanStack queries:
 *   1. sprint-board-mine: current sprint issues assigned to me (D-04/D-05)
 *   2. today-tempo: Tempo worklogs for today (logged-time chips)
 *   3. reviewer-mrs: GitLab MRs awaiting my review
 *   4. pinned-meta: issue metadata for pinned Jira keys
 *
 * T-62-06: jiraToken / gitlabToken MUST NOT appear in any queryKey.
 * Tokens live inside queryFn closures only.
 *
 * Pitfall 1: Uses distinct key 'sprint-board-mine' (NOT 'sprint-board') to
 * avoid contaminating the shared sprint board cache used by SprintBoardTab
 * and DashboardInProgressCard.
 *
 * Phase 62 rule: todayString() uses explicit Y-M-D formatting — never
 * toLocaleDateString() which varies by OS locale.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchReviewerMRs } from '@/services/gitlab';
import { fetchIssueMeta, fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { fetchWorklogs } from '@/services/tempo';
import { useAuthStore } from '@/stores/auth.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { useSettingsStore } from '@/stores/settings.store';
import { filterSprintItems } from './filterSprintItems';
import TodayInProgressSection from './TodayInProgressSection';
import TodayMrsSection from './TodayMrsSection';
import TodayPinnedSection from './TodayPinnedSection';
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

  // ─── Pinned tabs store ───────────────────────────────────────────────────────
  const { pinnedKeys, pinnedCycleMeta } = usePinnedTabsStore();

  // Split pinned keys: AIO cycles (in pinnedCycleMeta) vs Jira issues (not in)
  const pinnedCycleKeys = useMemo(
    () => pinnedKeys.filter((k) => k in pinnedCycleMeta),
    [pinnedKeys, pinnedCycleMeta],
  );
  const pinnedJiraKeys = useMemo(
    () => pinnedKeys.filter((k) => !(k in pinnedCycleMeta)),
    [pinnedKeys, pinnedCycleMeta],
  );
  // Sorted for stable queryKey (order-independent caching)
  const sortedJiraKeys = useMemo(() => [...pinnedJiraKeys].sort(), [pinnedJiraKeys]);

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // ─── Query 1: Sprint issues assigned to me ───────────────────────────────────
  // Key: 'sprint-board-mine' — distinct from 'sprint-board' to avoid contaminating
  // the shared full-team cache used by SprintBoardTab/DashboardInProgressCard.
  const sprintQuery = useQuery({
    queryKey: ['jira-issues', 'sprint-board-mine', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, true, storyPointsFieldKey),
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

  // ─── Query 4: Pinned Jira issue metadata ─────────────────────────────────────
  const pinnedMetaQuery = useQuery({
    queryKey: ['standup', 'pinned-meta', jiraBaseUrl, sortedJiraKeys],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira token');
      return fetchIssueMeta(jiraBaseUrl!, token, sortedJiraKeys);
    },
    enabled: !!jiraBaseUrl && !!jiraToken && sortedJiraKeys.length > 0,
    staleTime: 60 * 60 * 1000,
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

  /**
   * Invalidate today's Tempo query after a successful Log Work submission so
   * the logged-time chips refresh immediately.
   */
  function handleLogWorkSuccess() {
    void queryClient.invalidateQueries({
      queryKey: ['standup', 'today-tempo', jiraBaseUrl, todayStr, jiraUsername ?? ''],
    });
  }

  /**
   * Navigate to an AIO cycle detail page.
   * Pattern from main.tsx lines 524-526.
   */
  function handleCycleClick(key: string) {
    const meta = pinnedCycleMeta[key];
    if (meta) {
      void navigate(`/aio-cycle/${meta.projectKey}/${key}`);
    }
  }

  // ─── Loading state helpers (for empty-state gate) ─────────────────────────────
  const sprintLoading = useDelayedLoading(sprintQuery.isLoading);

  // ─── Full-column empty state gate ────────────────────────────────────────────
  // Fire only when ALL sections have resolved with 0 items and none are loading/erroring.
  const hasAnyData =
    inProgress.length > 0 ||
    upNext.length > 0 ||
    (reviewerMrsQuery.data?.length ?? 0) > 0 ||
    pinnedJiraKeys.length > 0 ||
    pinnedCycleKeys.length > 0;

  const allSettledEmpty =
    !hasAnyData &&
    !sprintQuery.isLoading &&
    !sprintLoading &&
    !reviewerMrsQuery.isLoading &&
    !pinnedMetaQuery.isLoading &&
    !sprintQuery.isError &&
    !reviewerMrsQuery.isError &&
    !pinnedMetaQuery.isError;

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
        items={inProgress}
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
        items={upNext}
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

      {/* Section 4: Pinned — Jira issues + AIO cycles, read-only (D-08) */}
      <TodayPinnedSection
        pinnedJiraKeys={pinnedJiraKeys}
        pinnedCycleKeys={pinnedCycleKeys}
        pinnedCycleMeta={pinnedCycleMeta}
        pinnedMeta={pinnedMetaQuery.data ?? {}}
        isLoading={pinnedMetaQuery.isLoading}
        isError={pinnedMetaQuery.isError}
        error={pinnedMetaQuery.error}
        onRetry={() => void pinnedMetaQuery.refetch()}
        onIssueClick={onIssueClick}
        onCycleClick={handleCycleClick}
      />

      {/* Full-column empty state — only when all sections resolved empty */}
      {allSettledEmpty && (
        <EmptyState
          icon={Clock}
          title="Nothing planned for today"
          subtitle="No items in progress, nothing up next, no MRs awaiting review, and no pinned items."
        />
      )}

    </div>
  );
}
