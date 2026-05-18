import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Bug,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  FlaskConical,
  Pin,
  X,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { AIO_STATUS_MAP, normalizeStatus, normalizeStatusLabel } from '@/lib/aioUtils';
import {
  aioCycleStatusPillClass,
  aioRunStatusPillClass,
  statusPillClass,
} from '@/lib/statusStyles';
import type { AioCycle, AioCycleSummaryItem, AioTestRun } from '@/services/aio';
import {
  fetchAioCycleDetail,
  fetchAioCycleSummaries,
  fetchAioCycleTestCasesWithRuns,
} from '@/services/aio';
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

// Priority rank map for sort order (lower = higher priority)
const PRIORITY_RANK: Record<string, number> = {
  Highest: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Lowest: 4,
};

type DefectSortKey = 'key' | 'status' | 'priority' | 'severity' | 'assignee' | null;

// Module-level helper components (stable references — not recreated on parent render)
function SortableHeader({
  sortKey,
  label,
  className,
  activeSortKey,
  activeSortDir,
  onSort,
}: {
  sortKey: Exclude<DefectSortKey, null>;
  label: string;
  className?: string;
  activeSortKey: DefectSortKey;
  activeSortDir: 'asc' | 'desc';
  onSort: (key: Exclude<DefectSortKey, null>) => void;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      className={`px-3 py-2 text-left text-xs font-medium text-muted-foreground ${className ?? ''}`}
    >
      <button
        type="button"
        data-testid={`defects-sort-header-${sortKey}`}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive && activeSortDir === 'asc' && (
          <ChevronUp className="w-3 h-3" data-testid={`defects-sort-indicator-${sortKey}`} />
        )}
        {isActive && activeSortDir === 'desc' && (
          <ChevronDown className="w-3 h-3" data-testid={`defects-sort-indicator-${sortKey}`} />
        )}
      </button>
    </th>
  );
}

function FilterPopover({
  dimension,
  testId,
  options,
  selected,
  setSelected,
}: {
  dimension: string;
  testId: string;
  options: string[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const isActive = selected.size > 0;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            data-testid={testId}
          />
        }
      >
        {dimension}
        {isActive && <span className="ml-0.5 opacity-70">({selected.size})</span>}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">No options available</p>
        ) : (
          <ul className="max-h-48 overflow-auto space-y-0.5">
            {options.map((opt) => {
              const checked = selected.has(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted flex items-center gap-2 ${checked ? 'font-medium' : ''}`}
                    onClick={() => {
                      setSelected((prev) => {
                        const n = new Set(prev);
                        if (n.has(opt)) n.delete(opt);
                        else n.add(opt);
                        return n;
                      });
                    }}
                  >
                    <span
                      className={`w-3 h-3 border rounded-sm flex items-center justify-center shrink-0 ${checked ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                    >
                      {checked && (
                        <span className="text-primary-foreground text-[8px] leading-none">✓</span>
                      )}
                    </span>
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

// DefectRow is now purely presentational — issue resolution is owned by parent via useQueries
function DefectRow({
  defectIdOrKey,
  issue,
  isLoading,
  triggeredBy,
  onOpen,
}: {
  defectIdOrKey: string;
  issue: JiraIssue | null;
  isLoading: boolean;
  triggeredBy: string;
  onOpen: (resolvedKey: string) => void;
}) {
  const displayKey = issue?.key ?? defectIdOrKey;
  const linkTarget = `/issue/${issue?.key ?? defectIdOrKey}`;
  const resolvedKey = issue?.key ?? null;
  const isClickable = !isLoading && !!resolvedKey;

  return (
    <tr
      className={`border-b border-border hover:bg-muted/30 transition-colors${isClickable ? ' cursor-pointer' : ''}`}
      data-testid={`defect-row-${defectIdOrKey}`}
      {...(isClickable
        ? {
            role: 'button' as const,
            tabIndex: 0,
            'aria-label': `Open defect ${resolvedKey}`,
            onClick: () => onOpen(resolvedKey!),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(resolvedKey!);
              }
            },
          }
        : {})}
    >
      <td className="px-3 py-3 font-mono text-sm">
        <div className="flex items-center gap-1.5">
          {issue?.fields.issuetype?.name !== undefined && (
            <IssueTypeIcon typeName={issue.fields.issuetype.name} />
          )}
          <NavLink to={linkTarget} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {displayKey}
          </NavLink>
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        {isLoading ? (
          <Skeleton className="h-4 w-32" data-testid={`defect-title-loading-${defectIdOrKey}`} />
        ) : (
          <span>{issue?.fields.summary ?? displayKey}</span>
        )}
      </td>
      <td className="px-3 py-3">
        {issue?.fields.status ? (
          <span className={statusPillClass(issue.fields.status.statusCategory?.key)}>
            {issue.fields.status.name}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : issue?.fields.assignee ? (
          <div className="flex items-center gap-1.5">
            <CachedAvatar
              url={issue.fields.assignee.avatarUrls['48x48']}
              name={issue.fields.assignee.displayName}
              size={20}
            />
            <span className="truncate max-w-[120px]">{issue.fields.assignee.displayName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-4 w-20" />
        ) : issue?.fields.reporter ? (
          <div className="flex items-center gap-1.5">
            <CachedAvatar
              url={issue.fields.reporter.avatarUrls['48x48']}
              name={issue.fields.reporter.displayName}
              size={20}
            />
            <span className="truncate max-w-[120px]">{issue.fields.reporter.displayName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : issue?.fields.priority ? (
          <div className="flex items-center gap-1.5">
            {issue.fields.priority.iconUrl && (
              <img src={issue.fields.priority.iconUrl} alt="" className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{issue.fields.priority.name}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : (
          (() => {
            const severityValue =
              issue?.fields.customfield_13415?.value ??
              issue?.fields.customfield_13415?.name ??
              null;
            return severityValue ? (
              <span>{severityValue}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            );
          })()
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
    queryFn: () =>
      fetchAioCycleTestCasesWithRuns(
        jiraBaseUrl!,
        token!,
        jiraProjectId!,
        cycleNumericId!,
        cycleKey!,
      ),
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
  const allDefects = [
    ...new Set((runs ?? []).flatMap((r) => (r.jiraDefectIDs ?? []).map(String)).filter(Boolean)),
  ];

  const defectsWithTriggers = allDefects.map((defectKey) => ({
    defectKey,
    triggeredBy: (runs ?? [])
      .filter((r) => (r.jiraDefectIDs ?? []).map(String).includes(defectKey))
      .map((r) => r.testCaseKey)
      .filter(Boolean)
      .join(', '),
  }));

  // Parent-owned issue queries — all defect issues resolved in one place via useQueries
  // so the parent has access to all JiraIssue objects for sorting and filtering
  const issueQueries = useQueries({
    queries: defectsWithTriggers.map((d) => ({
      queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', d.defectKey],
      queryFn: () => fetchJiraIssueByKey(jiraBaseUrl!, token!, d.defectKey),
      enabled: !!jiraBaseUrl && !!token && !tokenLoading,
    })),
  });

  // Build resolved defects array: { defectKey, triggeredBy, issue, isLoading }
  const resolvedDefects = useMemo(
    () =>
      defectsWithTriggers.map((d, i) => ({
        defectKey: d.defectKey,
        triggeredBy: d.triggeredBy,
        issue: (issueQueries[i]?.data ?? null) as JiraIssue | null,
        isLoading: issueQueries[i]?.isLoading ?? false,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defectsWithTriggers, issueQueries],
  );

  // ── Defect sort + filter state ──────────────────────────────────────────────
  const [defectSortKey, setDefectSortKey] = useState<DefectSortKey>(null);
  const [defectSortDir, setDefectSortDir] = useState<'asc' | 'desc'>('asc');
  const [defectStatusFilter, setDefectStatusFilter] = useState<Set<string>>(new Set());
  const [defectPriorityFilter, setDefectPriorityFilter] = useState<Set<string>>(new Set());
  const [defectSeverityFilter, setDefectSeverityFilter] = useState<Set<string>>(new Set());
  const [defectAssigneeFilter, setDefectAssigneeFilter] = useState<Set<string>>(new Set());

  // Derived filter options from resolved (non-loading) issues
  const statusOptions = useMemo(() => {
    const vals = resolvedDefects
      .filter((d) => !d.isLoading && d.issue)
      .map((d) => d.issue!.fields.status?.name)
      .filter(Boolean) as string[];
    return [...new Set(vals)].sort();
  }, [resolvedDefects]);

  const priorityOptions = useMemo(() => {
    const vals = resolvedDefects
      .filter((d) => !d.isLoading && d.issue)
      .map((d) => d.issue!.fields.priority?.name)
      .filter(Boolean) as string[];
    return [...new Set(vals)].sort();
  }, [resolvedDefects]);

  const severityOptions = useMemo(() => {
    const vals = resolvedDefects
      .filter((d) => !d.isLoading && d.issue)
      .map(
        (d) => d.issue!.fields.customfield_13415?.value ?? d.issue!.fields.customfield_13415?.name,
      )
      .filter(Boolean) as string[];
    return [...new Set(vals)].sort();
  }, [resolvedDefects]);

  const assigneeOptions = useMemo(() => {
    const vals = resolvedDefects
      .filter((d) => !d.isLoading && d.issue)
      .map((d) => d.issue!.fields.assignee?.displayName)
      .filter(Boolean) as string[];
    return [...new Set(vals)].sort();
  }, [resolvedDefects]);

  const anyFilterActive =
    defectStatusFilter.size > 0 ||
    defectPriorityFilter.size > 0 ||
    defectSeverityFilter.size > 0 ||
    defectAssigneeFilter.size > 0;

  // Filter pipeline
  const filteredDefects = useMemo(() => {
    if (!anyFilterActive) return resolvedDefects;
    return resolvedDefects.filter((d) => {
      // Loading rows excluded when any filter is active
      if (d.isLoading) return false;
      if (!d.issue) return false;

      const statusMatch =
        defectStatusFilter.size === 0 ||
        (d.issue.fields.status?.name ? defectStatusFilter.has(d.issue.fields.status.name) : false);
      const priorityMatch =
        defectPriorityFilter.size === 0 ||
        (d.issue.fields.priority?.name
          ? defectPriorityFilter.has(d.issue.fields.priority.name)
          : false);
      const severityVal =
        d.issue.fields.customfield_13415?.value ?? d.issue.fields.customfield_13415?.name ?? null;
      const severityMatch =
        defectSeverityFilter.size === 0 ||
        (severityVal ? defectSeverityFilter.has(severityVal) : false);
      const assigneeMatch =
        defectAssigneeFilter.size === 0 ||
        (d.issue.fields.assignee?.displayName
          ? defectAssigneeFilter.has(d.issue.fields.assignee.displayName)
          : false);

      return statusMatch && priorityMatch && severityMatch && assigneeMatch;
    });
  }, [
    resolvedDefects,
    anyFilterActive,
    defectStatusFilter,
    defectPriorityFilter,
    defectSeverityFilter,
    defectAssigneeFilter,
  ]);

  // Sort pipeline — stable sort; missing/loading values always sort to the bottom
  const sortedDefects = useMemo(() => {
    if (defectSortKey === null) return filteredDefects;

    return [...filteredDefects].sort((a, b) => {
      const dir = defectSortDir === 'asc' ? 1 : -1;

      const getVal = (d: typeof a): string | number | null => {
        if (d.isLoading || !d.issue) return null;
        switch (defectSortKey) {
          case 'key':
            return d.issue.key ?? d.defectKey;
          case 'status':
            return d.issue.fields.status?.name ?? null;
          case 'priority': {
            const name = d.issue.fields.priority?.name ?? null;
            return name !== null ? (PRIORITY_RANK[name] ?? Number.POSITIVE_INFINITY) : null;
          }
          case 'severity':
            return (
              d.issue.fields.customfield_13415?.value ??
              d.issue.fields.customfield_13415?.name ??
              null
            );
          case 'assignee':
            return d.issue.fields.assignee?.displayName ?? null;
          default:
            return null;
        }
      };

      const aVal = getVal(a);
      const bVal = getVal(b);

      // Missing values always go to bottom regardless of sort direction
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [filteredDefects, defectSortKey, defectSortDir]);

  // Sort header cycling
  const handleSortHeader = (key: Exclude<DefectSortKey, null>) => {
    if (defectSortKey !== key) {
      setDefectSortKey(key);
      setDefectSortDir('asc');
    } else if (defectSortDir === 'asc') {
      setDefectSortDir('desc');
    } else {
      setDefectSortKey(null);
      setDefectSortDir('asc');
    }
  };

  // Active filter chips: [{dimension, value}]
  const activeChips = useMemo(() => {
    const chips: { dimension: string; value: string; remove: () => void }[] = [];
    for (const v of defectStatusFilter) {
      chips.push({
        dimension: 'Status',
        value: v,
        remove: () =>
          setDefectStatusFilter((prev) => {
            const n = new Set(prev);
            n.delete(v);
            return n;
          }),
      });
    }
    for (const v of defectPriorityFilter) {
      chips.push({
        dimension: 'Priority',
        value: v,
        remove: () =>
          setDefectPriorityFilter((prev) => {
            const n = new Set(prev);
            n.delete(v);
            return n;
          }),
      });
    }
    for (const v of defectSeverityFilter) {
      chips.push({
        dimension: 'Severity',
        value: v,
        remove: () =>
          setDefectSeverityFilter((prev) => {
            const n = new Set(prev);
            n.delete(v);
            return n;
          }),
      });
    }
    for (const v of defectAssigneeFilter) {
      chips.push({
        dimension: 'Assignee',
        value: v,
        remove: () =>
          setDefectAssigneeFilter((prev) => {
            const n = new Set(prev);
            n.delete(v);
            return n;
          }),
      });
    }
    return chips;
  }, [defectStatusFilter, defectPriorityFilter, defectSeverityFilter, defectAssigneeFilter]);

  const clearAllFilters = () => {
    setDefectStatusFilter(new Set());
    setDefectPriorityFilter(new Set());
    setDefectSeverityFilter(new Set());
    setDefectAssigneeFilter(new Set());
  };

  const cycleName = cycleQuery.data?.name ?? cycleKey ?? '';

  const openRun = (run: AioTestRun) => {
    useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
    navigate(`/aio-cycle/${projectKey}/${cycleKey}/run/${run.id}`);
  };

  const openDefect = (resolvedKey: string) => {
    useBreadcrumbStore.getState().push({ label: cycleName, path: location.pathname });
    navigate(`/issue/${resolvedKey}`);
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
                    <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />
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
                    <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />
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
                          return Number.isNaN(d.getTime())
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
              <>
                {/* Filter toolbar */}
                <div
                  role="toolbar"
                  aria-label="Defects filters"
                  className="flex items-center gap-2 px-3 py-2 border-b flex-wrap"
                >
                  <FilterPopover
                    dimension="Status"
                    testId="defects-filter-status"
                    options={statusOptions}
                    selected={defectStatusFilter}
                    setSelected={setDefectStatusFilter}
                  />
                  <FilterPopover
                    dimension="Priority"
                    testId="defects-filter-priority"
                    options={priorityOptions}
                    selected={defectPriorityFilter}
                    setSelected={setDefectPriorityFilter}
                  />
                  <FilterPopover
                    dimension="Severity"
                    testId="defects-filter-severity"
                    options={severityOptions}
                    selected={defectSeverityFilter}
                    setSelected={setDefectSeverityFilter}
                  />
                  <FilterPopover
                    dimension="Assignee"
                    testId="defects-filter-assignee"
                    options={assigneeOptions}
                    selected={defectAssigneeFilter}
                    setSelected={setDefectAssigneeFilter}
                  />

                  {/* Active filter chips */}
                  {activeChips.map((chip) => (
                    <span
                      key={`${chip.dimension}-${chip.value}`}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      {chip.dimension}: {chip.value}
                      <button
                        type="button"
                        className="hover:text-primary/60 shrink-0"
                        data-testid={`defects-filter-chip-${chip.dimension.toLowerCase()}-${chip.value}`}
                        onClick={chip.remove}
                        aria-label={`Remove filter ${chip.dimension}: ${chip.value}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {anyFilterActive && (
                    <button
                      type="button"
                      data-testid="defects-filter-clear-all"
                      className="text-xs text-muted-foreground hover:text-foreground ml-1"
                      onClick={clearAllFilters}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* No matches message when filter is active and nothing matches */}
                {sortedDefects.length === 0 && anyFilterActive ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    No defects match the selected filters.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/10">
                      <tr>
                        <SortableHeader
                          sortKey="key"
                          label="Key"
                          className="w-36"
                          activeSortKey={defectSortKey}
                          activeSortDir={defectSortDir}
                          onSort={handleSortHeader}
                        />
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Title
                        </th>
                        <SortableHeader
                          sortKey="status"
                          label="Status"
                          className="w-32"
                          activeSortKey={defectSortKey}
                          activeSortDir={defectSortDir}
                          onSort={handleSortHeader}
                        />
                        <SortableHeader
                          sortKey="assignee"
                          label="Assignee"
                          className="w-32"
                          activeSortKey={defectSortKey}
                          activeSortDir={defectSortDir}
                          onSort={handleSortHeader}
                        />
                        <th className="w-36 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Reporter
                        </th>
                        <SortableHeader
                          sortKey="priority"
                          label="Priority"
                          className="w-24"
                          activeSortKey={defectSortKey}
                          activeSortDir={defectSortDir}
                          onSort={handleSortHeader}
                        />
                        <SortableHeader
                          sortKey="severity"
                          label="Severity"
                          className="w-24"
                          activeSortKey={defectSortKey}
                          activeSortDir={defectSortDir}
                          onSort={handleSortHeader}
                        />
                        <th className="w-48 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                          Triggered By
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedDefects.map(
                        ({ defectKey, triggeredBy, issue, isLoading: defectLoading }) => (
                          <DefectRow
                            key={defectKey}
                            defectIdOrKey={defectKey}
                            issue={issue}
                            isLoading={defectLoading}
                            triggeredBy={triggeredBy}
                            onOpen={openDefect}
                          />
                        ),
                      )}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
