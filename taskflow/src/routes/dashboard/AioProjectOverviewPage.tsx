import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAioCredentials } from '@/hooks/useAioCredentials';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { aggregateCycleScope, aggregateFolderCounts, type CycleFilter } from '@/lib/aio-cycle-list';
import { initializeAioStatusMap } from '@/lib/aioUtils';
import { toLocalDateString } from '@/lib/local-date';
import {
  fetchAioCycleSummaries,
  fetchAioCyclesWithDetail,
  fetchAioFolderCycleCounts,
  fetchAioFolderTree,
  fetchAioProjectConfig,
  fetchAioUngroupedCycles,
} from '@/services/aio';
import type { AioCycleSummaryItem, AioFolder } from '@/services/aio/types';
import { fetchJiraProjectNumericId } from '@/services/jira/projects';
import { useAioCyclesSelectionStore } from '@/stores/aio-cycles-selection.store';
import { useAuthStore } from '@/stores/auth.store';
import { AioCycleList } from './AioCycleList';
import { AioCyclesDashboard } from './AioCyclesDashboard';
import { AioCyclesScopeBar } from './AioCyclesScopeBar';
import { AioFolderPanel, ALL_CYCLES_ID, UNGROUPED_ID } from './AioFolderPanel';

// ─── helpers ─────────────────────────────────────────────────────────────────

function searchSubtree(nodes: AioFolder[], targetID: number): boolean {
  for (const node of nodes) {
    if (node.ID === targetID) return true;
    if (searchSubtree(node.children, targetID)) return true;
  }
  return false;
}

function collectAllFolderIDs(tree: AioFolder[]): number[] {
  return tree.flatMap((n) => [n.ID, ...collectAllFolderIDs(n.children)]);
}

function collectSubtreeIDs(tree: AioFolder[], rootID: number): number[] {
  for (const node of tree) {
    if (node.ID === rootID) {
      const ids: number[] = [node.ID];
      const collect = (nodes: AioFolder[]) => {
        for (const n of nodes) {
          ids.push(n.ID);
          collect(n.children);
        }
      };
      collect(node.children);
      return ids;
    }
    const found = collectSubtreeIDs(node.children, rootID);
    if (found.length > 0) return found;
  }
  return [rootID];
}

function findAncestorPath(tree: AioFolder[], targetID: number): number[] {
  for (const node of tree) {
    if (node.ID === targetID) return [];
    if (searchSubtree(node.children, targetID)) {
      return [node.ID, ...findAncestorPath(node.children, targetID)];
    }
  }
  return [];
}

/** Folder name path "A / B / C" for the selected folder; null when not found. */
function folderPathNames(tree: AioFolder[], targetID: number): string[] | null {
  for (const node of tree) {
    if (node.ID === targetID) return [node.name];
    const sub = folderPathNames(node.children, targetID);
    if (sub) return [node.name, ...sub];
  }
  return null;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AioProjectOverviewPage() {
  const { projectKey } = useParams<{ projectKey: string }>();
  const { jiraBaseUrl } = useAuthStore();
  const { token, isLoading: tokenLoading } = useAioCredentials();
  const queryClient = useQueryClient();

  const getSelectedFolder = useAioCyclesSelectionStore((s) => s.getSelectedFolder);
  const setSelectedFolder = useAioCyclesSelectionStore((s) => s.setSelectedFolder);
  const clearSelectedFolder = useAioCyclesSelectionStore((s) => s.clearSelectedFolder);
  const statusFilter = useAioCyclesSelectionStore((s) => s.statusFilter);
  const setStatusFilter = useAioCyclesSelectionStore((s) => s.setStatusFilter);

  // The right pane scrolls as one; the list's virtualizer uses it as its scroll element.
  // State (callback ref), not useRef: a parent's ref attaches after the child's layout
  // effects, so the list must re-render once the element exists.
  const [paneEl, setPaneEl] = useState<HTMLDivElement | null>(null);
  // Cross-filter from the dashboard tiles/charts. Ephemeral: resets on folder/project change.
  const [cycleFilter, setCycleFilter] = useState<CycleFilter | null>(null);
  const today = toLocalDateString(new Date());

  // null = pre-hydration only; 0 = All cycles; -1 = Ungrouped; otherwise a folder ID.
  const [selectedFolderID, setSelectedFolderID] = useState<number | null>(null);
  const [expandedIDs, setExpandedIDs] = useState<Set<number>>(new Set());

  const credGate = !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey;

  // Resolve numeric Jira project ID (required by AIO folder/count/paged endpoints).
  // Uses GET /rest/api/2/project/{key} — the Jira numeric id, not the AIO-internal ID.
  const jiraProjectIdQuery = useQuery({
    queryKey: ['jira', jiraBaseUrl, 'project-numeric-id', projectKey],
    queryFn: () => fetchJiraProjectNumericId(jiraBaseUrl ?? '', token ?? '', projectKey ?? ''),
    enabled: credGate,
    staleTime: 60 * 60 * 1000,
  });

  const jiraProjectId = jiraProjectIdQuery.data ?? null;

  const aioGate = credGate && !!jiraProjectId;

  // Project config — testRunStatus entries for dynamic status ID → canonical key mapping.
  const configQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'project-config', projectKey],
    queryFn: () => fetchAioProjectConfig(jiraBaseUrl ?? '', token ?? '', jiraProjectId ?? 0),
    enabled: aioGate,
    staleTime: 60 * 60 * 1000,
  });

  // Populate the module-level runtime AIO status map used by AioCycleDetailPage
  // (CLEAN-07). React Query caches the /config response so initializeAioStatusMap
  // re-uses the cached result — no duplicate HTTP call.
  useEffect(() => {
    if (configQuery.data && jiraBaseUrl && token && jiraProjectId) {
      void initializeAioStatusMap(jiraBaseUrl, token, jiraProjectId);
    }
  }, [configQuery.data, jiraBaseUrl, token, jiraProjectId]);

  // Folder tree + count map (parallel)
  const foldersQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'folders', projectKey],
    queryFn: () => fetchAioFolderTree(jiraBaseUrl ?? '', token ?? '', jiraProjectId ?? 0),
    enabled: aioGate,
  });

  const countMapQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'cycle-count', projectKey],
    queryFn: () => fetchAioFolderCycleCounts(jiraBaseUrl ?? '', token ?? '', jiraProjectId ?? 0),
    enabled: aioGate,
  });

  // Folder IDs to pass as server-side filter: [] = all cycles, [-1] = ungrouped,
  // otherwise the selected folder + all its descendants.
  const activeFolderIds = useMemo(() => {
    if (selectedFolderID === null || selectedFolderID === ALL_CYCLES_ID) return [];
    if (selectedFolderID === UNGROUPED_ID) return [];
    return collectSubtreeIDs(foldersQuery.data ?? [], selectedFolderID);
  }, [selectedFolderID, foldersQuery.data]);

  // Cycle list — re-fetches whenever the selected folder changes.
  const cyclesWithDetailQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'cycles-detail', projectKey, selectedFolderID],
    queryFn: () =>
      selectedFolderID === UNGROUPED_ID
        ? fetchAioUngroupedCycles(
            jiraBaseUrl ?? '',
            token ?? '',
            jiraProjectId ?? 0,
            collectAllFolderIDs(foldersQuery.data ?? []),
          )
        : fetchAioCyclesWithDetail(
            jiraBaseUrl ?? '',
            token ?? '',
            jiraProjectId ?? 0,
            activeFolderIds,
          ),
    // Ungrouped is computed against the full folder tree, so it waits for it.
    enabled:
      aioGate &&
      selectedFolderID !== null &&
      (selectedFolderID !== UNGROUPED_ID || foldersQuery.isSuccess),
  });

  // Summaries — fired when we have cycle IDs
  const allIDs = cyclesWithDetailQuery.data?.allIDs ?? [];
  const cycleSummariesQuery = useQuery({
    queryKey: ['aio', jiraBaseUrl, 'cycle-summaries', projectKey, allIDs.join(',')],
    queryFn: () =>
      fetchAioCycleSummaries(jiraBaseUrl ?? '', token ?? '', jiraProjectId ?? 0, allIDs),
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

  // Stable references so the scope memo below only reruns when the data really changes.
  const cycleItems = useMemo(
    () => cyclesWithDetailQuery.data?.items ?? [],
    [cyclesWithDetailQuery.data],
  );
  const statusConfig = useMemo(() => configQuery.data ?? [], [configQuery.data]);

  // One pass over every cycle in the folder scope feeds the KPI tiles, charts and list filter.
  const scope = useMemo(
    () => aggregateCycleScope(cycleItems, summaryByID, statusConfig, today, statusFilter),
    [cycleItems, summaryByID, statusConfig, today, statusFilter],
  );

  // Auto-select the persisted folder (or All cycles) once per projectKey.
  const autoExpandedRef = useRef(false);

  // Reset one-shot guard whenever projectKey changes so navigation to a new project re-runs the effect
  // biome-ignore lint/correctness/useExhaustiveDependencies: projectKey is the intentional trigger dep; the effect body only mutates a ref (correct pattern)
  useEffect(() => {
    autoExpandedRef.current = false;
    setCycleFilter(null);
  }, [projectKey]);

  useEffect(() => {
    if (!autoExpandedRef.current && foldersQuery.data && countMapQuery.data) {
      autoExpandedRef.current = true;

      const stored = projectKey ? getSelectedFolder(projectKey) : null;
      let isStoredValid = false;
      if (stored === ALL_CYCLES_ID) {
        isStoredValid = true;
      } else if (stored === UNGROUPED_ID) {
        isStoredValid = (countMapQuery.data['-1'] ?? 0) > 0;
      } else if (stored !== null && stored > 0) {
        isStoredValid = searchSubtree(foldersQuery.data, stored);
      }

      const folderToSelect = isStoredValid && stored !== null ? stored : ALL_CYCLES_ID;
      if (!isStoredValid && stored !== null && projectKey) {
        clearSelectedFolder(projectKey);
      }

      setSelectedFolderID(folderToSelect);
      if (folderToSelect > 0) {
        // Expand ancestors so the selected folder is visible, plus the folder itself.
        const ancestorPath = findAncestorPath(foldersQuery.data, folderToSelect);
        setExpandedIDs(new Set([...ancestorPath, folderToSelect]));
      } else if (foldersQuery.data.length > 0) {
        // All cycles / Ungrouped: expand the first root for context.
        setExpandedIDs(new Set([foldersQuery.data[0].ID]));
      }
    }
  }, [foldersQuery.data, countMapQuery.data, projectKey, getSelectedFolder, clearSelectedFolder]);

  const showFolderSkeleton = useDelayedLoading(
    foldersQuery.isLoading || jiraProjectIdQuery.isLoading,
  );
  // isPending (no data yet) rather than isLoading: a disabled query (credentials or
  // project id still resolving) is not "loading" but must not read as an empty folder.
  const cyclesPending =
    selectedFolderID === null ||
    (cyclesWithDetailQuery.isPending && !cyclesWithDetailQuery.isError);
  const showCycleSkeleton = useDelayedLoading(cyclesPending);

  const toggleFolder = (id: number) => {
    setExpandedIDs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selecting a folder expands it but never collapses it.
  const selectFolder = (id: number) => {
    setSelectedFolderID(id);
    setCycleFilter(null);
    if (paneEl) paneEl.scrollTop = 0;
    if (projectKey) setSelectedFolder(projectKey, id);
    if (id > 0) {
      setExpandedIDs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    }
  };

  const countMap = countMapQuery.data ?? {};
  const folderTree = foldersQuery.data ?? [];
  const { agg, total } = useMemo(
    () => aggregateFolderCounts(foldersQuery.data ?? [], countMapQuery.data ?? {}),
    [foldersQuery.data, countMapQuery.data],
  );

  const folderPath =
    selectedFolderID !== null && selectedFolderID > 0
      ? folderPathNames(folderTree, selectedFolderID)
      : null;
  const folderLabel =
    selectedFolderID === ALL_CYCLES_ID
      ? 'All cycles'
      : selectedFolderID === UNGROUPED_ID
        ? 'Ungrouped'
        : (folderPath?.[folderPath.length - 1] ?? '');
  const folderTitle = folderPath ? folderPath.join(' / ') : folderLabel;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-baseline gap-3 border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Test cycles</h1>
        <span className="font-mono text-sm text-muted-foreground">{projectKey ?? ''}</span>
      </div>

      <div className="flex flex-1 flex-row overflow-hidden">
        <AioFolderPanel
          tree={folderTree}
          agg={agg}
          total={total}
          ungroupedCount={countMap['-1'] ?? 0}
          expandedIDs={expandedIDs}
          selectedFolderID={selectedFolderID}
          onToggle={toggleFolder}
          onSelect={selectFolder}
          isLoading={showFolderSkeleton}
          error={foldersQuery.isError ? foldersQuery.error : null}
          onRetry={() =>
            queryClient.invalidateQueries({
              queryKey: ['aio', jiraBaseUrl, 'folders', projectKey],
            })
          }
        />
        <div ref={setPaneEl} className="@container relative min-w-0 flex-1 overflow-y-auto">
          {/* ResizeObserver target of the list's virtualizer: tracks the dashboard's height. */}
          <div className="space-y-6 px-6 py-5">
            <AioCyclesScopeBar
              folderLabel={folderLabel}
              folderTitle={folderTitle}
              openCount={scope.openCount}
              closedCount={scope.closedCount}
              loading={cyclesPending}
            />
            {!cyclesWithDetailQuery.isError && (
              <AioCyclesDashboard
                scope={scope}
                filter={cycleFilter}
                onFilter={setCycleFilter}
                loading={showCycleSkeleton || cyclesPending}
                summariesLoading={cycleSummariesQuery.isLoading}
                statusFilter={statusFilter}
                onShowOpen={() => {
                  setStatusFilter('open');
                  setCycleFilter(null);
                }}
                token={token}
                jiraBaseUrl={jiraBaseUrl ?? undefined}
              />
            )}
            {/* Section divider (the list's own sub-dividers are lighter). */}
            <div className="border-t border-border pt-2">
              <AioCycleList
                projectKey={projectKey}
                items={cycleItems}
                isLoading={showCycleSkeleton}
                isPending={cyclesPending}
                error={cyclesWithDetailQuery.isError ? cyclesWithDetailQuery.error : null}
                onRetry={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['aio', jiraBaseUrl, 'cycles-detail', projectKey, selectedFolderID],
                  })
                }
                summaryByID={summaryByID}
                summariesLoading={cycleSummariesQuery.isLoading}
                statusConfig={statusConfig}
                token={token}
                jiraBaseUrl={jiraBaseUrl ?? undefined}
                scrollElement={paneEl}
                filter={cycleFilter}
                onClearFilter={() => setCycleFilter(null)}
                today={today}
                progressByID={scope.progressByID}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
