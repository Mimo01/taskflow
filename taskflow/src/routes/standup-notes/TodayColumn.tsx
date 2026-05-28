/**
 * TodayColumn — Today section of the Standup Notes page.
 *
 * Owns three independent TanStack queries:
 *   1. sprint-board-today-full: full current sprint issues (D-04/D-05; filtered client-side)
 *   2. reviewer-mrs: GitLab MRs awaiting my review
 *   3. participating-mrs: GitLab MRs I've commented on
 *
 * T-62-06: jiraToken / gitlabToken MUST NOT appear in any queryKey.
 * Tokens live inside queryFn closures only.
 *
 * Pitfall 1: Uses distinct key 'sprint-board-today-full' (NOT 'sprint-board') to
 * avoid contaminating the shared sprint board cache used by SprintBoardTab
 * and DashboardInProgressCard.
 */

import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { GitLabMR, ParticipatedMR } from '@/services/gitlab';
import { fetchParticipatedMRs, fetchReviewerMRs } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { fetchSprintIssues } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { filterSprintItems } from './filterSprintItems';
import { matchMrsToStories } from './mrMatching';
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

// ─── Markdown export ──────────────────────────────────────────────────────────

/** Query key factories — exported so StandupNotesPage can read cached data for Copy Markdown. */
export const todayQueryKeys = {
  sprint: (project: string | null | undefined, spFieldKey: string | null | undefined) =>
    ['jira-issues', 'sprint-board-today-full', project, spFieldKey] as const,
  reviewerMrs: (base: string | null | undefined, userId: number | null | undefined) =>
    ['standup', 'reviewer-mrs', base, userId] as const,
  participatingMrs: (base: string | null | undefined, userId: number | null | undefined) =>
    ['standup', 'participating-mrs', base, userId] as const,
};

export interface TodayMarkdownSources {
  sprintData?: JiraIssue[];
  reviewerMrsData?: GitLabMR[];
  participatingMrsData?: ParticipatedMR[];
  jiraUserDisplayName?: string | null;
}

export function generateTodayMarkdown(sources: TodayMarkdownSources, todayDate: string): string {
  const { inProgress, upNext } = filterSprintItems(
    sources.sprintData ?? [],
    sources.jiraUserDisplayName ?? '',
  );

  const { mrsByStory, unmatchedReviewerMrs, unmatchedParticipatingMrs } = matchMrsToStories(
    [...inProgress, ...upNext],
    sources.reviewerMrsData ?? [],
    sources.participatingMrsData ?? [],
  );

  const lines: string[] = [`## Today (${todayDate})`, ''];

  for (const row of inProgress) {
    lines.push(`### ${row.issue.key}: ${row.issue.fields.summary ?? row.issue.key}`);
    for (const subtask of row.subtasks) {
      lines.push(`- ${subtask.key}: ${subtask.fields.summary ?? subtask.key}`);
    }
    for (const mr of mrsByStory.get(row.issue.key) ?? []) {
      lines.push(
        mr.kind === 'review'
          ? `- Reviewed MR !${mr.iid} (${mr.title})`
          : `- Participated in MR !${mr.iid} (${mr.title})`,
      );
    }
    lines.push('');
  }

  if (upNext.length > 0) {
    lines.push('### Up Next');
    for (const row of upNext) {
      lines.push(`- ${row.issue.key}: ${row.issue.fields.summary ?? row.issue.key}`);
    }
    lines.push('');
  }

  if (unmatchedReviewerMrs.length > 0) {
    lines.push('### MRs Awaiting Review');
    for (const mr of unmatchedReviewerMrs) {
      lines.push(`- !${mr.iid}: ${mr.title}`);
    }
    lines.push('');
  }

  if (unmatchedParticipatingMrs.length > 0) {
    lines.push('### Participating MRs');
    for (const mr of unmatchedParticipatingMrs) {
      lines.push(`- Participated in MR !${mr.mrIid} (${mr.title})`);
    }
    lines.push('');
  }

  if (
    inProgress.length === 0 &&
    upNext.length === 0 &&
    unmatchedReviewerMrs.length === 0 &&
    unmatchedParticipatingMrs.length === 0
  ) {
    lines.push('Nothing planned yet.');
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TodayColumnProps {
  onIssueClick: (key: string) => void;
  onMRClick: (projectIdAndIid: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TodayColumn({ onIssueClick, onMRClick }: TodayColumnProps) {
  // ─── Auth store ─────────────────────────────────────────────────────────────
  const { jiraBaseUrl, gitlabBaseUrl, activeJiraProject, gitlabUserId } = useAuthStore();

  // jiraUserDisplayName is separate — fine-grained selector (Phase 68 rule)
  const jiraUserDisplayName = useAuthStore((s) => s.jiraUserDisplayName);

  // ─── Settings store — one selector per field (IN-01: Phase 68 rule) ─────────
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

  // ─── Query 1: Full sprint issues (filtered client-side in filterSprintItems) ──
  // Key: 'sprint-board-today-full' — distinct from 'sprint-board' to avoid
  // contaminating the shared full-team cache used by SprintBoardTab/DashboardInProgressCard.
  // assignedToMe=false fetches the whole sprint so client-side filtering can include
  // parents where I own a subtask even if I'm not assigned to the parent itself.
  const sprintQuery = useQuery({
    queryKey: ['jira-issues', 'sprint-board-today-full', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        false,
        storyPointsFieldKey,
      ),
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
    staleTime: 30_000,
  });

  // ─── Query 2: Reviewer MRs awaiting my review ────────────────────────────────
  const reviewerMrsQuery = useQuery({
    queryKey: ['standup', 'reviewer-mrs', gitlabBaseUrl, gitlabUserId],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchReviewerMRs(gitlabBaseUrl ?? '', token, gitlabUserId ?? 0);
    },
    enabled: !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Query 3: MRs I've participated in (commented on) — role-independent ──────
  // T-62-06: token is read inside queryFn, NOT placed in queryKey.
  const participatingMrsQuery = useQuery({
    queryKey: ['standup', 'participating-mrs', gitlabBaseUrl, gitlabUserId],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      return fetchParticipatedMRs(gitlabBaseUrl ?? '', token, gitlabUserId ?? 0, 30);
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

  // Match MRs to displayed sprint stories (both reviewer + participating)
  const { mrsByStory, unmatchedReviewerMrs, unmatchedParticipatingMrs } = useMemo(
    () =>
      matchMrsToStories(
        [...inProgress, ...upNext],
        reviewerMrsQuery.data ?? [],
        participatingMrsQuery.data ?? [],
      ),
    [inProgress, upNext, reviewerMrsQuery.data, participatingMrsQuery.data],
  );

  // ─── Loading state helpers (for empty-state gate) ─────────────────────────────
  const sprintLoading = useDelayedLoading(sprintQuery.isLoading);

  // ─── Full-column empty state gate ────────────────────────────────────────────
  // Fire only when ALL sections have resolved with 0 items and none are loading/erroring.
  // Nested MRs live under stories, so inProgress/upNext length already covers them.
  const hasAnyData =
    inProgress.length > 0 ||
    upNext.length > 0 ||
    unmatchedReviewerMrs.length > 0 ||
    unmatchedParticipatingMrs.length > 0;

  const allSettledEmpty =
    !hasAnyData &&
    !sprintQuery.isLoading &&
    !sprintLoading &&
    !reviewerMrsQuery.isLoading &&
    !participatingMrsQuery.isLoading &&
    !sprintQuery.isError &&
    !reviewerMrsQuery.isError &&
    !participatingMrsQuery.isError;

  // Every MR shown in the column: those nested under a story + the unmatched fallbacks.
  const nestedMrCount = [...mrsByStory.values()].reduce((sum, mrs) => sum + mrs.length, 0);
  const mrCount = nestedMrCount + unmatchedReviewerMrs.length + unmatchedParticipatingMrs.length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full px-6 py-4">
      {/* Column heading */}
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-2xl font-semibold">Today</h2>
        <p className="text-xs text-muted-foreground">{formatTodayDate()}</p>
      </div>

      {/* Summary stat line — mirrors the Yesterday column so both stay vertically aligned */}
      {hasAnyData && (
        <p className="text-xs text-muted-foreground mb-4">
          {inProgress.length} in progress &middot; {upNext.length} up next &middot; {mrCount} MRs
        </p>
      )}

      {/* Sections separated by spacing only (no dividers). Hidden entirely when the
          whole column resolved empty — the full-column empty state takes over so
          Up Next's "nothing up next" doesn't compete with it. */}
      {!allSettledEmpty && (
        <div className="flex flex-col">
          {/* Section 1: In Progress (D-01: fixed order) */}
          <TodayInProgressSection
            rows={inProgress}
            mrsByStory={mrsByStory}
            storyPointsFieldKey={storyPointsFieldKey}
            isLoading={sprintQuery.isLoading}
            isError={sprintQuery.isError}
            error={sprintQuery.error}
            onRetry={() => void sprintQuery.refetch()}
            onIssueClick={onIssueClick}
            onMRClick={onMRClick}
          />

          {/* Section 2: Up Next (D-01: fixed order) */}
          <TodayUpNextSection
            rows={upNext}
            mrsByStory={mrsByStory}
            storyPointsFieldKey={storyPointsFieldKey}
            isLoading={sprintQuery.isLoading}
            isError={sprintQuery.isError}
            error={sprintQuery.error}
            onRetry={() => void sprintQuery.refetch()}
            onIssueClick={onIssueClick}
            onMRClick={onMRClick}
          />

          {/* Section 3: MRs Awaiting You — unmatched only; hidden when GitLab not connected (D-02, D-10) */}
          {!!gitlabBaseUrl && (
            <TodayMrsSection
              items={unmatchedReviewerMrs}
              isLoading={reviewerMrsQuery.isLoading}
              isError={reviewerMrsQuery.isError}
              error={reviewerMrsQuery.error}
              onRetry={() => void reviewerMrsQuery.refetch()}
              onMRClick={onMRClick}
            />
          )}

          {/* Section 4: Participating MRs (unmatched only) — role-independent, hidden when GitLab not connected */}
          {!!gitlabBaseUrl && (
            <TodayParticipatingSection
              items={unmatchedParticipatingMrs}
              isLoading={participatingMrsQuery.isLoading}
              isError={participatingMrsQuery.isError}
              error={participatingMrsQuery.error}
              onRetry={() => void participatingMrsQuery.refetch()}
              onMRClick={onMRClick}
            />
          )}
        </div>
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
