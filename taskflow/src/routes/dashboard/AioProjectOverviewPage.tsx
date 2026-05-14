import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, FlaskConical } from 'lucide-react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { normalizeStatusById } from '@/lib/aioUtils';
import type { AioCycleDetailItem, AioCycleSummaryItem, AioFolder } from '@/services/aio/types';
import {
  fetchAioCycleSummaries,
  fetchAioCyclesWithDetail,
  fetchAioFolderCycleCounts,
  fetchAioFolderTree,
} from '@/services/aio';
import { fetchJiraProjectNumericId } from '@/services/jira/projects';
import { fetchJiraUserByUsername } from '@/services/jira/users';
import { useAuthStore } from '@/stores/auth.store';

// ─── helpers ─────────────────────────────────────────────────────────────────

function isDescendant(tree: AioFolder[], ancestorID: number, candidateID: number): boolean {
  for (const node of tree) {
    if (node.ID === ancestorID) {
      return searchSubtree(node.children, candidateID);
    }
    if (isDescendant(node.children, ancestorID, candidateID)) return true;
  }
  return false;
}

function searchSubtree(nodes: AioFolder[], targetID: number): boolean {
  for (const node of nodes) {
    if (node.ID === targetID) return true;
    if (searchSubtree(node.children, targetID)) return true;
  }
  return false;
}

function findFirstNonEmptyFolder(
  tree: AioFolder[],
  countMap: Record<string, number>,
): number | null {
  for (const node of tree) {
    if ((countMap[String(node.ID)] ?? 0) > 0) return node.ID;
    const found = findFirstNonEmptyFolder(node.children, countMap);
    if (found !== null) return found;
  }
  return null;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function FolderNode({
  node,
  depth,
  countMap,
  expandedIDs,
  selectedFolderID,
  onToggle,
  onSelect,
}: {
  node: AioFolder;
  depth: number;
  countMap: Record<string, number>;
  expandedIDs: Set<number>;
  selectedFolderID: number | null;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIDs.has(node.ID);
  const isSelected = selectedFolderID === node.ID;
  const count = countMap[String(node.ID)] ?? 0;
  const paddingLeft = 12 + depth * 16;

  return (
    <>
      <button
        type="button"
        data-testid={`folder-node-${node.ID}`}
        className={`w-full flex items-center gap-1 py-2 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-muted/30'
        }`}
        style={{ paddingLeft }}
        onClick={() => {
          if (hasChildren) onToggle(node.ID);
          onSelect(node.ID);
        }}
      >
        {hasChildren ? (
          <ChevronRight
            className={`size-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {count > 0 && (
          <Badge variant="secondary" className="ml-1 shrink-0">
            {count}
          </Badge>
        )}
      </button>
      {isExpanded &&
        node.children.map((child) => (
          <FolderNode
            key={child.ID}
            node={child}
            depth={depth + 1}
            countMap={countMap}
            expandedIDs={expandedIDs}
            selectedFolderID={selectedFolderID}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

function OwnerCell({
  ownedByID,
  token,
  jiraBaseUrl,
}: {
  ownedByID: string;
  token: string | null;
  jiraBaseUrl: string | undefined;
}) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['jira', jiraBaseUrl, 'user-by-username', ownedByID],
    queryFn: () => fetchJiraUserByUsername(jiraBaseUrl!, token!, ownedByID),
    enabled: !!jiraBaseUrl && !!token && !!ownedByID,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div data-testid="owner-cell">
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  return (
    <div data-testid="owner-cell">
      {user ? user.displayName : ownedByID}
    </div>
  );
}

function ProgressBarCell({
  summary,
  isLoading,
}: {
  summary: AioCycleSummaryItem['summary'] | undefined;
  isLoading?: boolean;
}) {
  if (isLoading && !summary) {
    return (
      <div data-testid="progress-bar">
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    );
  }

  if (!summary) {
    return <div data-testid="progress-bar">—</div>;
  }

  const counts = { pass: 0, fail: 0, blocked: 0, notRun: 0, inProgress: 0 };
  for (const [idStr, count] of Object.entries(summary.testRunDistribution)) {
    const status = normalizeStatusById(Number(idStr));
    counts[status] += count;
  }

  const total = summary.totalTests;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const legendParts: string[] = [];
  if (counts.pass > 0) legendParts.push(`${counts.pass}P`);
  if (counts.fail > 0) legendParts.push(`${counts.fail}F`);
  if (counts.blocked > 0) legendParts.push(`${counts.blocked}B`);
  if (counts.inProgress > 0) legendParts.push(`${counts.inProgress}IP`);
  if (counts.notRun > 0) legendParts.push(`${counts.notRun}N`);

  return (
    <div data-testid="progress-bar">
      <div className="h-1.5 rounded-full overflow-hidden flex">
        {counts.pass > 0 && (
          <div className="bg-green-500 h-full" style={{ width: `${pct(counts.pass)}%` }} />
        )}
        {counts.fail > 0 && (
          <div className="bg-red-500 h-full" style={{ width: `${pct(counts.fail)}%` }} />
        )}
        {counts.blocked > 0 && (
          <div className="bg-orange-400 h-full" style={{ width: `${pct(counts.blocked)}%` }} />
        )}
        {counts.inProgress > 0 && (
          <div className="bg-blue-400 h-full" style={{ width: `${pct(counts.inProgress)}%` }} />
        )}
        {counts.notRun > 0 && (
          <div className="bg-muted h-full" style={{ width: `${pct(counts.notRun)}%` }} />
        )}
      </div>
      {legendParts.length > 0 && (
        <p className="text-xs text-muted-foreground mt-0.5">{legendParts.join(' ')}</p>
      )}
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AioProjectOverviewPage() {
  const { projectKey } = useParams<{ projectKey: string }>();
  const { jiraBaseUrl } = useAuthStore();
  const { token, isLoading: tokenLoading } = useAioCredentials();
  const queryClient = useQueryClient();

  const [selectedFolderID, setSelectedFolderID] = useState<number | null>(null);
  const [expandedIDs, setExpandedIDs] = useState<Set<number>>(new Set());
  const [showClosed, setShowClosed] = useState<boolean>(false);

  const credGate = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey;

  // Resolve numeric Jira project ID (required by AIO folder/count/paged endpoints).
  // Uses GET /rest/api/2/project/{key} — the Jira numeric id, not the AIO-internal ID.
  const jiraProjectIdQuery = useQuery({
    queryKey: ['jira', jiraBaseUrl, 'project-numeric-id', projectKey],
    queryFn: () => fetchJiraProjectNumericId(jiraBaseUrl!, token!, projectKey!),
    enabled: credGate,
    staleTime: 60 * 60 * 1000,
  });

  const jiraProjectId = jiraProjectIdQuery.data ?? null;

  const aioGate = credGate && !!jiraProjectId;

  // Folder tree + count map (parallel)
  const foldersQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'folders', projectKey],
    queryFn: () => fetchAioFolderTree(jiraBaseUrl!, token!, jiraProjectId!),
    enabled: aioGate,
  });

  const countMapQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'cycle-count', projectKey],
    queryFn: () => fetchAioFolderCycleCounts(jiraBaseUrl!, token!, jiraProjectId!),
    enabled: aioGate,
  });

  // Cycle list — loads all cycles for the project.
  // Live UAT confirmed: ?folderID= query param causes 500; real AIO UI loads all cycles at once.
  const cyclesWithDetailQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'cycles-detail', projectKey],
    queryFn: () => fetchAioCyclesWithDetail(jiraBaseUrl!, token!, jiraProjectId!),
    enabled: aioGate,
  });

  // Summaries — fired when we have cycle IDs
  const allIDs = cyclesWithDetailQuery.data?.allIDs ?? [];
  const cycleSummariesQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, allIDs.join(',')],
    queryFn: () => fetchAioCycleSummaries(jiraBaseUrl!, token!, jiraProjectId!, allIDs),
    enabled: aioGate && allIDs.length > 0,
  });

  // Summary lookup map by cycle ID
  const summaryByID = useMemo(
    () =>
      Object.fromEntries((cycleSummariesQuery.data ?? []).map((s) => [s.ID, s])) as Record<
        number,
        AioCycleSummaryItem
      >,
    [cycleSummariesQuery.data],
  );

  // Visible cycles (filter by showClosed)
  const visibleCycles = useMemo(() => {
    const items = cyclesWithDetailQuery.data?.items ?? [];
    return items.filter((c) => showClosed || !c.detail.isClosed);
  }, [cyclesWithDetailQuery.data, showClosed]);

  // Auto-expand first root folder + auto-select first non-empty folder (one-time)
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (
      !autoExpandedRef.current &&
      foldersQuery.data &&
      foldersQuery.data.length > 0 &&
      countMapQuery.data
    ) {
      autoExpandedRef.current = true;
      // Expand first root folder
      setExpandedIDs(new Set([foldersQuery.data[0].ID]));
      // Auto-select first folder with non-zero count
      const firstWithCycles = findFirstNonEmptyFolder(foldersQuery.data, countMapQuery.data);
      if (firstWithCycles !== null) setSelectedFolderID(firstWithCycles);
    }
  }, [foldersQuery.data, countMapQuery.data]);

  const showFolderSkeleton = useDelayedLoading(foldersQuery.isLoading || jiraProjectIdQuery.isLoading);
  const showCycleSkeleton = useDelayedLoading(cyclesWithDetailQuery.isLoading);

  const toggleFolder = (id: number) => {
    setExpandedIDs((prev) => {
      const next = new Set(prev);
      const isCollapsing = next.has(id);
      if (isCollapsing) {
        next.delete(id);
        // If the selected folder is a descendant of the collapsed folder, clear selection
        if (
          selectedFolderID !== null &&
          selectedFolderID !== id &&
          foldersQuery.data &&
          isDescendant(foldersQuery.data, id, selectedFolderID)
        ) {
          setSelectedFolderID(null);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectFolder = (id: number) => setSelectedFolderID(id);

  const countMap = countMapQuery.data ?? {};
  const folderTree = foldersQuery.data ?? [];
  const ungroupedCount = countMap['-1'] ?? 0;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-xl font-semibold">Cycles — {projectKey ?? ''}</h1>
        <div className="flex items-center gap-2">
          <Switch id="show-closed" checked={showClosed} onCheckedChange={setShowClosed} />
          <label htmlFor="show-closed" className="text-sm">
            Show closed
          </label>
        </div>
      </div>

      {/* Content: two-panel layout */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Left panel — folder tree */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-muted/10">
          {showFolderSkeleton ? (
            <div className="p-2 space-y-1">
              {[40, 36, 32, 28, 40, 36].map((w, i) => (
                <Skeleton key={i} className="h-6" style={{ width: w * 4 }} />
              ))}
            </div>
          ) : foldersQuery.isError ? (
            <div className="p-4">
              <ErrorState
                error={foldersQuery.error}
                onRetry={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['aio', jiraBaseUrl, 'folders', projectKey],
                  })
                }
                viewName="folders"
              />
            </div>
          ) : (
            <div>
              {folderTree.map((node) => (
                <FolderNode
                  key={node.ID}
                  node={node}
                  depth={0}
                  countMap={countMap}
                  expandedIDs={expandedIDs}
                  selectedFolderID={selectedFolderID}
                  onToggle={toggleFolder}
                  onSelect={selectFolder}
                />
              ))}
              {/* Ungrouped entry at bottom */}
              {ungroupedCount > 0 && (
                <button
                  type="button"
                  data-testid="folder-node-ungrouped"
                  className={`w-full flex items-center gap-1 px-3 py-2 text-left text-sm transition-colors ${
                    selectedFolderID === -1
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/30'
                  }`}
                  onClick={() => selectFolder(-1)}
                >
                  <span className="size-4 shrink-0" />
                  <span className="flex-1">Ungrouped</span>
                  <Badge variant="secondary" className="ml-1 shrink-0">
                    {ungroupedCount}
                  </Badge>
                </button>
              )}
            </div>
          )}
        </aside>

        {/* Right panel — cycle list */}
        <div className="flex-1 overflow-auto">
          {selectedFolderID === null ? (
            <EmptyState
              icon={FlaskConical}
              title="Select a folder"
              subtitle="Choose a folder from the left to view its cycles."
            />
          ) : showCycleSkeleton ? (
            <div className="p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 border-b border-border py-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-1.5 w-32 rounded-full" />
                </div>
              ))}
            </div>
          ) : cyclesWithDetailQuery.isError ? (
            <div className="p-4">
              <ErrorState
                error={cyclesWithDetailQuery.error}
                onRetry={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['aio', jiraBaseUrl, 'cycles-detail', projectKey],
                  })
                }
                viewName="cycles"
              />
            </div>
          ) : visibleCycles.length === 0 && !cyclesWithDetailQuery.isLoading ? (
            <EmptyState
              icon={FlaskConical}
              title="No cycles in this folder"
              subtitle="This folder has no test cycles yet."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/10">
                <tr>
                  <th className="w-28 px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="w-32 px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Owner
                  </th>
                  <th className="w-20 px-3 py-3 text-right text-xs font-medium text-muted-foreground">
                    Total tests
                  </th>
                  <th className="w-44 px-3 py-3 text-left text-xs font-medium text-muted-foreground">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleCycles.map((cycle: AioCycleDetailItem) => {
                  const isClosed = cycle.detail.isClosed && showClosed;
                  const summary = summaryByID[cycle.ID]?.summary;
                  return (
                    <tr
                      key={cycle.ID}
                      data-testid={`cycle-row-${cycle.ID}`}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td
                        className={`w-28 px-3 py-3 text-xs font-mono ${isClosed ? 'text-muted-foreground' : 'text-muted-foreground'}`}
                      >
                        {cycle.detail.key}
                      </td>
                      <td className={`px-4 py-3 ${isClosed ? 'text-muted-foreground' : ''}`}>
                        <NavLink
                          to={`/aio-cycle/${projectKey}/${cycle.detail.key}`}
                          className="hover:underline"
                        >
                          {cycle.detail.title}
                        </NavLink>
                        {cycle.detail.isClosed && showClosed && (
                          <Badge variant="secondary" className="ml-2">
                            Closed
                          </Badge>
                        )}
                      </td>
                      <td className="w-32 px-3 py-3">
                        <OwnerCell
                          ownedByID={cycle.detail.ownedByID}
                          token={token}
                          jiraBaseUrl={jiraBaseUrl ?? undefined}
                        />
                      </td>
                      <td className="w-20 px-3 py-3 text-right text-xs text-muted-foreground">
                        {summary?.totalTests ?? '—'}
                      </td>
                      <td className="w-44 px-3 py-3">
                        <ProgressBarCell
                          summary={summary}
                          isLoading={cycleSummariesQuery.isLoading}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
