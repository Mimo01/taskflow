import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical, Pin } from 'lucide-react';
import { useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import { aioCycleStatusBadgeClass, aioRunStatusBadgeClass } from '@/lib/statusStyles';
import type { AioCycle, AioTestRun } from '@/services/aio';
import { fetchAioCycleDetail, fetchAioTestRunsForCycle } from '@/services/aio';
import { fetchJiraIssueByKey } from '@/services/jira';
import type { JiraIssue } from '@/services/jira/types';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { AioCycleDetailSkeleton } from './AioCycleDetailSkeleton';

const CHIPS = [
  { status: 'NOT_EXECUTED', label: 'Not Run' },
  { status: 'PASS', label: 'Pass' },
  { status: 'FAIL', label: 'Fail' },
  { status: 'BLOCKED', label: 'Blocked' },
] as const;

function DefectRow({
  defectKey,
  jiraBaseUrl,
  token,
  tokenLoading,
  triggeredBy,
}: {
  defectKey: string;
  jiraBaseUrl: string | undefined;
  token: string | null;
  tokenLoading: boolean;
  triggeredBy: string;
}) {
  const issueQuery = useQuery<JiraIssue | null>({
    queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey],
    queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, defectKey),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading,
  });

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-3 font-mono text-sm">
        <NavLink to={`/issue/${defectKey}`} className="hover:underline">
          {defectKey}
        </NavLink>
      </td>
      <td className="px-3 py-3 text-sm">
        {issueQuery.isLoading ? (
          <Skeleton
            className="h-4 w-32"
            data-testid={`defect-title-loading-${defectKey}`}
          />
        ) : (
          <span>{issueQuery.data?.fields.summary ?? defectKey}</span>
        )}
      </td>
      <td className="px-3 py-3">
        {issueQuery.data?.fields.status.name ? (
          <span className="inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
            {issueQuery.data.fields.status.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{triggeredBy || '—'}</td>
    </tr>
  );
}

export default function AioCycleDetailPage() {
  const { projectKey, cycleKey } = useParams<{ projectKey: string; cycleKey: string }>();
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
      navigate('/dashboard');
    }
  };

  const queryClient = useQueryClient();

  const cycleQuery = useQuery<AioCycle>({
    queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey],
    queryFn: () => fetchAioCycleDetail(jiraBaseUrl!, token!, projectKey!, cycleKey!),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey,
  });

  const runsQuery = useQuery<AioTestRun[]>({
    queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
    queryFn: () => fetchAioTestRunsForCycle(jiraBaseUrl!, token!, projectKey!, cycleKey!),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey,
  });

  const showSkeleton = useDelayedLoading(cycleQuery.isLoading || runsQuery.isLoading);

  const pinned = usePinnedTabsStore((s) => s.pinnedKeys.includes(cycleKey ?? ''));
  const togglePin = usePinnedTabsStore((s) => s.togglePin);
  const removePin = usePinnedTabsStore((s) => s.removePin);
  const setPinnedCycleMeta = usePinnedTabsStore((s) => s.setPinnedCycleMeta);
  const clearCycleMeta = usePinnedTabsStore((s) => s.clearCycleMeta);

  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    new Set(['NOT_EXECUTED', 'PASS', 'FAIL', 'BLOCKED']),
  );
  const chipRefs = useRef<(HTMLElement | null)[]>([]);

  const runs = runsQuery.data;
  const total = runs?.length ?? 0;

  const counts = (runs ?? []).reduce(
    (acc, run) => {
      const norm = normalizeStatus(run.status);
      acc[norm] = (acc[norm] ?? 0) + 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0 },
  );

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const filteredRuns = (runs ?? []).filter((r) => activeStatuses.has(r.status));

  const allDefects = [...new Set((runs ?? []).flatMap((r) => r.defects ?? []).filter(Boolean))];

  const defectsWithTriggers = allDefects.map((defectKey) => ({
    defectKey,
    triggeredBy: (runs ?? [])
      .filter((r) => (r.defects ?? []).includes(defectKey))
      .map((r) => r.testCaseKey)
      .filter(Boolean)
      .join(', '),
  }));

  const cycleName = cycleQuery.data?.name ?? cycleKey ?? '';

  const openRun = (run: AioTestRun) => {
    useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
    navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Shared breadcrumb header — uses useBreadcrumbStore trail
          (matches IssueDetailPage / ReleaseDetailPage convention). Final
          segment is the current cycle. Source pages push their entry to
          the trail before navigating here. */}
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{cycleName}</h1>
          {cycleQuery.data && (
            <span
              className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioCycleStatusBadgeClass(cycleQuery.data.status)}`}
            >
              {cycleQuery.data.status}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          aria-label={pinned ? `Unpin cycle ${cycleKey}` : `Pin cycle ${cycleKey}`}
          title={pinned ? 'Unpin from tabs' : 'Pin to tabs'}
          onClick={() => {
            if (pinned) {
              removePin(cycleKey!);
              clearCycleMeta(cycleKey!);
            } else {
              togglePin(cycleKey!);
              setPinnedCycleMeta(cycleKey!, { name: cycleName, projectKey: projectKey! });
            }
          }}
        >
          <Pin className={`size-3.5 ${pinned ? 'fill-current text-primary' : ''}`} />
          {pinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>

      {(cycleQuery.isError || runsQuery.isError) && !cycleQuery.data && !runsQuery.data && (
        <div className="flex-1 overflow-auto">
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

      {showSkeleton || cycleQuery.isLoading || runsQuery.isLoading ? (
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <AioCycleDetailSkeleton />
          </div>
        </div>
      ) : !cycleQuery.isError && !runsQuery.isError && !!cycleQuery.data ? (
        <Tabs defaultValue="executions" className="flex-1 flex flex-col min-h-0">
          {/* Progress section — stays OUTSIDE TabsContent, INSIDE Tabs root */}
          <div className="px-6 py-4 border-b border-border">
            {total === 0 ? (
              <p className="text-sm text-muted-foreground">No runs recorded</p>
            ) : (
              <>
                <div className="w-full h-2 rounded-full overflow-hidden flex">
                  {counts.pass > 0 && (
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${pct(counts.pass)}%` }}
                    />
                  )}
                  {counts.fail > 0 && (
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${pct(counts.fail)}%` }}
                    />
                  )}
                  {counts.blocked > 0 && (
                    <div
                      className="bg-orange-400 h-full"
                      style={{ width: `${pct(counts.blocked)}%` }}
                    />
                  )}
                  {counts.notRun > 0 && (
                    <div
                      className="bg-muted h-full"
                      style={{ width: `${pct(counts.notRun)}%` }}
                    />
                  )}
                </div>
                <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span>
                    Pass: {counts.pass} ({pct(counts.pass)}%)
                  </span>
                  <span>
                    Fail: {counts.fail} ({pct(counts.fail)}%)
                  </span>
                  <span>
                    Blocked: {counts.blocked} ({pct(counts.blocked)}%)
                  </span>
                  <span>
                    Not Run: {counts.notRun} ({pct(counts.notRun)}%)
                  </span>
                </div>
              </>
            )}
          </div>

          <TabsList className="mx-6 my-1.5">
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="defects">Defects</TabsTrigger>
          </TabsList>

          <TabsContent value="executions" className="flex-1 overflow-auto">
            {/* Filter chips toolbar */}
            <div
              role="toolbar"
              aria-label="Status filters"
              className="flex items-center gap-2 px-3 py-1.5"
            >
              {CHIPS.map((chip, i) => {
                const isActive = activeStatuses.has(chip.status);
                return (
                  <Badge
                    key={chip.status}
                    ref={(el: HTMLElement | null) => {
                      chipRefs.current[i] = el;
                    }}
                    variant={isActive ? 'default' : 'outline'}
                    role="switch"
                    aria-checked={isActive}
                    tabIndex={i === 0 ? 0 : -1}
                    className="cursor-pointer select-none"
                    onClick={() => {
                      setActiveStatuses((prev) => {
                        const next = new Set(prev);
                        if (next.has(chip.status)) next.delete(chip.status);
                        else next.add(chip.status);
                        return next;
                      });
                    }}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setActiveStatuses((prev) => {
                          const next = new Set(prev);
                          if (next.has(chip.status)) next.delete(chip.status);
                          else next.add(chip.status);
                          return next;
                        });
                      }
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        const next = chipRefs.current[i + 1];
                        if (next) {
                          next.setAttribute('tabindex', '0');
                          next.focus();
                          chipRefs.current[i]?.setAttribute('tabindex', '-1');
                        }
                      }
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const prev = chipRefs.current[i - 1];
                        if (prev) {
                          prev.setAttribute('tabindex', '0');
                          prev.focus();
                          chipRefs.current[i]?.setAttribute('tabindex', '-1');
                        }
                      }
                    }}
                  >
                    {chip.label}
                  </Badge>
                );
              })}
            </div>

            {/* Run table */}
            {runs !== undefined && runs.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="No test runs found"
                subtitle="No test runs have been recorded for this cycle yet."
              />
            ) : filteredRuns.length === 0 && runs && runs.length > 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No runs match the selected filters. Try toggling more status filters above.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                      Test Case
                    </th>
                    <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="w-36 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                      data-testid={`run-row-${run.id}`}
                      aria-label={`Open run for ${run.testCase?.title ?? run.testCaseKey}`}
                      onClick={() => openRun(run)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openRun(run);
                        }
                      }}
                    >
                      <td className="px-4 py-3">{run.testCase?.title ?? run.testCaseKey}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${aioRunStatusBadgeClass(run.status)}`}
                        >
                          {normalizeStatusLabel(run.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {(() => {
                          const raw = run.executedDate ?? run.testCase?.updatedDate;
                          if (!raw) return '—';
                          const d = new Date(raw);
                          return isNaN(d.getTime())
                            ? raw
                            : d.toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              });
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="defects" className="flex-1 overflow-auto">
            {allDefects.length === 0 ? (
              <EmptyState
                icon={FlaskConical}
                title="No defects"
                subtitle="No defects are linked to runs in this cycle."
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/10">
                  <tr>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Key
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Title
                    </th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="w-48 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Triggered By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {defectsWithTriggers.map(({ defectKey, triggeredBy }) => (
                    <DefectRow
                      key={defectKey}
                      defectKey={defectKey}
                      jiraBaseUrl={jiraBaseUrl ?? undefined}
                      token={token}
                      tokenLoading={tokenLoading}
                      triggeredBy={triggeredBy}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
