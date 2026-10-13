import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, FileQuestion } from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useResizable } from '@/hooks/useResizable';
import { PROGRESS_SEGMENT_CLASS } from '@/lib/aio-cycle-list';
import { normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import { aioRunStatusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { AioTestCaseDetail, AioTestRun, AioTestRunStep } from '@/services/aio';
import { fetchAioTestCaseDetail, fetchAioTestRunDetail } from '@/services/aio';
import { fetchJiraIssueByKey } from '@/services/jira';
import type { JiraIssue } from '@/services/jira/types';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { useSettingsStore } from '@/stores/settings.store';
import { AioRunDetailSkeleton } from './AioCycleDetailSkeleton';
import { RunDefectsSection } from './aio-cycle/RunDefectsSection';
import { RunSection } from './aio-cycle/RunSection';
import { RunSidebar } from './aio-cycle/RunSidebar';
import { RunStepCard, RunStepList } from './aio-cycle/RunStepCard';
import { useAioCycleData } from './aio-cycle/useAioCycleData';
import { WikiRenderer } from './WikiRenderer';

/**
 * In-app detail view for a single AIO test run. URL params: projectKey, cycleKey, runId.
 * The test case key/title come from the cycle's runs list (run detail carries no test case,
 * live P3), with the test case detail as fallback and as the description/metadata source.
 */
export default function AioTestRunDetailPage() {
  const { projectKey, cycleKey, runId } = useParams<{
    projectKey: string;
    cycleKey: string;
    runId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);
  const { jiraBaseUrl } = useAuthStore();
  const { token, isLoading: tokenLoading } = useAioCredentials();

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1];
      breadcrumbPop();
      navigate(target.path, { replace: true });
    } else {
      navigate(`/aio-cycle/${projectKey}/${cycleKey}`, { replace: true });
    }
  };

  const openDefect = (key: string) => {
    useBreadcrumbStore.getState().push({ label: `Run ${runId}`, path: location.pathname });
    navigate(`/issue/${key}`);
  };

  const queryClient = useQueryClient();

  // Cycle runs (server/rank order): source of the test case key/title and of Prev/Next.
  // Fetches what it needs itself, so it works on a cold-cache deep link.
  const { runsQuery, navigableRuns } = useAioCycleData(projectKey, cycleKey);

  const detailQuery = useQuery<{ run: AioTestRun; steps: AioTestRunStep[] } | null>({
    queryKey: ['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId],
    queryFn: () =>
      fetchAioTestRunDetail(
        jiraBaseUrl ?? '',
        token ?? '',
        projectKey ?? '',
        cycleKey ?? '',
        runId ?? '',
      ),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey && !!runId,
  });

  const showSkeleton = useDelayedLoading(detailQuery.isLoading);

  const idx = navigableRuns.findIndex((r) => r.id === runId);
  const listRun = idx >= 0 ? navigableRuns[idx] : undefined;
  const prevRun = idx > 0 ? navigableRuns[idx - 1] : undefined;
  const nextRun = idx >= 0 && idx < navigableRuns.length - 1 ? navigableRuns[idx + 1] : undefined;
  const tcKey = listRun?.testCaseKey ?? '';

  // Enabled only once the key is known. A failure never blocks the page: its sections are omitted.
  const testCaseQuery = useQuery<AioTestCaseDetail | null>({
    queryKey: ['aio', jiraBaseUrl, 'testcase-detail', projectKey, tcKey],
    queryFn: () => fetchAioTestCaseDetail(jiraBaseUrl ?? '', token ?? '', projectKey ?? '', tcKey),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!tcKey,
    staleTime: 5 * 60 * 1000,
  });
  const testCase = testCaseQuery.data ?? undefined;

  const cycleHref = `/aio-cycle/${projectKey}/${cycleKey}`;

  const goToRun = (target: AioTestRun | undefined) => {
    if (!target) return;
    // replace: stepping through runs must not grow the history or the breadcrumb trail
    navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${target.id}`, { replace: true });
  };

  // ArrowLeft / ArrowRight step through runs (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
      if (e.key === 'ArrowLeft' && prevRun) goToRun(prevRun);
      else if (e.key === 'ArrowRight' && nextRun) goToRun(nextRun);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // All defects of the run, de-duplicated: run-level first, then any step-only ones,
  // each with the steps it is linked to.
  const defectSteps = new Map<string, number[]>();
  for (const id of detailQuery.data?.run.jiraDefectIDs ?? []) defectSteps.set(String(id), []);
  (detailQuery.data?.steps ?? []).forEach((step, i) => {
    for (const raw of step.jiraDefectIDs ?? []) {
      const id = String(raw);
      defectSteps.set(id, [...(defectSteps.get(id) ?? []), i]);
    }
  });
  const defectIds = [...defectSteps.keys()];

  // Per-defect issue resolution via useQueries — same key as the cycle page
  const issueQueries = useQueries({
    queries: defectIds.map((defectId) => ({
      queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectId],
      queryFn: () => fetchJiraIssueByKey(jiraBaseUrl ?? '', token ?? '', defectId),
      enabled: !!jiraBaseUrl && !!token && !tokenLoading,
    })),
  });

  // Drag-to-resize sidebar — same hook/handle/bounds as the release detail sidebar.
  const panelWidth = useSettingsStore((s) => s.aioRunDetailPanelWidth);
  const setPanelWidth = useSettingsStore((s) => s.setAioRunDetailPanelWidth);
  const layoutRef = useRef<HTMLDivElement>(null);
  const {
    width: sidebarWidth,
    isDragging,
    handleMouseDown,
  } = useResizable({
    initialWidth: panelWidth,
    min: 240,
    max: () => (layoutRef.current?.offsetWidth ?? 800) * 0.5,
    onCommit: setPanelWidth,
    direction: 'left',
  });
  const [handleHovered, setHandleHovered] = useState(false);

  if (!projectKey || !cycleKey || !runId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileQuestion}
          title="Invalid run reference"
          subtitle="Missing projectKey, cycleKey, or runId in the URL."
        />
      </div>
    );
  }

  const title = listRun?.testCase?.title || testCase?.title || '';
  const headerKey = tcKey || undefined;
  const runsPending = !runsQuery.data && !runsQuery.isError;
  const steps = detailQuery.data?.steps ?? [];
  const passedSteps = steps.filter((s) => normalizeStatus(s.status) === 'pass').length;
  const description = testCase?.description?.trim() ? testCase.description : null;

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb: the shared trail, then the owning cycle (unless the trail already
          ends there), then the test case. Always rendered so the way back to the cycle
          lives in one place, including on a direct link / pinned tab with no trail. */}
      {
        <div
          className="px-6 py-3 border-b flex items-center gap-2 text-sm flex-shrink-0"
          data-testid="aio-run-detail-breadcrumb"
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
          {trail[trail.length - 1]?.path !== cycleHref && (
            <span className="flex items-center gap-2">
              {trail.length > 0 && <span className="text-muted-foreground">/</span>}
              <NavLink
                to={cycleHref}
                replace
                aria-label={`Back to cycle ${cycleKey}`}
                className="font-mono text-muted-foreground hover:text-foreground"
              >
                {cycleKey}
              </NavLink>
            </span>
          )}
          <span className="text-muted-foreground">/</span>
          <span className="font-medium" data-testid="aio-run-detail-breadcrumb-current">
            {headerKey ?? `Run ${runId}`}
          </span>
        </div>
      }
      <div className="flex min-w-0 flex-shrink-0 items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className="min-w-0 truncate text-lg font-semibold" data-testid="aio-run-detail-title">
            {title ||
              headerKey ||
              (runsPending ? <Skeleton className="h-5 w-64" /> : `Run ${runId}`)}
          </h1>
          {headerKey && title && (
            <span
              className="flex-none font-mono text-xs text-muted-foreground"
              data-testid="aio-run-detail-key"
            >
              {headerKey}
            </span>
          )}
          {detailQuery.data && (
            <div className="flex flex-none">
              <span
                data-testid="aio-run-detail-status-chip"
                className={aioRunStatusPillClass(detailQuery.data.run.status)}
              >
                {normalizeStatusLabel(detailQuery.data.run.status)}
              </span>
            </div>
          )}
        </div>
        {idx >= 0 && (
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              aria-label="Previous run"
              disabled={!prevRun}
              onClick={() => goToRun(prevRun)}
              className="inline-flex size-7 items-center justify-center rounded hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span
              className="min-w-10 text-center text-xs tabular-nums text-muted-foreground"
              data-testid="aio-run-detail-position"
            >
              {idx + 1}/{navigableRuns.length}
            </span>
            <button
              type="button"
              aria-label="Next run"
              disabled={!nextRun}
              onClick={() => goToRun(nextRun)}
              className="inline-flex size-7 items-center justify-center rounded hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {detailQuery.isError && !detailQuery.data && (
          <div className="p-4">
            <ErrorState
              error={detailQuery.error}
              onRetry={() =>
                void queryClient.invalidateQueries({
                  queryKey: ['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId],
                })
              }
              viewName="run detail"
            />
          </div>
        )}

        {showSkeleton || detailQuery.isLoading ? (
          <AioRunDetailSkeleton />
        ) : detailQuery.data === null ? (
          <div className="p-6">
            <EmptyState
              icon={FileQuestion}
              title="Run not found"
              subtitle={`No run with ID ${runId} in cycle ${cycleKey}.`}
            />
          </div>
        ) : detailQuery.data ? (
          <div className="@container h-full">
            {/* Same two-column shape as the issue detail page: content + border-l sidebar. */}
            <div
              ref={layoutRef}
              className="flex min-h-full flex-col @[900px]:h-full @[900px]:flex-row"
              style={{ '--run-sidebar-w': `${sidebarWidth}px` } as CSSProperties}
            >
              <div
                className="min-w-0 flex-1 space-y-6 p-6 density-compact:space-y-4 density-comfortable:space-y-8 @[900px]:overflow-y-auto"
                data-testid="aio-run-main-scroll"
              >
                {description && (
                  <RunSection title="Description">
                    <div data-testid="aio-run-testcase-description" className="min-w-0 text-sm">
                      <WikiRenderer wikiText={description} />
                    </div>
                  </RunSection>
                )}

                <RunDefectsSection
                  defects={defectIds.map((id, i) => ({
                    id,
                    issue: (issueQueries[i]?.data ?? null) as JiraIssue | null,
                    isLoading: issueQueries[i]?.isLoading ?? false,
                    steps: defectSteps.get(id) ?? [],
                  }))}
                  onOpenDefect={openDefect}
                />

                {steps.length === 0 ? (
                  <EmptyState
                    icon={FileQuestion}
                    title="No steps"
                    subtitle="This run has no step content."
                  />
                ) : (
                  <RunSection
                    title="Steps"
                    count={steps.length}
                    meta={
                      <div className="flex items-center gap-2" data-testid="aio-run-step-summary">
                        <div className="flex h-1.5 w-24 gap-px overflow-hidden rounded-full bg-muted">
                          {steps.map((s, i) => (
                            <span
                              key={s.id ?? i}
                              className={cn(
                                'h-full flex-1',
                                PROGRESS_SEGMENT_CLASS[normalizeStatus(s.status)],
                              )}
                            />
                          ))}
                        </div>
                        <span>
                          {passedSteps}/{steps.length} passed
                        </span>
                      </div>
                    }
                  >
                    <RunStepList>
                      {steps.map((step, i) => (
                        <RunStepCard
                          key={step.id ?? i}
                          step={step}
                          index={i}
                          jiraBaseUrl={jiraBaseUrl}
                          token={token}
                          onOpenDefect={openDefect}
                        />
                      ))}
                    </RunStepList>
                  </RunSection>
                )}
              </div>

              <div
                className={cn(
                  // Two columns scroll independently (sidebar stays put), as on issue detail.
                  'relative border-t p-4 @[900px]:w-(--run-sidebar-w) @[900px]:flex-none @[900px]:overflow-y-auto @[900px]:border-t-0 @[900px]:border-l',
                  !isDragging && 'transition-[width] duration-200',
                )}
                data-testid="aio-run-sidebar-panel"
              >
                {/* Resize handle — mirrors IssueDetailView / ReleaseDetailSidebar. */}
                <div
                  aria-hidden="true"
                  data-testid="aio-run-sidebar-resize"
                  onMouseDown={handleMouseDown}
                  onMouseEnter={() => setHandleHovered(true)}
                  onMouseLeave={() => setHandleHovered(false)}
                  style={{
                    borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined,
                  }}
                  className="absolute top-0 left-0 z-20 hidden h-full w-3 cursor-ew-resize border-l border-border transition-colors duration-100 @[900px]:block"
                />
                <RunSidebar
                  run={detailQuery.data.run}
                  listRun={listRun}
                  testCase={testCase}
                  jiraBaseUrl={jiraBaseUrl}
                  token={token}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
