/**
 * ReleasesTab: F5 fix-version-driven Releases page.
 *
 * Reads top to bottom: hero, agenda rail, Released panel.
 * Rows come from Jira fix versions only. Names, dates and pills render as
 * soon as the fix versions resolve; counts, team and the RM deployment package stream
 * into fixed-size slots (one batched search per visible chunk, hidden released
 * versions are never fetched). Row weight comes from buildAgenda, except that a
 * quiet planned row expands to a full row once its counts show it has issues.
 * Cached revisits render instantly and Refresh never blanks the page.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useReleaseBreakdowns } from '@/hooks/useReleaseBreakdowns';
import { useReleasePackages } from '@/hooks/useReleasePackages';
import { toLocalDateString } from '@/lib/local-date';
import { buildAgenda, releaseSummary } from '@/lib/release-agenda';
import { groupReleases } from '@/lib/release-list';
import { refreshReleaseList } from '@/lib/release-refresh';
import { fetchFixVersions } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { ReleasesSkeleton } from './ReleasesSkeleton';
import { ReleaseAgenda } from './releases-list/ReleaseAgenda';
import { ReleasedPanel } from './releases-list/ReleasedPanel';
import { ReleasesHero } from './releases-list/ReleasesHero';

const RELEASED_PAGE_SIZE = 3;
const RELEASED_LOAD_MORE = 10;

export default function ReleasesTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
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
  const [releasedVisible, setReleasedVisible] = useState(RELEASED_PAGE_SIZE);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

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

  const today = toLocalDateString(new Date());
  const { upcoming, released } = groupReleases(fixVersions ?? []);
  const agenda = buildAgenda(fixVersions ?? [], today);
  const summary = fixVersions ? releaseSummary(fixVersions, today) : null;
  const visibleReleased = agenda.released.slice(0, releasedVisible);

  // The Released panel shows no package, so RM loads for upcoming weeks only.
  const pkgs = useReleasePackages({ dates: upcoming.map((v) => v.releaseDate) });
  const { breakdowns, loadingIds, errorIds, teams } = useReleaseBreakdowns({
    upcomingIds: upcoming.map((v) => v.id),
    releasedIds: released.map((v) => v.id),
    releasedVisible,
    releasedFirstPage: RELEASED_PAGE_SIZE,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshReleaseList(queryClient, activeJiraProject);
    } finally {
      setRefreshing(false);
    }
  };

  // Cached data never skeletons: v5 isLoading is isFetching && isPending.
  const showSkeleton = useDelayedLoading(loadingVersions) && !fixVersions;

  return (
    <div className="flex flex-col pb-10">
      <ReleasesHero
        summary={summary}
        updatedAt={dataUpdatedAt || undefined}
        refreshing={refreshing}
        onRefresh={() => {
          void handleRefresh();
        }}
      />

      <div className="px-6">
        {showSkeleton && <ReleasesSkeleton />}

        {errorVersions && !fixVersions && (
          <div className="pt-3">
            <ErrorState
              error={versionError}
              onRetry={() => {
                void handleRefresh();
              }}
              viewName="releases"
            />
          </div>
        )}

        {errorVersions && fixVersions && !bannerDismissed && (
          <div className="pt-3">
            <StaleDataBanner
              onRetry={() => {
                void handleRefresh();
              }}
              onDismiss={() => setBannerDismissed(true)}
            />
          </div>
        )}

        {fixVersions &&
          (fixVersions.length === 0 ? (
            <EmptyState
              icon={Rocket}
              title="No releases yet"
              subtitle="Fix versions from your Jira projects will appear here once they are created."
            />
          ) : (
            <div className="@container min-w-0">
              <ReleaseAgenda
                entries={agenda.entries}
                breakdowns={breakdowns}
                loadingIds={loadingIds}
                errorIds={errorIds}
                teams={teams}
                showPackage={pkgs.enabled}
                pkgLoading={pkgs.isLoading}
                pkgError={pkgs.isError}
                packageFor={pkgs.packageFor}
                onOpen={handleReleaseClick}
              />
              <ReleasedPanel
                versions={visibleReleased}
                breakdowns={breakdowns}
                loadingIds={loadingIds}
                errorIds={errorIds}
                hasMore={released.length > releasedVisible}
                onShowMore={() => setReleasedVisible((n) => n + RELEASED_LOAD_MORE)}
                onOpen={handleReleaseClick}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
