'use no memo';

/**
 * ActivityStrip — Phase 84 DASH-05/07
 *
 * Compact merged Jira-activity + GitLab-commits feed, newest-first, capped at CAP entries.
 *
 * CACHE SHARING (D-08, criterion 2):
 * Both query keys are byte-identical to StandupNotesPage's jiraActivityQuery and
 * commitsQuery — so a warm Standup cache is reused with zero duplicate network
 * requests. The key construction is intentionally kept parallel to StandupNotesPage
 * lines 308-403.
 *
 * COLD LOAD (D-09):
 * Neither query uses enabled:false — the strip fetches on a cold Dashboard load
 * exactly as Standup would.
 *
 * INDEPENDENT DEGRADATION (DASH-07, D-17):
 * Each source error is handled separately; a Jira failure never blanks commit rows
 * and vice versa.
 */
import { useQuery } from '@tanstack/react-query';
import { Activity, GitCommitHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { fetchUserCommits } from '@/services/gitlab';
import { fetchYesterdayJiraActivity } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import type { ActivityEntry } from './dashboardMetrics';
import { mergeActivityEntries } from './dashboardMetrics';

/** Maximum number of entries to display before showing "+N more". */
const CAP = 6;

export interface ActivityStripProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  jiraUsername: string | null;
  gitlabBaseUrl: string;
  gitlabToken: string;
  activeGitlabProject: number;
  gitlabUsername: string | null;
  gitlabName: string | null;
  gitlabEmail: string | null;
}

/**
 * Format an ISO 8601 timestamp as a relative label.
 * Returns "Xh ago" for times within 24h, otherwise "Yesterday".
 */
function formatRelative(at: string): string {
  const diffMs = Date.now() - new Date(at).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  return 'Yesterday';
}

export default function ActivityStrip({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
  jiraUsername,
  gitlabBaseUrl,
  gitlabToken,
  activeGitlabProject,
  gitlabUsername,
  gitlabName,
  gitlabEmail,
}: ActivityStripProps) {
  // yesterdayDate: YYYY-MM-DD in local timezone (en-CA → ISO-format local date).
  // NEVER toISOString() — that shifts to UTC and produces the wrong date for
  // users east of UTC after midnight (Pitfall 2 — 84-PATTERNS).
  const yesterdayDate = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA');

  // ---------------------------------------------------------------------------
  // Jira activity query
  // Key MUST be byte-identical to StandupNotesPage jiraActivityQuery (lines 308-316)
  // for cache sharing (D-08, criterion 2). Tokens NEVER enter the key (T-84-02).
  // ---------------------------------------------------------------------------
  const jiraActivityQuery = useQuery({
    queryKey: [
      'standup',
      'jira',
      jiraBaseUrl,
      activeJiraProject,
      yesterdayDate,
      jiraUsername ?? '',
    ],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No Jira token');
      return fetchYesterdayJiraActivity(
        jiraBaseUrl ?? '',
        token,
        activeJiraProject ?? '',
        yesterdayDate,
        jiraUsername ?? '',
      );
    },
    // D-09: no enabled:false — cold Dashboard load fires the same fetch Standup would.
    enabled:
      !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!jiraUsername && !!yesterdayDate,
    staleTime: 5 * 60 * 1000,
  });

  // ---------------------------------------------------------------------------
  // Commits query
  // Key MUST be byte-identical to StandupNotesPage commitsQuery (lines 358-403)
  // for cache sharing (D-08, criterion 2).
  //
  // Self-user path: resolvedAccountsKey is '' (not in scope for Dashboard self-user),
  // so the sixth element is gitlabUsername || gitlabName || '' — exactly as
  // StandupNotesPage falls back to resolvedId.gitlabUsername || resolvedId.gitlabName || ''
  // (Pitfall 1 — 84-PATTERNS lines 336-339: never gitlabUserId here).
  //
  // Tokens NEVER enter the key (T-84-02).
  // ---------------------------------------------------------------------------
  const commitsQuery = useQuery({
    queryKey: [
      'standup',
      'commits',
      gitlabBaseUrl,
      activeGitlabProject,
      yesterdayDate,
      gitlabUsername || gitlabName || '',
    ],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token) throw new Error('No GitLab token');
      // Self-user array shape — matches StandupNotesPage's self-user branch
      // (resolvedGitlabUsers is null for Dashboard self-user).
      return fetchUserCommits(
        gitlabBaseUrl ?? '',
        token,
        activeGitlabProject ?? 0,
        yesterdayDate,
        [gitlabUsername ?? ''],
        [gitlabName ?? ''],
        [gitlabEmail ?? ''],
      );
    },
    // D-09: no enabled:false — cold Dashboard load fires the same fetch Standup would.
    enabled:
      !!gitlabBaseUrl &&
      !!gitlabToken &&
      !!activeGitlabProject &&
      !!yesterdayDate &&
      (!!gitlabUsername || !!gitlabName),
    staleTime: 5 * 60 * 1000,
  });

  // Merge and cap. mergeActivityEntries sorts newest-first and slices to cap.
  // Never re-derive merge/sort inline — always delegate to dashboardMetrics (D-10).
  const entries = useMemo(
    () => mergeActivityEntries(jiraActivityQuery.data ?? [], commitsQuery.data ?? [], CAP),
    [jiraActivityQuery.data, commitsQuery.data],
  );

  // Compute total unfiltered count for the "+N more" overflow indicator.
  const totalCount = useMemo(
    () =>
      mergeActivityEntries(
        jiraActivityQuery.data ?? [],
        commitsQuery.data ?? [],
        Number.MAX_SAFE_INTEGER,
      ).length,
    [jiraActivityQuery.data, commitsQuery.data],
  );
  const overflow = Math.max(0, totalCount - CAP);

  const showSkeleton = useDelayedLoading(jiraActivityQuery.isLoading || commitsQuery.isLoading);

  const bothError = jiraActivityQuery.isError && commitsQuery.isError;
  const isEmpty =
    !showSkeleton &&
    !jiraActivityQuery.isLoading &&
    !commitsQuery.isLoading &&
    entries.length === 0 &&
    !jiraActivityQuery.isError &&
    !commitsQuery.isError;

  return (
    <section
      aria-label="Recent activity"
      className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3"
    >
      <h2 className="text-base font-semibold text-foreground">Recent activity</h2>

      {/* Loading skeleton */}
      {showSkeleton && (
        <div aria-busy="true" className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      )}

      {/* Both sources failed — show a single error state */}
      {!showSkeleton && bothError && (
        <ErrorState
          error={jiraActivityQuery.error}
          viewName="recent activity"
          onRetry={() => {
            void jiraActivityQuery.refetch();
            void commitsQuery.refetch();
          }}
        />
      )}

      {/* Empty state — neither source has data and neither errored */}
      {isEmpty && (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          subtitle="Jira and GitLab activity from the last 24 hours will appear here."
        />
      )}

      {/* Feed — render when not loading and at least one entry exists */}
      {!showSkeleton && entries.length > 0 && (
        <div className="flex flex-col">
          {entries.map((entry, i) => (
            <ActivityRow key={entryKey(entry, i)} entry={entry} />
          ))}

          {overflow > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground mt-1 min-h-[32px] text-left"
            >
              +{overflow} more
            </button>
          )}
        </div>
      )}

      {/* Per-source independent errors (DASH-07, D-17).
          Only shown when the other source succeeded, so the strip is never fully blank
          from a single source failing. Mirrors YesterdayColumn lines 796-820 pattern. */}
      {!showSkeleton && !bothError && jiraActivityQuery.isError && (
        <ErrorState
          error={jiraActivityQuery.error}
          viewName="Jira activity"
          onRetry={() => void jiraActivityQuery.refetch()}
        />
      )}
      {!showSkeleton && !bothError && commitsQuery.isError && (
        <ErrorState
          error={commitsQuery.error}
          viewName="GitLab commits"
          onRetry={() => void commitsQuery.refetch()}
        />
      )}
    </section>
  );
}

/** Stable key for each activity row. */
function entryKey(entry: ActivityEntry, index: number): string {
  if (entry.type === 'jira') {
    return `jira-${entry.item.issueKey}-${entry.at}-${index}`;
  }
  return `commit-${entry.item.id}-${index}`;
}

/** A single compact activity row. */
function ActivityRow({ entry }: { entry: ActivityEntry }) {
  if (entry.type === 'jira') {
    const transition = entry.item.transitions[0];
    const description = transition
      ? `Moved ${entry.item.issueKey} to ${transition.toStatus}`
      : `Activity on ${entry.item.issueKey}`;

    return (
      <div className="flex items-start gap-2 py-1">
        <Activity className="size-4 text-sky-500 mt-0.5 shrink-0" aria-hidden />
        <span className="text-sm text-foreground truncate flex-1">{description}</span>
        <span className="text-xs text-muted-foreground shrink-0">{formatRelative(entry.at)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-1">
      <GitCommitHorizontal className="size-4 text-amber-500 mt-0.5 shrink-0" aria-hidden />
      <span className="text-sm text-foreground truncate flex-1">{entry.item.title}</span>
      <span className="text-xs text-muted-foreground shrink-0">{formatRelative(entry.at)}</span>
    </div>
  );
}
