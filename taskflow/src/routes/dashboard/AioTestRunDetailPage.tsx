import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileQuestion, FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aioRunStatusBadgeClass } from '@/lib/statusStyles';
import type { AioTestRun, AioTestRunStep } from '@/services/aio';
import { fetchAioTestRunDetail } from '@/services/aio';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { AioCycleDetailSkeleton } from './AioCycleDetailSkeleton';
import { WikiRenderer } from './WikiRenderer';

function normalizeStatusLabel(raw: string | undefined): string {
  switch ((raw ?? '').toUpperCase()) {
    case 'PASS':
      return 'Pass';
    case 'FAIL':
      return 'Fail';
    case 'BLOCKED':
      return 'Blocked';
    case 'NOT_EXECUTED':
      return 'Not Run';
    default:
      return raw ?? 'Not Run';
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Plan 54-11: in-app detail view for a single AIO test run. Linked from the
 * Impacted Executions list on the issue detail page. URL params: projectKey,
 * cycleKey, runId. Reuses the same fetchAioTestRunDetail call as
 * AioTestRunsSection so the same data flows here.
 */
export default function AioTestRunDetailPage() {
  const { projectKey, cycleKey, runId } = useParams<{
    projectKey: string;
    cycleKey: string;
    runId: string;
  }>();
  const navigate = useNavigate();
  const trail = useBreadcrumbStore((s) => s.trail);
  const breadcrumbPop = useBreadcrumbStore((s) => s.pop);
  const { jiraBaseUrl } = useAuthStore();
  const [token, setToken] = useState<string | null>(null);

  const handleBack = () => {
    if (trail.length > 0) {
      const target = trail[trail.length - 1];
      breadcrumbPop();
      navigate(target.path, { replace: true });
    } else {
      navigate(`/aio-cycle/${projectKey}/${cycleKey}`, { replace: true });
    }
  };

  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null));
  }, []);

  const queryClient = useQueryClient();

  const detailQuery = useQuery<{ run: AioTestRun; steps: AioTestRunStep[] } | null>({
    queryKey: ['aio', jiraBaseUrl, 'run-detail', projectKey, cycleKey, runId],
    queryFn: () => fetchAioTestRunDetail(jiraBaseUrl!, token!, projectKey!, cycleKey!, runId!),
    enabled: !!jiraBaseUrl && !!token && !!projectKey && !!cycleKey && !!runId,
  });

  const showSkeleton = useDelayedLoading(detailQuery.isLoading);

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

  return (
    <div className="flex flex-col h-full">
      {/* Shared breadcrumb header — only rendered when there's a trail
          (matches IssueDetailPage / ReleaseDetailPage convention). The
          current page identifier (`Run {runId}`) is the final segment. */}
      {trail.length > 0 && (
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
          <span className="text-muted-foreground">/</span>
          <span className="font-medium" data-testid="aio-run-detail-breadcrumb-current">
            Run {runId}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border flex-shrink-0 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <FlaskConical className="size-4 text-muted-foreground shrink-0" />
          <h1 className="text-base font-semibold truncate" data-testid="aio-run-detail-title">
            Run {runId}
          </h1>
        </div>
        {detailQuery.data && (
          <span
            data-testid="aio-run-detail-status-chip"
            className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(detailQuery.data.run.status)}`}
          >
            {normalizeStatusLabel(detailQuery.data.run.status)}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
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
          <div className="p-4">
            <AioCycleDetailSkeleton />
          </div>
        ) : detailQuery.data === null ? (
          <div className="p-6">
            <EmptyState
              icon={FileQuestion}
              title="Run not found"
              subtitle={`No run with ID ${runId} in cycle ${cycleKey}.`}
            />
          </div>
        ) : detailQuery.data ? (
          <div className="px-6 py-4 space-y-4">
            {/* Run metadata */}
            <div className="text-xs text-muted-foreground space-y-0.5">
              {detailQuery.data.run.testCase?.title && (
                <div>
                  <span className="font-semibold">Test case:</span>{' '}
                  <span className="font-mono">{detailQuery.data.run.testCaseKey}</span>
                  {detailQuery.data.run.testCase.title && (
                    <span> — {detailQuery.data.run.testCase.title}</span>
                  )}
                </div>
              )}
              <div>
                <span className="font-semibold">Executed:</span>{' '}
                {formatDate(detailQuery.data.run.executedDate)}
              </div>
            </div>

            {/* Step table */}
            {detailQuery.data.steps.length === 0 ? (
              <EmptyState
                icon={FileQuestion}
                title="No steps"
                subtitle="This run has no step content."
              />
            ) : (
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm border border-border rounded-md"
                  aria-label="Test run steps"
                  data-testid="aio-run-detail-step-table"
                >
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold w-12">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Step</th>
                      <th className="px-3 py-2 text-left font-semibold">Expected</th>
                      <th className="px-3 py-2 text-left font-semibold">Actual</th>
                      <th className="px-3 py-2 text-left font-semibold w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailQuery.data.steps.map((step, idx) => (
                      <tr key={step.id ?? idx} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 min-w-0">
                          <WikiRenderer wikiText={step.step} />
                        </td>
                        <td className="px-3 py-2 min-w-0">
                          <WikiRenderer wikiText={step.expectedResult} />
                        </td>
                        <td className="px-3 py-2 min-w-0">
                          {step.status === 'NOT_EXECUTED' || !step.actualResult ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <WikiRenderer wikiText={step.actualResult} />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(step.status ?? 'NOT_EXECUTED')}`}
                          >
                            {normalizeStatusLabel(step.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
