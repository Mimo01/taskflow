import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ui/error-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
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
    aioStatusMapReady,
    runs,
    counts,
    total,
    hasSummaryData,
    ownerID,
    token,
    tokenLoading,
    jiraBaseUrl,
  } = useAioCycleData(projectKey, cycleKey);
  const {
    defects,
    openCount,
    isResolving: defectsResolving,
  } = useCycleDefects({ runs, jiraBaseUrl, token, tokenLoading });
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

  // Summary-driven counts can only be interpreted once the AIO status map is populated —
  // otherwise normalizeStatusById resolves every ID to 'notRun' (the all-Not-Run bug on
  // fresh-cache pinned-tab navigation). Hold the tiles in skeleton until it is ready.
  // isPending (not isLoading): a disabled summaryQuery has fetchStatus 'idle' so isLoading
  // is false even though no data has arrived yet.
  const hasRunsData = !!runs;
  const waitingForStatusMap = hasSummaryData && !aioStatusMapReady;
  const countsLoading =
    waitingForStatusMap ||
    ((summaryQuery.isPending || (summaryQuery.isError && runsQuery.isPending)) &&
      !hasSummaryData &&
      !hasRunsData);

  const hasError = cycleQuery.isError || runsQuery.isError;

  return (
    <div className="flex flex-col h-full">
      {/* Shared breadcrumb header — uses useBreadcrumbStore trail. Final segment is the
          current cycle. Source pages push their entry to the trail before navigating here. */}
      {trail.length > 0 && (
        <div
          className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0"
          data-testid="aio-cycle-detail-breadcrumb"
        >
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </button>
          {trail.map((entry, i) => (
            <span key={entry.path} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              <button
                type="button"
                onClick={() => {
                  useBreadcrumbStore.setState({ trail: trail.slice(0, i) });
                  navigate(entry.path, { replace: true });
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                {entry.label}
              </button>
            </span>
          ))}
          <span className="text-muted-foreground">/</span>
          <span className="font-medium" data-testid="aio-cycle-detail-breadcrumb-current">
            {cycleKey}
          </span>
        </div>
      )}

      {/* Single page scroll: header + KPI tiles scroll away; the tab bar and the
          list column headers stick (offset via --aio-sticky-top = tab bar height). */}
      <div
        className="min-h-0 flex-1 overflow-auto [--aio-sticky-top:2.75rem]"
        data-testid="aio-cycle-scroll"
      >
        <CycleHeader
          cycle={cycleQuery.data}
          cycleKey={cycleKey ?? ''}
          ownerID={ownerID}
          lastExecuted={lastExecuted}
          pinned={pinned}
          onTogglePin={onTogglePin}
          jiraBaseUrl={jiraBaseUrl}
          token={token}
        />

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
              openDefects={openCount}
              totalDefects={defects.length}
              defectsLoading={!runs || defectsResolving}
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
                  onOpenRun={openRun}
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
