/**
 * ReleasesTab — PM-03 + PM-04: Fix version rows with GitLab date-matched links and task counts.
 *
 * Fetches:
 *   1. Jira fix versions for the active project
 *   2. GitLab project milestones
 *   3. Per-version issue counts from Jira relatedIssueCounts endpoint
 *
 * Date matching uses matchGitLabToFixVersion (exact within same day / fuzzy within 1 day / none).
 * Fuzzy matches show a dashed underline indicator with hover tooltip.
 * Name-based matching is not used — only date proximity determines the link.
 */

import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetch } from '@tauri-apps/plugin-http';
import { RefreshCw, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { GitLabMilestone } from '@/services/gitlab';
import { fetchProjectMilestonesInRange } from '@/services/gitlab';
import type { JiraFixVersion } from '@/services/jira';
import { fetchFixVersions } from '@/services/jira';
import type { ReleaseMatch } from '@/services/releaseLinker';
import { matchGitLabToFixVersion } from '@/services/releaseLinker';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { ReleasesSkeleton } from './ReleasesSkeleton';

interface VersionIssueCounts {
  issuesFixed: number;
  issuesAffected: number;
  issuesTotal: number;
}

async function fetchVersionIssueCounts(
  baseUrl: string,
  token: string,
  _versionId: string,
): Promise<VersionIssueCounts> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Both counts come from the same JQL source so they are always consistent with each other
  // and with what Jira's own UI displays.
  // statusCategory = Done matches any "Done" status regardless of how it is named.
  const baseJql = `fixVersion = ${_versionId} AND issuetype not in subtaskIssueTypes()`;
  const totalJql = encodeURIComponent(baseJql);
  const doneJql = encodeURIComponent(`${baseJql} AND statusCategory = Done`);
  const totalUrl = `${base}/rest/api/2/search?jql=${totalJql}&maxResults=0&fields=`;
  const doneUrl = `${base}/rest/api/2/search?jql=${doneJql}&maxResults=0&fields=`;

  const [totalResult, doneResult] = await Promise.allSettled([
    fetch(totalUrl, { headers }).then((r) =>
      r.ok ? (r.json() as Promise<{ total?: number }>) : { total: 0 },
    ),
    fetch(doneUrl, { headers }).then((r) =>
      r.ok ? (r.json() as Promise<{ total?: number }>) : { total: 0 },
    ),
  ]);

  const issuesTotal = totalResult.status === 'fulfilled' ? (totalResult.value.total ?? 0) : 0;
  const issuesFixed = doneResult.status === 'fulfilled' ? (doneResult.value.total ?? 0) : 0;

  return { issuesFixed, issuesAffected: 0, issuesTotal };
}

interface MatchedVersion {
  version: JiraFixVersion;
  match: ReleaseMatch;
  issuesFixed: number;
  issuesTotal: number;
}

type TimingLabel = 'overdue' | 'due-today' | { daysUntil: number } | null;

function getReleaseTimingLabel(releaseDate: string | undefined, released: boolean): TimingLabel {
  if (released || !releaseDate) return null;
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" — timezone-safe
  if (releaseDate < today) return 'overdue';
  if (releaseDate === today) return 'due-today';
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(releaseDate).getTime() - new Date(today).getTime()) / msPerDay);
  return { daysUntil: days };
}

const RELEASED_PAGE_SIZE = 5;
const RELEASED_LOAD_MORE = 10;

export default function ReleasesTab() {
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, activeGitlabProject } = useAuthStore();
  const navigate = useNavigate();
  const breadcrumbPush = useBreadcrumbStore((s) => s.push);
  const breadcrumbReset = useBreadcrumbStore((s) => s.reset);

  const handleReleaseClick = (versionId: string) => {
    breadcrumbReset();
    breadcrumbPush({ path: '/releases', label: 'Releases' });
    navigate(`/release/${versionId}`);
  };

  const queryClient = useQueryClient();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);
  const [releasedVisible, setReleasedVisible] = useState(RELEASED_PAGE_SIZE);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadMoreReleased = () => setReleasedVisible((n) => n + RELEASED_LOAD_MORE);

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

  // Fetch fix versions
  const {
    data: fixVersions,
    isLoading: loadingVersions,
    isError: errorVersions,
    error: versionError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: () => fetchFixVersions(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? ''),
    enabled: !!jiraBaseUrl && !!activeJiraProject && !!jiraToken,
    staleTime: 5 * 60_000,
  });

  // Date window for milestone matching — derived from Jira fix version dates ± LEEWAY_DAYS.
  // Milestones are only fetched once fix versions are loaded so we can scope the query.
  const MILESTONE_LEEWAY_DAYS = 7;
  const milestoneWindow = (() => {
    const dates = (fixVersions ?? []).map((v) => v.releaseDate).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    const addDays = (d: string, n: number) => {
      const dt = new Date(d);
      dt.setDate(dt.getDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    return { from: addDays(min, -MILESTONE_LEEWAY_DAYS), to: addDays(max, MILESTONE_LEEWAY_DAYS) };
  })();

  // Fetch GitLab milestones scoped to the fix-version date window.
  // Uses paginated sorted fetch so large milestone lists don't miss relevant entries.
  const { data: milestones, isError: milestonesError } = useQuery({
    queryKey: [
      'gitlab-milestones',
      activeGitlabProject,
      milestoneWindow?.from,
      milestoneWindow?.to,
    ],
    queryFn: () =>
      fetchProjectMilestonesInRange(
        gitlabBaseUrl ?? '',
        gitlabToken ?? '',
        activeGitlabProject ?? 0,
        milestoneWindow?.from ?? '',
        milestoneWindow?.to ?? '',
      ),
    enabled: !!gitlabBaseUrl && !!activeGitlabProject && !!gitlabToken && milestoneWindow !== null,
    staleTime: 5 * 60_000,
  });

  // Per-version issue counts (parallel queries)
  const versionCountQueries = useQueries({
    queries: (fixVersions ?? []).map((v) => ({
      queryKey: ['jira-version-counts', v.id],
      queryFn: () => fetchVersionIssueCounts(jiraBaseUrl ?? '', jiraToken ?? '', v.id),
      enabled: !!jiraBaseUrl && !!jiraToken,
      staleTime: 5 * 60_000,
    })),
  });

  // Build matched versions split into: undated, unreleased (with date), released
  const { undatedVersions, unreleasedVersions, releasedVersions } = (() => {
    const versions = fixVersions ?? [];
    const msList: GitLabMilestone[] = milestones ?? [];

    const candidates = msList.map((m) => ({ date: m.due_date, name: m.title, url: m.web_url }));

    const toMatched = (version: JiraFixVersion): MatchedVersion => {
      let bestMatch: ReleaseMatch = { type: 'none', candidateName: '', candidateUrl: '' };
      for (const cand of candidates) {
        const match = matchGitLabToFixVersion(version.releaseDate, cand);
        if (match.type === 'exact') {
          bestMatch = match;
          break;
        }
        if (match.type === 'fuzzy' && bestMatch.type === 'none') bestMatch = match;
      }
      const countQuery = versionCountQueries.find(
        (_, i) => (fixVersions ?? [])[i]?.id === version.id,
      );
      const counts = countQuery?.data;
      return {
        version,
        match: bestMatch,
        issuesFixed: counts?.issuesFixed ?? 0,
        issuesTotal: counts?.issuesTotal ?? 0,
      };
    };

    const dateDesc = (a: JiraFixVersion, b: JiraFixVersion) =>
      (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '');

    const undated = versions.filter((v) => !v.released && !v.releaseDate).map(toMatched);
    const unreleased = versions
      .filter((v) => !v.released && !!v.releaseDate)
      .sort(dateDesc)
      .map(toMatched);
    const released = versions
      .filter((v) => v.released)
      .sort(dateDesc)
      .map(toMatched);

    return { undatedVersions: undated, unreleasedVersions: unreleased, releasedVersions: released };
  })();

  // GGX-WARN-01: Cache-only summary signal. The detail page seeds
  // ['gitlab-wrong-milestone', project, versionId] -> string[] of issue keys whose MR
  // is on the wrong milestone. The list ONLY reads this cache (no fetch, no fan-out):
  // a release shows the warning badge once its detail view has been visited and found
  // ≥1 wrong-milestone MR. Absent cache => no badge (graceful degradation).
  const hasWrongMilestoneMR = (versionId: string): boolean => {
    const keys = queryClient.getQueryData<string[]>([
      'gitlab-wrong-milestone',
      activeGitlabProject,
      versionId,
    ]);
    return Array.isArray(keys) && keys.length > 0;
  };

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  const isLoading = loadingVersions;
  const isError = errorVersions;

  const showSkeleton = useDelayedLoading(isLoading) || isRefreshing;

  useEffect(() => {
    if (!isLoading) setIsRefreshing(false);
  }, [isLoading]);

  // Reset banner dismissal when error state changes
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header row */}
      <div className="flex items-center justify-end gap-2 pb-2">
        {milestonesError && (
          <span
            className="text-xs text-amber-600 dark:text-amber-400"
            title="GitLab milestone data unavailable — links may not appear"
          >
            GitLab unavailable
          </span>
        )}
        <span className="text-xs text-muted-foreground">{lastRefreshed}</span>
        <button
          type="button"
          onClick={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-fix-versions'] });
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      {/* Loading skeleton */}
      {showSkeleton && <ReleasesSkeleton />}

      {/* Error state — full error when no cached data */}
      {isError && !fixVersions && (
        <ErrorState
          error={versionError}
          onRetry={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-fix-versions'] });
          }}
          viewName="releases"
        />
      )}

      {/* Stale data banner — error with cached data still visible */}
      {isError && fixVersions && !bannerDismissed && (
        <StaleDataBanner
          onRetry={() => {
            setIsRefreshing(true);
            queryClient.invalidateQueries({ queryKey: ['jira-fix-versions'] });
          }}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {/* Content */}
      {!showSkeleton &&
        !isError &&
        (undatedVersions.length === 0 &&
        unreleasedVersions.length === 0 &&
        releasedVersions.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No releases found"
            subtitle="Releases will appear once versions are created in Jira"
          />
        ) : (
          <div className="flex flex-col gap-1">
            {/* Render a single release row */}
            {(
              [
                ...undatedVersions,
                ...unreleasedVersions,
                ...releasedVersions.slice(0, releasedVisible),
              ] as MatchedVersion[]
            ).map(({ version, match, issuesFixed, issuesTotal }) => (
              <button
                key={version.id}
                type="button"
                data-testid="release-row"
                onClick={() => handleReleaseClick(version.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReleaseClick(version.id);
                }}
                className="flex items-center justify-between rounded px-3 py-2 hover:bg-muted/50 gap-3 cursor-pointer w-full text-left"
              >
                {/* Version name + badges */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium truncate">{version.name}</span>
                  {/* Status badge — Released or Unreleased + timing */}
                  {(() => {
                    const timing = getReleaseTimingLabel(version.releaseDate, version.released);
                    if (version.released) {
                      return (
                        <Badge tone="green" className="shrink-0">
                          Released
                        </Badge>
                      );
                    }
                    if (timing === 'overdue') {
                      return (
                        <>
                          <Badge tone="red" className="shrink-0">
                            Unreleased
                          </Badge>
                          <Badge tone="red" className="shrink-0">
                            Overdue
                          </Badge>
                        </>
                      );
                    }
                    if (timing === 'due-today') {
                      return (
                        <>
                          <Badge tone="blue" className="shrink-0">
                            Unreleased
                          </Badge>
                          <Badge tone="blue" className="shrink-0">
                            Due today
                          </Badge>
                        </>
                      );
                    }
                    if (timing && typeof timing === 'object' && 'daysUntil' in timing) {
                      return (
                        <>
                          <Badge tone="amber" className="shrink-0">
                            Unreleased
                          </Badge>
                          <span className="text-xs text-muted-foreground shrink-0">
                            In {timing.daysUntil} days
                          </span>
                        </>
                      );
                    }
                    // Unreleased with no date
                    return (
                      <Badge tone="amber" className="shrink-0">
                        Unreleased
                      </Badge>
                    );
                  })()}
                  {/* No date warning — solid badge after status, only for undated unreleased */}
                  {!version.releaseDate && !version.released && (
                    <Badge tone="orange" className="shrink-0">
                      ⚠ No date set
                    </Badge>
                  )}
                  {/* Cache-only wrong-milestone summary — appears after the release's
                      detail view has been visited and found ≥1 MR on the wrong milestone. */}
                  {hasWrongMilestoneMR(version.id) && (
                    <span title="At least one task has a merge request on the wrong milestone">
                      <Badge tone="orange" className="shrink-0">
                        ⚠ MR milestone
                      </Badge>
                    </span>
                  )}
                  {version.releaseDate && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {version.releaseDate}
                    </span>
                  )}
                </div>

                {/* GitLab match indicator */}
                <div className="flex items-center gap-3 shrink-0">
                  {match.type === 'exact' ? (
                    match.candidateUrl ? (
                      <a
                        href={match.candidateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate max-w-[150px]"
                        data-testid="gitlab-link-exact"
                      >
                        {match.candidateName}
                      </a>
                    ) : (
                      <span
                        className="text-xs text-foreground truncate max-w-[150px]"
                        data-testid="gitlab-link-exact"
                      >
                        {match.candidateName}
                      </span>
                    )
                  ) : match.type === 'fuzzy' ? (
                    match.candidateUrl ? (
                      <a
                        href={match.candidateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs border-b border-dashed border-muted-foreground hover:text-foreground truncate max-w-[150px]"
                        title={`Fuzzy match: ${match.candidateName}`}
                        data-testid="gitlab-link-fuzzy"
                      >
                        {match.candidateName}
                      </a>
                    ) : (
                      <span
                        className="text-xs border-b border-dashed border-muted-foreground cursor-default truncate max-w-[150px]"
                        title={`Fuzzy match: ${match.candidateName}`}
                        data-testid="gitlab-link-fuzzy"
                      >
                        {match.candidateName}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground" data-testid="gitlab-link-none">
                      No GitLab link
                    </span>
                  )}

                  {/* Task count */}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {issuesFixed} / {issuesTotal} done
                  </span>
                </div>
              </button>
            ))}

            {/* Load more released */}
            {releasedVersions.length > releasedVisible && (
              <button
                type="button"
                onClick={loadMoreReleased}
                className="mt-1 w-full rounded px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-center"
              >
                Load {Math.min(RELEASED_LOAD_MORE, releasedVersions.length - releasedVisible)} more
                released
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
