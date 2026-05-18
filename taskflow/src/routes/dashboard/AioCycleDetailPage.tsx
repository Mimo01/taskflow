import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Bug, CheckSquare, CornerDownRight, FlaskConical, Pin } from 'lucide-react';
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
import { AIO_STATUS_MAP, normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import { aioCycleStatusPillClass, aioRunStatusPillClass, statusPillClass } from '@/lib/statusStyles';
import type { AioCycle, AioCycleSummaryItem, AioTestRun } from '@/services/aio';
import { fetchAioCycleDetail, fetchAioCycleSummaries, fetchAioCycleTestCasesWithRuns } from '@/services/aio';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { fetchJiraIssueByKey } from '@/services/jira';
import { fetchJiraProjectNumericId } from '@/services/jira/projects';
import type { JiraAssignableUser, JiraIssue } from '@/services/jira/types';
import { fetchJiraUserByUsername } from '@/services/jira/users';
import { useAuthStore } from '@/stores/auth.store';
import { useBreadcrumbStore } from '@/stores/breadcrumb.store';
import { usePinnedTabsStore } from '@/stores/pinned-tabs.store';
import { AioCycleDetailSkeleton } from './AioCycleDetailSkeleton';

function AssigneeCell({
  assignedToID,
  jiraBaseUrl,
  token,
}: {
  assignedToID: string;
  jiraBaseUrl: string | undefined;
  token: string | null;
}) {
  const { data: user, isLoading } = useQuery<JiraAssignableUser | null>({
    queryKey: ['jira', jiraBaseUrl, 'user-by-username', assignedToID],
    queryFn: () => fetchJiraUserByUsername(jiraBaseUrl!, token!, assignedToID),
    enabled: !!jiraBaseUrl && !!token && !!assignedToID,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-4 w-20" />;

  return (
    <div className="flex items-center gap-1.5">
      <CachedAvatar
        url={user?.avatarUrls?.['48x48']}
        name={user?.displayName ?? assignedToID}
        size={20}
      />
      <span className="truncate max-w-[80px]">{user?.displayName ?? assignedToID}</span>
    </div>
  );
}

function IssueTypeIcon({ typeName }: { typeName: string }) {
  const cls = 'w-3.5 h-3.5 shrink-0';
  switch (typeName) {
    case 'Bug':
      return <Bug className={`${cls} text-red-500`} />;
    case 'Story':
      return <BookOpen className={`${cls} text-green-600`} />;
    case 'Subtask':
    case 'Sub-task':
      return <CornerDownRight className={`${cls} text-blue-500`} />;
    case 'Epic':
      return <BookOpen className={`${cls} text-purple-500`} />;
    default:
      return <CheckSquare className={`${cls} text-blue-500`} />;
  }
}

const CHIPS = [
  { status: 'NOT_EXECUTED', label: 'Not Run' },
  { status: 'PASS', label: 'Pass' },
  { status: 'FAIL', label: 'Fail' },
  { status: 'BLOCKED', label: 'Blocked' },
] as const;

function DefectRow({
  defectIdOrKey,
  jiraBaseUrl,
  token,
  tokenLoading,
  triggeredBy,
}: {
  // May be either a numeric Jira internal ID string (e.g. "186227") or a real key (e.g. "PROJ-1234").
  // Jira REST /issue/{idOrKey} accepts both. We render issueQuery.data.key once resolved.
  defectIdOrKey: string;
  jiraBaseUrl: string | undefined;
  token: string | null;
  tokenLoading: boolean;
  triggeredBy: string;
}) {
  const issueQuery = useQuery<JiraIssue | null>({
    queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectIdOrKey],
    queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, defectIdOrKey),
    enabled: !!jiraBaseUrl && !!token && !tokenLoading,
  });

  const displayKey = issueQuery.data?.key ?? defectIdOrKey;
  const linkTarget = `/issue/${issueQuery.data?.key ?? defectIdOrKey}`;

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-3 font-mono text-sm">
        <div className="flex items-center gap-1.5">
          {issueQuery.data?.fields.issuetype?.name !== undefined && (
            <IssueTypeIcon typeName={issueQuery.data.fields.issuetype.name} />
          )}
          <NavLink to={linkTarget} className="hover:underline">
            {displayKey}
          </NavLink>
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        {issueQuery.isLoading ? (
          <Skeleton
            className="h-4 w-32"
            data-testid={`defect-title-loading-${defectIdOrKey}`}
          />
        ) : (
          <span>{issueQuery.data?.fields.summary ?? displayKey}</span>
        )}
      </td>
      <td className="px-3 py-3">
        {issueQuery.data?.fields.status ? (
          <span className={statusPillClass(issueQuery.data.fields.status.statusCategory?.key)}>
            {issueQuery.data.fields.status.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {issueQuery.isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : issueQuery.data?.fields.assignee ? (
          <div className="flex items-center gap-1.5">
            <CachedAvatar
              url={issueQuery.data.fields.assignee.avatarUrls['48x48']}
              name={issueQuery.data.fields.assignee.displayName}
              size={20}
            />
            <span className="truncate max-w-[120px]">{issueQuery.data.fields.assignee.displayName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {issueQuery.isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : issueQuery.data?.fields.reporter ? (
          <div className="flex items-center gap-1.5">
            <CachedAvatar
              url={issueQuery.data.fields.reporter.avatarUrls['48x48']}
              name={issueQuery.data.fields.reporter.displayName}
              size={20}
            />
            <span className="truncate max-w-[120px]">{issueQuery.data.fields.reporter.displayName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {issueQuery.isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : issueQuery.data?.fields.priority ? (
          <div className="flex items-center gap-1.5">
            {issueQuery.data.fields.priority.iconUrl && (
              <img
                src={issueQuery.data.fields.priority.iconUrl}
                alt=""
                className="w-3.5 h-3.5 shrink-0"
              />
            )}
            <span>{issueQuery.data.fields.priority.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {issueQuery.isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (() => {
          const severityValue =
            issueQuery.data?.fields.customfield_13415?.value ??
            issueQuery.data?.fields.customfield_13415?.name ??
            null;
          return severityValue ? (
            <span>{severityValue}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        })()}
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

  // Credential gate — must include !tokenLoading to prevent first-load 401 flash (Pitfall 6)
  const credGate = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey;

  const cycleQuery = useQuery<AioCycle>({
    queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey],
    queryFn: () => fetchAioCycleDetail(jiraBaseUrl!, token!, projectKey!, cycleKey!),
    enabled: credGate,
  });

  // Resolve numeric Jira project ID — required for fetchAioCycleSummaries (AIO paged endpoint)
  // Mirrors AioProjectOverviewPage.tsx lines 281-288.
  const jiraProjectIdQuery = useQuery({
    queryKey: ['jira', jiraBaseUrl, 'project-numeric-id', projectKey],
    queryFn: () => fetchJiraProjectNumericId(jiraBaseUrl!, token!, projectKey!),
    enabled: credGate,
    staleTime: 60 * 60 * 1000,
  });
  const jiraProjectId = jiraProjectIdQuery.data ?? null;

  // aioGate requires the numeric jiraProjectId to be resolved
  const aioGate = credGate && !!jiraProjectId;

  // CYCLE_NUMERIC_ID_DECISION: USE-DETAIL-ID — AioCycle.ID populated by normalizeCycle from /detail response
  const cycleNumericId = cycleQuery.data?.ID ?? null;

  // Summary query — drives progress bar independently of runsQuery (Pattern 2)
  // Key matches AioProjectOverviewPage convention for shared cache.
  const summaryQuery = useQuery<AioCycleSummaryItem[]>({
    queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, String(cycleNumericId)],
    queryFn: () => fetchAioCycleSummaries(jiraBaseUrl!, token!, jiraProjectId!, [cycleNumericId!]),
    enabled: aioGate && !!cycleNumericId && !tokenLoading,
  });

  // Runs query — uses fast POST paged endpoint (numeric IDs required, gated on aioGate + cycleNumericId)
  const runsQuery = useQuery<AioTestRun[]>({
    queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey],
    queryFn: () => fetchAioCycleTestCasesWithRuns(jiraBaseUrl!, token!, jiraProjectId!, cycleNumericId!, cycleKey!),
    enabled: aioGate && !!cycleNumericId,
  });

  // Full-page skeleton gates only on cycleQuery (not runsQuery) — progress bar decoupled
  const showSkeleton = useDelayedLoading(cycleQuery.isLoading);


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
  const runsTotal = runs?.length ?? 0;

  // Runs-derived counts — kept as graceful degradation fallback when summaryQuery errors
  const runsCounts = (runs ?? []).reduce(
    (acc, run) => {
      const norm = normalizeStatus(run.status);
      acc[norm] = (acc[norm] ?? 0) + 1;
      return acc;
    },
    { pass: 0, fail: 0, blocked: 0, notRun: 0, inProgress: 0 },
  );

  // Summary-derived counts — primary source (fast path, independent of full run list)
  // Pitfall 5: testRunDistribution keys are JSON strings — ALWAYS Number(idStr) before lookup
  const summaryDistribution = summaryQuery.data?.[0]?.summary.testRunDistribution;
  const summaryTotal = summaryQuery.data?.[0]?.summary.totalTests ?? 0;
  const summaryCounts = summaryDistribution
    ? Object.entries(summaryDistribution).reduce(
        (acc, [idStr, count]) => {
          const statusKey = AIO_STATUS_MAP[Number(idStr)] ?? 'notRun';
          acc[statusKey] = (acc[statusKey] ?? 0) + count;
          return acc;
        },
        { pass: 0, fail: 0, blocked: 0, notRun: 0, inProgress: 0 },
      )
    : null;

  // Final counts/total resolution:
  // 1. summaryQuery resolved with data → use summaryCounts + summaryTotal
  // 2. summaryQuery errored but runs available → graceful degradation to runsCounts
  // 3. Both loading or no data → use runsCounts (may be zeros initially)
  const counts =
    summaryQuery.data && summaryTotal > 0
      ? summaryCounts!
      : summaryQuery.isError && runs
        ? runsCounts
        : runsCounts;
  const total =
    summaryQuery.data && summaryTotal > 0
      ? summaryTotal
      : summaryQuery.isError && runs
        ? runsTotal
        : runsTotal;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const filteredRuns = (runs ?? []).filter((r) => activeStatuses.has(r.status));

  // DefectRow data source — switched from r.defects (service-resolved) to r.jiraDefectIDs (raw numeric IDs as strings)
  // DefectRow's own useQuery resolves each key via fetchJiraIssueByKey — unchanged and correct.
  const allDefects = [...new Set((runs ?? []).flatMap((r) => (r.jiraDefectIDs ?? []).map(String)).filter(Boolean))];

  const defectsWithTriggers = allDefects.map((defectKey) => ({
    defectKey,
    triggeredBy: (runs ?? [])
      .filter((r) => (r.jiraDefectIDs ?? []).map(String).includes(defectKey))
      .map((r) => r.testCaseKey)
      .filter(Boolean)
      .join(', '),
  }));

  const cycleName = cycleQuery.data?.name ?? cycleKey ?? '';

  const openRun = (run: AioTestRun) => {
    useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
    navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
  };

  // Determine whether progress bar should be visible
  // Show when summaryQuery has data OR runs are available — do NOT wait for both
  const hasSummaryData = !!summaryQuery.data && summaryTotal > 0;
  const hasRunsData = !!runs;
  const showProgressBar = hasSummaryData || hasRunsData;
  const showProgressSkeleton = summaryQuery.isLoading && !hasSummaryData && !hasRunsData;

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
            <span className={aioCycleStatusPillClass(cycleQuery.data.status)}>
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

      {!cycleQuery.isError && !runsQuery.isError && (showSkeleton || cycleQuery.isLoading) ? (
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <AioCycleDetailSkeleton />
          </div>
        </div>
      ) : !cycleQuery.isError && !runsQuery.isError && !!cycleQuery.data ? (
        <Tabs defaultValue="executions" className="flex-1 flex flex-col min-h-0">
          {/* Progress section — driven by summaryQuery (fast path) with runs fallback.
              Renders independently of runsQuery — decoupled from full run enumeration. */}
          <div className="px-6 py-4 border-b border-border">
            {showProgressSkeleton ? (
              <Skeleton className="h-2 w-full rounded-full" />
            ) : !showProgressBar || total === 0 ? (
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
                  {counts.inProgress > 0 && (
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${pct(counts.inProgress)}%` }}
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
                  {counts.inProgress > 0 && (
                    <span>
                      In Progress: {counts.inProgress} ({pct(counts.inProgress)}%)
                    </span>
                  )}
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

            {/* Runs table — shows skeleton while runsQuery is loading */}
            {runsQuery.isLoading && !runsQuery.data && (
              <Skeleton className="h-6 w-full mx-3 my-2" data-testid="runs-table-skeleton" />
            )}

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
                    <th className="w-20 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Defects
                    </th>
                    <th className="w-16 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Runs
                    </th>
                    <th className="w-28 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Assignee
                    </th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
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
                      <td className="px-4 py-3">
                        {run.testCaseKey && (
                          <span className="block font-mono text-xs text-muted-foreground mb-0.5">
                            {run.testCaseKey}
                          </span>
                        )}
                        {run.testCase?.title ?? run.testCaseKey}
                      </td>
                      <td className="px-3 py-3">
                        <span className={aioRunStatusPillClass(run.status)}>
                          {normalizeStatusLabel(run.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {(run.jiraDefectIDs?.length ?? 0) > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            {run.jiraDefectIDs!.length}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {run.runCount ?? '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {run.assignedToID ? (
                          <AssigneeCell
                            assignedToID={run.assignedToID}
                            jiraBaseUrl={jiraBaseUrl ?? undefined}
                            token={token}
                          />
                        ) : (
                          <span>—</span>
                        )}
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
                    <th className="w-36 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Key
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Title
                    </th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Assignee
                    </th>
                    <th className="w-36 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Reporter
                    </th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Priority
                    </th>
                    <th className="w-24 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Severity
                    </th>
                    <th className="w-48 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Triggered By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {defectsWithTriggers.map(({ defectKey: defectIdOrKey, triggeredBy }) => (
                    <DefectRow
                      key={defectIdOrKey}
                      defectIdOrKey={defectIdOrKey}
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
