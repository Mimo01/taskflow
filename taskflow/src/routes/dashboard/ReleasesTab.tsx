/**
 * ReleasesTab: fix-version-driven release list.
 *
 * Rows come from Jira fix versions only. Versions are grouped into
 * Upcoming / Released on an AioCycleList-style div+flex grid with one status pill per
 * row. Names, dates and pills render as soon as the fix versions resolve; the RM
 * deployment package and the small issue graph stream into fixed-size slots (one
 * batched search per visible chunk, hidden released versions are never fetched).
 * Cached revisits render instantly and Refresh never blanks the list.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useReleaseBreakdowns } from '@/hooks/useReleaseBreakdowns';
import { useReleasePackages } from '@/hooks/useReleasePackages';
import { toLocalDateString } from '@/lib/local-date';
import { groupReleases, releasePill } from '@/lib/release-list';
import { refreshReleaseList } from '@/lib/release-refresh';
import { fetchFixVersions } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { ReleasesSkeleton } from './ReleasesSkeleton';
import {
  ReleaseGroupLabel,
  ReleaseListHeader,
  ReleaseListRow,
} from './releases-list/ReleaseListRow';

const RELEASED_PAGE_SIZE = 5;
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
  const visibleReleased = released.slice(0, releasedVisible);
  const visible = [...upcoming, ...visibleReleased];

  const pkgs = useReleasePackages({ dates: visible.map((v) => v.releaseDate) });
  const { breakdowns, loadingIds, errorIds } = useReleaseBreakdowns({
    upcomingIds: upcoming.map((v) => v.id),
    releasedIds: released.map((v) => v.id),
    releasedVisible,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshReleaseList(queryClient, activeJiraProject);
    } finally {
      setRefreshing(false);
    }
  };

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : '';

  // Cached data never skeletons: v5 isLoading is isFetching && isPending.
  const showSkeleton = useDelayedLoading(loadingVersions) && !fixVersions;

  const renderRow = (v: (typeof visible)[number]) => (
    <ReleaseListRow
      key={v.id}
      version={v}
      pill={releasePill(v, today)}
      showPackage={pkgs.enabled}
      pkg={pkgs.packageFor(v.releaseDate)}
      pkgLoading={pkgs.isLoading}
      breakdown={breakdowns.get(v.id)}
      graphLoading={loadingIds.has(v.id)}
      graphError={errorIds.has(v.id)}
      onOpen={handleReleaseClick}
    />
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <span className="text-sm font-semibold">Releases</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {(fixVersions ?? []).length}
        </span>
        <div className="flex-1" />
        <span className="hidden text-xs text-muted-foreground sm:inline">{lastRefreshed}</span>
        <button
          type="button"
          onClick={() => {
            void handleRefresh();
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Refresh releases"
          title="Refresh releases"
        >
          <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
        </button>
      </div>

      {showSkeleton && <ReleasesSkeleton showPackage={pkgs.enabled} />}

      {errorVersions && !fixVersions && (
        <div className="px-4 pt-3">
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
        <div className="px-4 pt-3">
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
            <ReleaseListHeader showPackage={pkgs.enabled} />
            {upcoming.length > 0 && (
              <>
                <ReleaseGroupLabel label="Upcoming" count={upcoming.length} />
                {upcoming.map(renderRow)}
              </>
            )}
            {released.length > 0 && (
              <>
                <ReleaseGroupLabel label="Released" count={released.length} />
                {visibleReleased.map(renderRow)}
              </>
            )}
            {released.length > releasedVisible && (
              <button
                type="button"
                onClick={() => setReleasedVisible((n) => n + RELEASED_LOAD_MORE)}
                className="flex w-full justify-center border-b border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {`Show ${Math.min(RELEASED_LOAD_MORE, released.length - releasedVisible)} more`}
              </button>
            )}
          </div>
        ))}
    </div>
  );
}
