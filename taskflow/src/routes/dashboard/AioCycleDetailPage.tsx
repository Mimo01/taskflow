import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ui/error-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompactOnScroll } from '@/hooks/useCompactOnScroll';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { refreshAioCycleDetail } from '@/lib/aio-refresh';
import { toLocalDateString } from '@/lib/local-date';
import type { AioTestRun } from '@/services/aio';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { AioCycleDetailSkeleton } from './AioCycleDetailSkeleton';
import { CycleHeader } from './aio-cycle/CycleHeader';
import { CycleKpiTiles } from './aio-cycle/CycleKpiTiles';
import { DefectsList } from './aio-cycle/DefectsList';
import { ExecutionsList } from './aio-cycle/ExecutionsList';
import { useAioCycleData } from './aio-cycle/useAioCycleData';
import { useCycleDefects } from './aio-cycle/useCycleDefects';
import { useCycleStepStats } from './aio-cycle/useCycleStepStats';
import { useEpicWorkCalendar } from './issue-detail/useEpicProgressQueries';

export default function AioCycleDetailPage() {
  const { projectKey, cycleKey } = useParams<{ projectKey: string; cycleKey: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);
  const {
    cycleQuery,
    runsQuery,
    summaryQuery,
    runs,
    counts,
    total,
    hasSummaryData,
    ownerID,
    token,
    tokenLoading,
    jiraBaseUrl,
    jiraProjectId,
    cycleNumericId,
  } = useAioCycleData(projectKey, cycleKey);
  const { defects, isResolving: defectsResolving } = useCycleDefects({
    runs,
    jiraBaseUrl,
    token,
    tokenLoading,
  });
  const stepStats = useCycleStepStats({
    projectKey,
    jiraProjectId,
    cycleNumericId,
    jiraBaseUrl,
    token,
    tokenLoading,
  });
  const { calendar } = useEpicWorkCalendar(toLocalDateString(new Date()));
  const { onOpenIssue } = useOutletContext<{ onOpenIssue?: (issueKey: string) => void }>() ?? {};

  const pinned = usePinnedTabsStore((s) => s.pinnedKeys.includes(cycleKey ?? ''));
  const togglePin = usePinnedTabsStore((s) => s.togglePin);
  const removePin = usePinnedTabsStore((s) => s.removePin);
  const setPinnedCycleMeta = usePinnedTabsStore((s) => s.setPinnedCycleMeta);
  const clearCycleMeta = usePinnedTabsStore((s) => s.clearCycleMeta);

  // Full-page skeleton gates only on cycleQuery (not runsQuery) — progress bar decoupled
  const showSkeleton = useDelayedLoading(cycleQuery.isLoading);
  const cycleName = cycleQuery.data?.name ?? cycleKey ?? '';

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1];
      breadcrumbPop();
      navigate(target.path, { replace: true });
    } else {
      navigate('/dashboard');
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  // `.finally()` on the promise, not a try/finally statement: React Compiler cannot lower a
  // TryStatement without a catch and silently skips memoising the whole page.
  const handleRefresh = () => {
    if (!projectKey || !cycleKey) return;
    setRefreshing(true);
    void refreshAioCycleDetail(queryClient, { jiraBaseUrl, projectKey, cycleKey }).finally(() =>
      setRefreshing(false),
    );
  };
  const lastRefreshed = runsQuery.dataUpdatedAt
    ? new Date(runsQuery.dataUpdatedAt).toLocaleTimeString()
    : '';

  // Header condenses when the page scroller scrolls; its meta line is tall, so require real
  // overflow before condensing (no expand/condense loop on short content).
  const [headerCompact, handleScroll] = useCompactOnScroll(cycleKey, { minOverflow: 120 });

  const openRun = (run: AioTestRun) => {
    if (!run.id) return; // a case without a run has nothing to open
    useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
    navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
  };

  const onTogglePin = () => {
    const key = cycleKey ?? '';
    if (pinned) {
      removePin(key);
      clearCycleMeta(key);
    } else {
      togglePin(key);
      setPinnedCycleMeta(key, { name: cycleName, projectKey: projectKey ?? '' });
    }
  };

  // Latest run update across the cycle (the API has no executedDate; updatedDate is it).
  const lastExecuted = useMemo(() => {
    let best: { t: number; iso: string } | null = null;
    for (const r of runs ?? []) {
      if (!r.executedDate) continue;
      const t = new Date(r.executedDate).getTime();
      if (!Number.isNaN(t) && (best === null || t > best.t)) best = { t, iso: r.executedDate };
    }
    return best?.iso ?? null;
  }, [runs]);

  // Tiles hold in skeleton until either the summary (which needs the AIO status map) or the
  // runs fallback is usable. Waiting on runsQuery too keeps a summary that settled without
  // data from flashing "No runs recorded". isPending (not isLoading): a disabled summaryQuery
  // has fetchStatus 'idle' so isLoading is false even though no data has arrived yet.
  const hasRunsData = !!runs;
  const countsLoading =
    (summaryQuery.isPending || runsQuery.isPending) && !hasSummaryData && !hasRunsData;

  const hasError = cycleQuery.isError || runsQuery.isError;

  return (
    <div className="flex flex-col h-full">
      {/* One header bar above the scroller: back + trail (pushed by the source page), cycle
          identity, title, actions. The current cycle is the identity, not a crumb. */}
      <CycleHeader
        compact={headerCompact}
        nav={
          trail.length > 0
            ? {
                trail,
                onBack: handleBack,
                onNavigate: (i) => {
                  useBreadcrumbStore.setState({ trail: trail.slice(0, i) });
                  navigate(trail[i].path, { replace: true });
                },
              }
            : undefined
        }
        cycle={cycleQuery.data}
        cycleKey={cycleKey ?? ''}
        ownerID={ownerID}
        lastExecuted={lastExecuted}
        pinned={pinned}
        onTogglePin={onTogglePin}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastRefreshed={lastRefreshed}
        jiraBaseUrl={jiraBaseUrl}
        token={token}
      />

      {/* Single page scroll: KPI tiles scroll away; the tab bar and the
          list column headers stick (offset via --aio-sticky-top = tab bar height). */}
      <div
        className="relative min-h-0 flex-1 overflow-auto [--aio-sticky-top:2.75rem]"
        data-testid="aio-cycle-scroll"
        onScroll={handleScroll}
      >
        {hasError && !cycleQuery.data && !runsQuery.data && (
          <div>
            <div className="p-4">
              <ErrorState
                error={cycleQuery.error ?? runsQuery.error}
                onRetry={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey],
                  });
                  void queryClient.invalidateQueries({
                    queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
                  });
                }}
                viewName="cycle detail"
              />
            </div>
          </div>
        )}

        {!hasError && (showSkeleton || cycleQuery.isLoading) ? (
          <div>
            <AioCycleDetailSkeleton />
          </div>
        ) : !hasError && !!cycleQuery.data ? (
          <>
            <CycleKpiTiles
              counts={counts}
              total={total}
              runs={runs}
              countsLoading={countsLoading}
              defectsLoading={!runs || defectsResolving}
              defects={defects}
              stepStats={stepStats}
              cycle={cycleQuery.data}
              calendar={calendar}
            />
            <Tabs defaultValue="executions" className="gap-0">
              <div className="sticky top-0 z-20 flex h-11 items-center bg-background px-6">
                <TabsList>
                  <TabsTrigger value="executions">Executions</TabsTrigger>
                  <TabsTrigger value="defects">Defects</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="executions">
                <ExecutionsList
                  runs={runs}
                  isLoading={runsQuery.isLoading}
                  isError={runsQuery.isError}
                  error={runsQuery.error}
                  onRetry={() => void runsQuery.refetch()}
                  onOpenRun={openRun}
                  jiraBaseUrl={jiraBaseUrl}
                  token={token}
                />
              </TabsContent>

              <TabsContent value="defects">
                <DefectsList
                  defects={defects}
                  isLoading={runsQuery.isLoading}
                  onOpenIssue={onOpenIssue ?? (() => {})}
                  cycleName={cycleName}
                />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </div>
  );
}
