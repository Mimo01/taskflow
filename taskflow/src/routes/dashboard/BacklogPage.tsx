/**
 * BacklogPage — Jira-style backlog view with sprint sections.
 *
 * Renders:
 *   1. Active sprint section (if any) — collapsible, with sprint name, badge, issue count
 *   2. Future sprint sections — one per sprint, ordered by data.sprints[]
 *   3. Backlog section — issues with no sprint assignment, always at bottom
 *
 * Each section uses BacklogRow for individual issue rows.
 * UnifiedFilterBar applies filters across ALL sections combined.
 * Right-click on any row opens a context menu to move the issue to a sprint.
 * Create story entry point via Outlet context remains unchanged.
 *
 * Architecture (Phase 74 — D-01/D-02/D-04b/D-06/D-09b): SINGLE
 * `useGhBacklogData(boardId)` call replaces the three legacy per-section
 * REST queries (sprint list + sprint stories + unassigned issues).
 * Raw `GhBacklogResponse` is adapted at the call site via a useMemo chain:
 * `buildEntityMaps → createAdapter → adapt → issueIdToSprintId reverse index
 * → adaptedIssues → backlogIssuesAdapted + sprintSections`. Sprint
 * membership is derived from `data.sprints[].issuesIds[]` (D-04b reverse
 * index), not from per-issue `sprint` fields on `GhIssue`. Sprint state
 * is uppercase per fixture (`ACTIVE` / `CLOSED` / `FUTURE` — RESEARCH A5).
 *
 * Per D-05a/b/c the label filter chip, subtask count chip, and flagged
 * indicator surfaces are removed from the backlog. Per D-07a the
 * per-section refetch callbacks are removed; the Plan 05 toolbar Reload
 * action will own all manual refreshes.
 */

import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, Inbox, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UnifiedFilterBar } from '@/components/UnifiedFilterBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmSprintMoveDialog } from '@/components/ui/confirm-sprint-move-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useBoardId } from '@/hooks/useBoardId';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useListNavigation } from '@/hooks/useListNavigation';
import type { JiraIssue } from '@/services/jira';
import {
  addIssuesToSprint,
  buildEntityMaps,
  createAdapter,
  fetchEpicsBasic,
  fetchProjectStatuses,
  invalidateGhBacklogData,
  isIssueFlagged,
  moveIssuesToBacklog,
  rankIssueApi,
  resolveEpic,
  setIssueFlagged,
  useGhBacklogData,
} from '@/services/jira';
import type { GhBacklogResponse } from '@/services/jira/greenhopper/types';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useFilterStore } from '@/stores/filter.store';
import { useSettingsStore } from '@/stores/settings.store';
import { BacklogRow } from './BacklogRow';
import { BacklogSkeleton } from './BacklogSkeleton';
import type { OverState, SortableData } from './backlogDragHelpers';
import {
  computeLiveReorder,
  keyOrderEquals,
  moveIssueAcrossSections,
  overStateEquals,
  resolveCrossSectionDrop,
  resolveIntraSectionRank,
  resolveSourceContainer,
  resolveTargetContainer,
} from './backlogDragHelpers';

// ── Virtualized table body ────────────────────────────────────────────────────

function VirtualizedBacklogTable({
  filteredIssues,
  scrollElement,
  onIssueClick,
  onOpenIssue,
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  epicNames,
  epicColors,
  epicsLoading,
  visibleIssueKeys,
  focusIndex,
  rowRefs,
  sprints,
  onMoveToSprint,
  onMoveToBacklog,
  flaggedFieldKey,
  onToggleFlag,
  justDragged,
}: {
  filteredIssues: JiraIssue[];
  scrollElement: HTMLDivElement | null;
  onIssueClick: (key: string) => void;
  onOpenIssue?: (key: string) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  epicNames?: Map<string, string>;
  epicColors?: Map<string, string>;
  epicsLoading?: boolean;
  visibleIssueKeys: string[];
  focusIndex: number;
  rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
  sprints: Array<{ id: number; name: string; state: string }>;
  onMoveToSprint: (issueKey: string, sprintId: number, sprintName: string) => void;
  onMoveToBacklog?: (issueKey: string) => void;
  flaggedFieldKey: string;
  onToggleFlag?: (issueKey: string) => void;
  justDragged?: React.MutableRefObject<boolean>;
}) {
  const rowVirtualizer = useVirtualizer({
    count: filteredIssues.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 44,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  // Disable virtualization for table rows — position: absolute on <tr> elements
  // is undefined behavior in CSS and causes rows to overlap in most browsers.
  // Backlog tables are small enough to render without virtualization.
  const useVirtual = false;

  function renderRow(issue: JiraIssue, style?: React.CSSProperties) {
    return (
      <BacklogRow
        key={issue.key}
        ref={(el: HTMLTableRowElement | null) => {
          if (el) {
            rowRefs.current.set(issue.key, el);
            if (style) {
              el.style.position = style.position as string;
              el.style.top = style.top as string;
              el.style.left = style.left as string;
              el.style.width = style.width as string;
              el.style.height = style.height as string;
              el.style.transform = style.transform as string;
            }
          } else {
            rowRefs.current.delete(issue.key);
          }
        }}
        issue={issue}
        onIssueClick={onIssueClick}
        onOpenIssue={onOpenIssue}
        storyPointsFieldKey={storyPointsFieldKey}
        epicLinkFieldKey={epicLinkFieldKey}
        epicNameFieldKey={epicNameFieldKey}
        epicNames={epicNames}
        epicColors={epicColors}
        epicsLoading={epicsLoading}
        isFocused={visibleIssueKeys[focusIndex] === issue.key}
        sprints={sprints}
        onMoveToSprint={onMoveToSprint}
        onMoveToBacklog={onMoveToBacklog}
        isFlagged={isIssueFlagged(issue, flaggedFieldKey)}
        onToggleFlag={onToggleFlag ? () => onToggleFlag(issue.key) : undefined}
        justDragged={justDragged}
      />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/10">
        <tr>
          <th className="w-24 px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
            Key
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Summary</th>
          <th className="px-2 py-2 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">
            Epic
          </th>
          <th className="w-14 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
            Points
          </th>
          <th className="w-10 px-2 py-2 text-xs font-medium text-muted-foreground">Assignee</th>
        </tr>
      </thead>
      <tbody
        style={
          useVirtual
            ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }
            : undefined
        }
      >
        {useVirtual
          ? virtualItems.map((virtualRow) => {
              const issue = filteredIssues[virtualRow.index];
              return renderRow(issue, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              });
            })
          : filteredIssues.map((issue) => renderRow(issue))}
      </tbody>
    </table>
  );
}

// ── Droppable section wrapper (D-03/D-04/D-05) ────────────────────────────────
// Makes each section body a dnd-kit droppable so `over.id` resolves to the
// section even when the pointer is over a header, a gap, or an EMPTY section
// (which renders only a <p> and otherwise cannot receive a drop). When the
// pointer hovers this section during a cross-section drag, a highlight ring is
// applied (D-05).
function DroppableSection({
  sectionId,
  isActiveDropTarget,
  children,
}: {
  sectionId: string;
  isActiveDropTarget: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: sectionId });
  return (
    <div
      ref={setNodeRef}
      data-testid={`droppable-section-${sectionId}`}
      className={
        isActiveDropTarget
          ? // D-05/D-07 (fourth polish pass): the translucent ghost placeholder
            // row (live-reordered into its drop slot) is now the single PRIMARY
            // drop cue in both intra- and cross-section drags. The section tint
            // stays a SUBTLE secondary cue — a faint accent wash with a soft
            // 30%-primary ring — framing the target section without competing
            // with the ghost.
            'rounded-sm bg-accent/10 ring-1 ring-primary/30 transition-colors'
          : 'transition-colors'
      }
    >
      {children}
    </div>
  );
}

/**
 * Custom collision detection for the multi-container backlog (D-03/D-04).
 *
 * `closestCenter` biases toward the source container and frequently fails to
 * register a cross-section drop (dropping on a header/gap/empty section yields
 * no target). The dnd-kit multi-container recipe: try `pointerWithin` first
 * (resolves to whatever is directly under the pointer, including a section
 * droppable), then fall back to `rectIntersection`, then `closestCenter`.
 */
const backlogCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;
  return closestCenter(args);
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const { onIssueClick, onOpenIssue, openCreateStory } = useOutletContext<{
    onIssueClick: (key: string) => void;
    onOpenIssue: (key: string) => void;
    openCreateStory: () => void;
  }>();

  // ── Query client ────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();

  // ── Drag-to-rank sensors (D-06: 150ms delay prevents click/drag conflict) ──
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  // ── Drag-to-rank state (D-08, RANK-05) ──────────────────────────────────────
  const isDraggingRef = useRef(false);
  const justDragged = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // D-05/D-07: current over-section during a drag — drives the SUBTLE
  // cross-section highlight ring. The ghost placeholder row (live-reordered into
  // its drop slot, see handleDragOver) is now the PRIMARY drop cue.
  //
  // Defect-A (smoothness): held so `handleDragOver` can bail out via
  // `overStateEquals` when the section did not change — steady-state pointer
  // movement then causes ZERO highlight re-renders.
  const [overState, setOverState] = useState<OverState>({
    overSectionId: null,
  });
  const { overSectionId } = overState;
  // Map<sectionId, string[]> — overrides server issue-key order during drag window (D-08)
  const [localOrder, setLocalOrder] = useState<Map<string, string[]>>(new Map());
  // D-07 (ghost placeholder model): pre-drag snapshot of localOrder captured on
  // drag start so an aborted drag or a cross-section "Keep Position" cancel can
  // restore the exact order both sections had before live-reorder mutated them.
  const preDragOrderRef = useRef<Map<string, string[]> | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);
  // Pending cross-section drag move (D-03/D-04)
  const [pendingDragMove, setPendingDragMove] = useState<{
    issueKey: string;
    fromSectionId: string;
    toSectionId: string;
    fromSprintName: string | null;
    toSprintName: string;
    newOrder: string[];
    previousOrder: string[];
  } | null>(null);

  // ── Auth / settings ─────────────────────────────────────────────────────────
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const {
    storyPointsFieldKey,
    epicLinkFieldKey,
    epicNameFieldKey,
    epicColorFieldKey,
    flaggedFieldKey,
    rankFieldKey,
    setRankFieldKey,
  } = useSettingsStore();

  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    readSecret('jira-pat')
      .then(setJiraToken)
      .catch(() => setJiraToken(null));
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { boardId, isLoading: boardIdLoading } = useBoardId(
    jiraBaseUrl,
    jiraToken,
    activeJiraProject,
  );

  // Phase 74 (GH-BACKLOG-01 / D-01 / D-02 / D-09b): SINGLE backlog data
  // query — replaces the three legacy per-section REST queries (sprint
  // list + sprint stories + unassigned backlog issues). Raw envelope
  // returned by `useGhBacklogData`; adaptation happens caller-side via
  // the useMemo chain below.
  const {
    data: backlog,
    isLoading: backlogLoading,
    isFetching: backlogFetching,
    isError,
    error,
    dataUpdatedAt,
  } = useGhBacklogData(boardId ?? null);

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : '';

  // D-11: Populate rankFieldKey once from backlog response when not yet discovered.
  // Probe-verified: backlog.rankCustomFieldId === 10105 → rankFieldKey = 'customfield_10105'.
  // Guard (!rankFieldKey) prevents background poll re-triggering after first write.
  useEffect(() => {
    if (backlog?.rankCustomFieldId && !rankFieldKey) {
      setRankFieldKey(`customfield_${backlog.rankCustomFieldId}`);
    }
  }, [backlog?.rankCustomFieldId, rankFieldKey, setRankFieldKey]);

  // D-09b adapter useMemo chain — same model as SprintBoardTab (Pattern S3).
  const entityMaps = useMemo(
    () => (backlog ? buildEntityMaps({ entityData: backlog.entityData }) : null),
    [backlog],
  );
  const adapt = useMemo(
    () => (entityMaps ? createAdapter({ storyPointsFieldKey, entityMaps }) : null),
    [storyPointsFieldKey, entityMaps],
  );

  // D-04b sprint reverse-index: issueId → sprintId, built from
  // `data.sprints[].issuesIds[]`. Drives both `fields.sprint` synthesis on
  // adapted issues and the backlog/sprint partition below.
  const issueIdToSprintId = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of backlog?.sprints ?? []) {
      // BL-01: restrict reverse index to ACTIVE/FUTURE sprints so issues
      // whose only sprint membership is a CLOSED sprint fall through to the
      // backlog bucket (matches the ACTIVE/FUTURE-only `sprintSections`
      // partition below — keeps the "sections + backlog" partition consistent).
      if (s.state !== 'ACTIVE' && s.state !== 'FUTURE') continue;
      for (const id of s.issuesIds) m.set(id, s.id);
    }
    return m;
  }, [backlog?.sprints]);

  const adaptedIssues = useMemo<JiraIssue[]>(() => {
    if (!backlog || !adapt || !entityMaps) return [];
    return backlog.issues.map((gh) => {
      const base = adapt(gh) as JiraIssue;
      // Synthesize epic-link field (customfield_10014) from `gh.epicId` via
      // resolveEpic — the shared adapter intentionally leaves this off the
      // adapted shape (RESEARCH ambiguity #3), so callers that need the
      // epic chip on rows / filter must hydrate it themselves.
      const epic = resolveEpic(gh.epicId, entityMaps);
      // Synthesize flagged status on the flagged field key so isIssueFlagged
      // (which reads fields[flaggedFieldKey]) and BacklogRow's indicator/
      // context-menu both work. Format mirrors Jira REST: array with one
      // { value: 'Impediment' } object, or null when unflagged.
      const flaggedValue: Array<{ value: string }> | null = gh.flagged
        ? [{ value: 'Impediment' }]
        : null;
      const sprintId = issueIdToSprintId.get(gh.id);

      const fields: JiraIssue['fields'] = {
        ...base.fields,
        ...(epic ? { [epicLinkFieldKey]: epic.key } : {}),
        [flaggedFieldKey]: flaggedValue,
        ...(sprintId !== undefined ? { sprint: { id: sprintId } } : {}),
      };
      return { ...base, fields };
    });
  }, [backlog, adapt, entityMaps, issueIdToSprintId, epicLinkFieldKey, flaggedFieldKey]);

  // D-01: backlog list = adapted issues with no sprint membership.
  const backlogIssuesAdapted = useMemo<JiraIssue[]>(
    () => adaptedIssues.filter((i) => !(i.fields as { sprint?: unknown }).sprint),
    [adaptedIssues],
  );

  // D-01a + RESEARCH A5: sprint sections rendered in `data.sprints[]` order,
  // filtered to ACTIVE / FUTURE (uppercase per fixture). Each section's
  // issues are the adapted rows whose synthesized `fields.sprint.id` matches.
  const sprintSections = useMemo(() => {
    if (!backlog) return [];
    return backlog.sprints
      .filter((s) => s.state === 'ACTIVE' || s.state === 'FUTURE')
      .map((s) => ({
        sprint: s,
        issues: adaptedIssues.filter(
          (i) => (i.fields.sprint as { id?: number } | undefined)?.id === s.id,
        ),
      }));
  }, [backlog, adaptedIssues]);

  // All project statuses (for filter dropdown — shows all that exist, not just visible)
  const { data: projectStatuses } = useQuery({
    queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchProjectStatuses(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? ''),
    staleTime: Infinity,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // All project epics (shared cache with EpicsPage and SprintBoardTab)
  const { data: allEpics } = useQuery({
    queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchEpicsBasic(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        epicNameFieldKey,
        epicColorFieldKey,
      ),
    staleTime: 5 * 60_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // Show global skeleton until backlog data loads. Before jiraToken resolves
  // (async readSecret) or before boardId resolves, the query is disabled —
  // treat as loading. Once `backlog` resolves, we render sections + backlog.
  const authBootstrapping = !jiraToken;
  const isAnyLoading =
    authBootstrapping || boardIdLoading || backlogLoading || (!backlog && backlogFetching);
  const showSkeleton = useDelayedLoading(isAnyLoading);

  // Per-query loading for epics (LOAD-04)
  const isEpicsLoading = !allEpics && !!activeJiraProject;

  // D-07 / Plan 05: single "Reload backlog" toolbar action. Mirrors Phase 73's
  // "Reload board" pattern (SprintBoardTab.tsx:776-810). Invalidates the GH
  // backlog envelope + project epics + project statuses (the three cache keys
  // BacklogPage depends on). 3-second aria-live auto-clear matches Phase 73.
  const [reloadStatus, setReloadStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!reloadStatus) return;
    const t = setTimeout(() => setReloadStatus(null), 3000);
    return () => clearTimeout(t);
  }, [reloadStatus]);

  const handleReloadBacklog = useCallback(async () => {
    try {
      if (boardId) invalidateGhBacklogData(queryClient, boardId);
      await queryClient.invalidateQueries({
        queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
      });
      await queryClient.invalidateQueries({
        queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
      });
      setReloadStatus('Backlog reloaded');
    } catch {
      setReloadStatus('Failed to reload backlog');
    }
  }, [queryClient, boardId, activeJiraProject, jiraBaseUrl]);

  // Inline error retry / stale-data banner retry route through the same
  // handler so the user-visible "reload" semantics are uniform.
  const refetch = () => {
    void handleReloadBacklog();
  };

  // ── Pending sprint move confirmation state ────────────────────────────────────
  const [pendingSprintMove, setPendingSprintMove] = useState<{
    issueKey: string;
    sprintId: number;
    sprintName: string;
    fromSprintName: string | null;
  } | null>(null);

  const [pendingBacklogMove, setPendingBacklogMove] = useState<{
    issueKey: string;
    fromSprintName: string;
  } | null>(null);

  // ── Stale data banner state ───────────────────────────────────────────────────
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  // ── Collapse state (all sections open by default) ────────────────────────────

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  function toggleSection(sectionId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  // ── Filter state (shared across views) ──────────────────────────────────────

  const { activeEpics, activeLabels, activeAssignees, activeStatuses } = useFilterStore();

  // ── Sprint context for downstream UI (move-to-sprint menus) ──────────────────

  // Available sprints for context menu — the ACTIVE+FUTURE sections only.
  // BacklogRow's sprint type expects lowercase `state` ('active' | 'future' | …)
  // so we down-case here (RESEARCH A5 — the wire shape is uppercase).
  const availableSprints = useMemo(
    () =>
      sprintSections.map(({ sprint }) => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state.toLowerCase(),
      })),
    [sprintSections],
  );

  const allIssues = useMemo<JiraIssue[]>(() => {
    const sprintIssuesList = sprintSections.flatMap((s) => s.issues);
    return [...sprintIssuesList, ...backlogIssuesAdapted];
  }, [sprintSections, backlogIssuesAdapted]);

  // ── Epic name and color maps derived from allEpics query ──────────────────────

  const epicNameMap = useMemo(() => {
    if (!allEpics) return undefined;
    const m = new Map<string, string>();
    for (const e of allEpics) m.set(e.key, e.epicName);
    return m;
  }, [allEpics]);

  const epicColorMap = useMemo(() => {
    if (!allEpics) return undefined;
    const m = new Map<string, string>();
    for (const e of allEpics) if (e.color) m.set(e.key, e.color);
    return m;
  }, [allEpics]);

  // ── Filter options (derived from all issues across all sections) ──────────────

  const filterOptions = useMemo(() => {
    // Epics: all project epics (not just those on current backlog issues)
    const epics = new Map<string, string>();
    for (const e of allEpics ?? []) epics.set(e.key, e.epicName);
    // Also include any epic on current issues not yet in allEpics
    for (const issue of allIssues) {
      const epicKey = issue.fields[epicLinkFieldKey] as string | null;
      if (epicKey && !epics.has(epicKey)) {
        const nameFromField = issue.fields[epicNameFieldKey] as string | null;
        epics.set(epicKey, nameFromField ?? epicKey);
      }
    }
    // D-05a: label filter dropped from the backlog surface — `GhIssue` carries
    // no `labels[]`. Pass an empty array so the shared UnifiedFilterBar's
    // Labels dropdown renders with no options on the backlog.
    const assignees = new Set<string>();
    for (const issue of allIssues) {
      if (issue.fields.assignee?.displayName) assignees.add(issue.fields.assignee.displayName);
    }
    // Statuses: all project workflow statuses (not just those on current issues)
    const statuses = new Set<string>();
    for (const s of projectStatuses ?? []) statuses.add(s.name);
    for (const issue of allIssues) {
      if (issue.fields.status?.name) statuses.add(issue.fields.status.name);
    }
    return {
      epics,
      labels: [] as string[],
      assignees: Array.from(assignees),
      statuses: Array.from(statuses).sort(),
    };
  }, [allIssues, epicLinkFieldKey, epicNameFieldKey, allEpics, projectStatuses]);

  // ── Filter application helper ─────────────────────────────────────────────────

  function applyFilters(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => {
      const epicMatch = (() => {
        if (activeEpics.size === 0) return true;
        const epicKey = issue.fields[epicLinkFieldKey] as string | null;
        return epicKey != null && activeEpics.has(epicKey);
      })();
      const labelMatch =
        activeLabels.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some((l) => activeLabels.has(l));
      const assigneeMatch = (() => {
        if (activeAssignees.size === 0) return true;
        const name = issue.fields.assignee?.displayName ?? '';
        return Array.from(activeAssignees).some((q) =>
          name.toLowerCase().includes(q.toLowerCase()),
        );
      })();
      const statusMatch = (() => {
        if (activeStatuses.size === 0) return true;
        const activeLC = new Set(Array.from(activeStatuses).map((s) => s.toLowerCase()));
        // Match on the story's own status (case-insensitive). Phase 74 drops
        // the subtask-status fallback path with the subtask chip (D-05b) — the
        // backlog data envelope no longer carries subtask rows.
        const storyStatus = (issue.fields.status?.name ?? '').toLowerCase();
        return Boolean(storyStatus && activeLC.has(storyStatus));
      })();
      const result = epicMatch && labelMatch && assigneeMatch && statusMatch;
      return result;
    });
  }

  // ── J/K navigation ──────────────────────────────────────────────────────────

  const visibleIssueKeys = useMemo(() => {
    if (!backlog) return [];
    const keys: string[] = [];
    for (const { sprint, issues } of sprintSections) {
      const sectionId = `sprint-${sprint.id}`;
      if (collapsedSections.has(sectionId)) continue;
      const filtered = applyFilters(issues);
      for (const issue of filtered) {
        keys.push(issue.key);
      }
    }
    if (!collapsedSections.has('backlog')) {
      const filtered = applyFilters(backlogIssuesAdapted);
      for (const issue of filtered) {
        keys.push(issue.key);
      }
    }
    return keys;
    // biome-ignore lint/correctness/useExhaustiveDependencies: applyFilters is a non-memoized local function; its deps are already captured via closures in this useMemo
  }, [backlog, backlogIssuesAdapted, collapsedSections, applyFilters, sprintSections]);

  const { focusIndex } = useListNavigation({
    itemCount: visibleIssueKeys.length,
    onSelect: (index) => onIssueClick(visibleIssueKeys[index]),
    enabled: !isAnyLoading && visibleIssueKeys.length > 0,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < visibleIssueKeys.length) {
      const key = visibleIssueKeys[focusIndex];
      const el = rowRefs.current.get(key);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusIndex, visibleIssueKeys]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // Request handlers: set pending state for confirmation dialog. Phase 74 —
  // both sprint and backlog issues now live in a single adapted list, and
  // the sprint name is resolved through `sprintSections` (the data.json
  // envelope's `data.sprints[]`).
  function lookupSprintNameById(sprintId: number | null | undefined): string | null {
    // BL-02: resolve from the raw `backlog.sprints` (the full list, including
    // CLOSED) rather than `sprintSections` (ACTIVE/FUTURE only) so a sprint
    // name is always resolvable when an id is known — even for CLOSED sprints
    // or arbitrary ids passed in from future callers.
    if (sprintId == null || !backlog) return null;
    const s = backlog.sprints.find((x) => x.id === sprintId);
    return s ? s.name : null;
  }

  function requestMoveToSprint(issueKey: string, sprintId: number, sprintName: string) {
    const issue = adaptedIssues.find((i) => i.key === issueKey);
    const currentSprintId = (issue?.fields.sprint as { id?: number } | undefined)?.id;
    setPendingSprintMove({
      issueKey,
      sprintId,
      sprintName,
      fromSprintName: lookupSprintNameById(currentSprintId),
    });
  }

  async function handleToggleFlag(issueKey: string) {
    if (!jiraBaseUrl || !jiraToken || boardId == null) return;
    const issue = adaptedIssues.find((i) => i.key === issueKey);
    if (!issue) return;
    const currentFlagged = isIssueFlagged(issue, flaggedFieldKey);
    const newFlaggedValue: Array<{ value: string }> | null = currentFlagged
      ? null
      : [{ value: 'Impediment' }];
    const issueNumericId = Number(issue.id);
    const cacheKey = ['gh-backlog', boardId] as const;
    const previous = queryClient.getQueryData<GhBacklogResponse>(cacheKey);
    queryClient.setQueryData<GhBacklogResponse>(cacheKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        issues: old.issues.map((g) =>
          g.id === issueNumericId ? { ...g, flagged: !currentFlagged } : g,
        ),
      };
    });
    try {
      await setIssueFlagged(jiraBaseUrl, jiraToken, issueKey, !currentFlagged, flaggedFieldKey);
      await invalidateGhBacklogData(queryClient, boardId);
    } catch {
      if (previous) queryClient.setQueryData<GhBacklogResponse>(cacheKey, previous);
    }
    // Touch unused setter so the optimistic-cache linter doesn't trip.
    void newFlaggedValue;
  }

  function requestMoveToBacklog(issueKey: string) {
    const issue = adaptedIssues.find((i) => i.key === issueKey);
    const currentSprintId = (issue?.fields.sprint as { id?: number } | undefined)?.id;
    setPendingBacklogMove({
      issueKey,
      fromSprintName: lookupSprintNameById(currentSprintId) ?? 'Sprint',
    });
  }

  // Confirm handlers: execute the actual API calls (formerly handleMove*).
  // Phase 74 D-06 / D-06a: optimistic updates mutate the single
  // `['gh-backlog', boardId]` cache in place; invalidation goes through
  // `invalidateGhBacklogData` (NOT the deleted legacy backlog keys).
  // Per RESEARCH Open Question #1 / Pitfall 5: optimistic update is by
  // moving the issueId between `data.sprints[].issuesIds[]` — the
  // adapter's `useMemo` chain re-derives `fields.sprint` from that
  // reverse index.
  // WR-05: `sprintName` removed from the signature — the destination name is
  // displayed by the confirmation dialog upstream and is not needed by the
  // API call (`addIssuesToSprint` takes only the sprintId).
  async function confirmMoveToSprint(issueKey: string, sprintId: number) {
    if (boardId == null) return;
    const issue = adaptedIssues.find((i) => i.key === issueKey);
    const issueNumericId = issue ? Number(issue.id) : null;
    const cacheKey = ['gh-backlog', boardId] as const;
    const previous = queryClient.getQueryData<GhBacklogResponse>(cacheKey);
    if (issueNumericId != null) {
      queryClient.setQueryData<GhBacklogResponse>(cacheKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          sprints: old.sprints.map((s) =>
            s.id === sprintId
              ? {
                  ...s,
                  issuesIds: s.issuesIds.includes(issueNumericId)
                    ? s.issuesIds
                    : [...s.issuesIds, issueNumericId],
                }
              : { ...s, issuesIds: s.issuesIds.filter((id) => id !== issueNumericId) },
          ),
        };
      });
    }
    try {
      await addIssuesToSprint(jiraBaseUrl ?? '', jiraToken ?? '', sprintId, [issueKey]);
      // D-06: one invalidation covers the whole backlog freshness contract.
      invalidateGhBacklogData(queryClient, boardId);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail'] });
    } catch (_err) {
      // Rollback to the snapshot taken before the optimistic mutation.
      if (previous) queryClient.setQueryData<GhBacklogResponse>(cacheKey, previous);
    }
  }

  async function confirmMoveToBacklog(issueKey: string) {
    if (boardId == null) return;
    const issue = adaptedIssues.find((i) => i.key === issueKey);
    const issueNumericId = issue ? Number(issue.id) : null;
    const cacheKey = ['gh-backlog', boardId] as const;
    const previous = queryClient.getQueryData<GhBacklogResponse>(cacheKey);
    if (issueNumericId != null) {
      // D-06a: drop the issueId from every sprint's `issuesIds[]` so the
      // adapter chain demotes it to the backlog list on the next render.
      queryClient.setQueryData<GhBacklogResponse>(cacheKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          sprints: old.sprints.map((s) => ({
            ...s,
            issuesIds: s.issuesIds.filter((id) => id !== issueNumericId),
          })),
        };
      });
    }
    try {
      await moveIssuesToBacklog(jiraBaseUrl ?? '', jiraToken ?? '', [issueKey]);
      invalidateGhBacklogData(queryClient, boardId);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail'] });
    } catch (_err) {
      if (previous) queryClient.setQueryData<GhBacklogResponse>(cacheKey, previous);
    }
  }

  // D-05c: flagged indicator + flag/unflag handler dropped from the backlog
  // surface. The same toggle is still available on the issue detail view
  // (which owns its own mutation handler against the issue-detail cache).

  // ── Rank mutation (RANK-02/04/05, D-08) ──────────────────────────────────────
  // Follows the useFieldMutation.ts onMutate/onError/onSettled pattern.
  // rankCustomFieldId is the INTEGER from cached GhBacklogResponse — never
  // hardcoded (T-78-04A threat mitigated). readSecret in mutationFn reuses
  // the existing Stronghold PAT path (T-78-04B).
  const rankMutation = useMutation({
    mutationFn: async ({
      issueKey,
      rankCustomFieldId,
      position,
    }: {
      issueKey: string;
      sectionId: string;
      newOrder: string[];
      previousOrder: string[];
      rankCustomFieldId: number;
      position: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never>;
    }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return rankIssueApi(jiraBaseUrl ?? '', token, issueKey, rankCustomFieldId, position);
    },
    onMutate: async ({ sectionId, newOrder, previousOrder }) => {
      // D-08 / RANK-05: cancel in-flight refetch so server data cannot
      // overwrite the optimistic order while the user is dragging.
      await queryClient.cancelQueries({ queryKey: ['gh-backlog', boardId] });
      const snapshot = queryClient.getQueryData<GhBacklogResponse>(['gh-backlog', boardId]);
      isDraggingRef.current = true;
      setLocalOrder((prev) => new Map(prev).set(sectionId, newOrder));
      return { snapshot, sectionId, previousOrder };
    },
    onError: (_err, _vars, context) => {
      // RANK-04: rollback snapshot and local order; set inline error banner.
      if (context?.snapshot) {
        queryClient.setQueryData(['gh-backlog', boardId], context.snapshot);
      }
      if (context?.sectionId && context?.previousOrder) {
        setLocalOrder((prev) => new Map(prev).set(context.sectionId, context.previousOrder));
      }
      setRankError("Couldn't save new order — reverted");
      isDraggingRef.current = false;
    },
    onSettled: () => {
      isDraggingRef.current = false;
      if (boardId != null) invalidateGhBacklogData(queryClient, boardId);
    },
  });

  // ── Drag handlers (D-01, D-02, D-03, D-06, D-07) ────────────────────────────

  // Stable set of currently-rendered section ids (sprint-* + backlog). Used by
  // the cross-section drop resolver to validate a section droppable id.
  const sectionIds = useMemo(() => {
    const s = new Set<string>();
    for (const { sprint } of sprintSections) s.add(`sprint-${sprint.id}`);
    s.add('backlog');
    return s;
  }, [sprintSections]);

  const EMPTY_OVER_STATE: OverState = {
    overSectionId: null,
  };

  // Gate the setter so steady-state movement (same over-state) is a no-op and
  // never re-renders — see overStateEquals (Defect-A smoothness fix).
  function applyOverState(next: OverState) {
    setOverState((prev) => (overStateEquals(prev, next) ? prev : next));
  }

  function clearOverState() {
    applyOverState(EMPTY_OVER_STATE);
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
    isDraggingRef.current = true;
    setRankError(null);
    clearOverState();
    // D-07 (ghost placeholder model): snapshot localOrder so an aborted drag or
    // a cross-section "Keep Position" cancel restores cleanly. Also seed the
    // source section's localOrder with its current displayed order so the live
    // reorder in handleDragOver has a stable base to arrayMove against.
    preDragOrderRef.current = new Map(localOrder);
    const activeKey = active.id as string;
    const sourceSection = findSectionOfKey(activeKey);
    if (sourceSection) {
      setLocalOrder((prev) => {
        if (prev.has(sourceSection)) return prev;
        return new Map(prev).set(sourceSection, getSectionKeys(sourceSection));
      });
    }
  }

  // D-07 (ghost placeholder model): live-reorder the dragged item into its drop
  // slot in real time so its in-list row IS the ghost placeholder. Updates the
  // SUBTLE section highlight ring too. All setState calls are GATED (section
  // equality + array equality) so steady-state movement causes ZERO re-renders.
  //
  // IMPORTANT: live reorder is INTRA-section only. We deliberately do NOT move
  // the dragged key between sections during a cross-section drag — doing so
  // reflows both the source and target sections every frame, which shifts the
  // pointer's position relative to the sections and makes dnd-kit's collision
  // detection oscillate (the drag feels janky / uncontrollable). A cross-section
  // drop opens a confirmation dialog anyway, so during the drag we only light up
  // the target-section highlight ring and let the DragOverlay follow the cursor;
  // the actual move is resolved from the drop target in handleDragEnd.
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) {
      clearOverState();
      return;
    }
    const activeKey = active.id as string;
    const overData = over.data.current as { sortable?: { containerId?: string } } | undefined;
    const rowContainer = overData?.sortable?.containerId;
    const overIdStr = over.id as string;

    // Resolve the section the pointer is within (row container OR section droppable id).
    const section = rowContainer ?? (sectionIds.has(overIdStr) ? overIdStr : null);

    // Section highlight ring (gated by overStateEquals).
    applyOverState({ overSectionId: section });

    if (!section) return;
    const sourceSection = findSectionOfKey(activeKey) ?? section;

    // Intra-section live reorder only — see the function comment for why
    // cross-section deliberately does not reorder during the drag.
    if (section !== sourceSection) return;
    if (!rowContainer || overIdStr === activeKey) return;
    setLocalOrder((prev) => {
      const current = prev.get(section) ?? getSectionKeys(section);
      const next = computeLiveReorder(current, activeKey, overIdStr);
      if (keyOrderEquals(current, next)) return prev; // gate: no change → no re-render
      return new Map(prev).set(section, next);
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    isDraggingRef.current = false;
    setActiveId(null);
    clearOverState();
    // Guard post-drop click (D-06): set for 50ms so BacklogRow onClick returns early.
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 50);

    if (!over) {
      restorePreDragOrder();
      return;
    }

    const activeKey = active.id as string;
    const activeData = active.data.current as SortableData | undefined;
    const overData = over.data.current as SortableData | undefined;

    // Source is the dragged row's own container. Because cross-section drags no
    // longer move the key between sections during the drag (see handleDragOver),
    // the active container is reliably the source — and intra live-reorder keeps
    // the same container too. Target is the section under the drop: a row's
    // container OR a section droppable id (header/gap/empty section).
    const sourceContainer = resolveSourceContainer(activeData) ?? findSectionOfKey(activeKey);
    const targetContainer = resolveTargetContainer(over.id as string, overData, sectionIds);

    if (!sourceContainer || !targetContainer) {
      restorePreDragOrder();
      return;
    }

    if (sourceContainer === targetContainer) {
      // ── Intra-section reorder ───────────────────────────────────────────────
      // localOrder already reflects the final order (live-reorder), so derive
      // the rank decision directly from it — NO extra arrayMove. The helper
      // owns the SERVER-order fallback for previousOrder (regression guard:
      // a fresh drag must not default previousOrder to newOrder, which would
      // trip the no-movement guard and snap the issue back without a PUT).
      const rank = resolveIntraSectionRank({
        activeKey,
        liveOrder: localOrder.get(sourceContainer) ?? getSectionKeys(sourceContainer),
        preDragOrder: preDragOrderRef.current?.get(sourceContainer),
        serverKeys: getSectionKeys(sourceContainer),
      });
      if (!rank) {
        // No net movement — clear any seeded override and bail.
        restorePreDragOrder();
        return;
      }
      rankMutation.mutate({
        issueKey: activeKey,
        sectionId: sourceContainer,
        newOrder: rank.newOrder,
        previousOrder: rank.previousOrder,
        rankCustomFieldId: backlog?.rankCustomFieldId ?? 0,
        position: rank.position,
      });
    } else {
      // ── Cross-section — open confirmation dialog (D-03/D-04) ─────────────────
      // The key was NOT live-moved into the target during the drag (that caused
      // jank), so build the optimistic target order now by inserting it at the
      // drop index. The cache move + rollback happen on confirm (confirmDragMove).
      const resolution = resolveCrossSectionDrop({
        activeKey,
        activeData,
        overId: over.id as string,
        overData,
        sectionIds,
        getTargetKeys: (id) => localOrder.get(id) ?? getSectionKeys(id),
      });
      if (!resolution) {
        restorePreDragOrder();
        return;
      }
      const previousOrder = localOrder.get(sourceContainer) ?? getSectionKeys(sourceContainer);
      const fromSprintName = sourceContainer.startsWith('sprint-')
        ? (lookupSprintNameById(parseInt(sourceContainer.replace('sprint-', ''), 10)) ?? null)
        : null;
      const toSprintName = targetContainer.startsWith('sprint-')
        ? (lookupSprintNameById(parseInt(targetContainer.replace('sprint-', ''), 10)) ?? 'Sprint')
        : 'Backlog';
      setPendingDragMove({
        issueKey: activeKey,
        fromSectionId: sourceContainer,
        toSectionId: targetContainer,
        fromSprintName,
        toSprintName,
        newOrder: resolution.newTargetOrder,
        previousOrder,
      });
    }
  }

  // Restore both sections' localOrder to the pre-drag snapshot — used when a
  // drag is aborted (no valid drop) or a cross-section move is cancelled. Keeps
  // the ghost-placeholder live-reorder from "sticking" after a no-op release.
  function restorePreDragOrder() {
    const snapshot = preDragOrderRef.current;
    setLocalOrder(snapshot ? new Map(snapshot) : new Map());
  }

  // Helper: get the server-derived issue keys for a given section id.
  function getSectionKeys(sectionId: string): string[] {
    if (sectionId === 'backlog') return backlogIssuesAdapted.map((i) => i.key);
    const sprintId = parseInt(sectionId.replace('sprint-', ''), 10);
    const section = sprintSections.find((s) => s.sprint.id === sprintId);
    return section ? section.issues.map((i) => i.key) : [];
  }

  // Helper: locate which section a key belongs to in the SERVER membership
  // (used to seed live-reorder and resolve the true source on drop).
  function findSectionOfKey(key: string): string | null {
    for (const { sprint, issues } of sprintSections) {
      if (issues.some((i) => i.key === key)) return `sprint-${sprint.id}`;
    }
    if (backlogIssuesAdapted.some((i) => i.key === key)) return 'backlog';
    return null;
  }

  // ── Cross-section drag confirm handlers (D-03/D-04) ──────────────────────────

  async function confirmDragMove() {
    if (!pendingDragMove || boardId == null) return;
    const { issueKey, fromSectionId, toSectionId, newOrder, previousOrder } = pendingDragMove;
    setPendingDragMove(null);

    // Defect-B (optimistic cross-section move): the rendered membership of each
    // section is derived from the SERVER `gh-backlog` cache via the
    // issueIdToSprintId reverse index — `localOrder` only re-sorts keys WITHIN a
    // section's existing server membership. So to make the moved row appear in
    // the target section IMMEDIATELY (no post-success jump), we must move the
    // issue between `sprints[].issuesIds[]` in the cache BEFORE the awaits,
    // mirroring confirmMoveToSprint/confirmMoveToBacklog.
    const cacheKey = ['gh-backlog', boardId] as const;
    const snapshot = queryClient.getQueryData<GhBacklogResponse>(cacheKey);
    const issue = adaptedIssues.find((i) => i.key === issueKey);
    const issueNumericId = issue ? Number(issue.id) : null;

    // Cancel in-flight refetch so the optimistic cache write can't be clobbered
    // before the membership PUT settles (mirrors rankMutation.onMutate / D-08).
    await queryClient.cancelQueries({ queryKey: cacheKey });

    if (issueNumericId != null) {
      queryClient.setQueryData<GhBacklogResponse>(cacheKey, (old) =>
        old
          ? { ...old, sprints: moveIssueAcrossSections(old.sprints, issueNumericId, toSectionId) }
          : old,
      );
    }

    // Optimistic ordering: now that the issue lives in the target section's
    // server membership, set the within-section order overrides for both
    // sections (D-08 localOrder gate).
    const sourceKeys = previousOrder.filter((k) => k !== issueKey);
    setLocalOrder((prev) => {
      const next = new Map(prev);
      next.set(fromSectionId, sourceKeys);
      next.set(toSectionId, newOrder);
      return next;
    });

    const rollback = () => {
      if (snapshot) queryClient.setQueryData<GhBacklogResponse>(cacheKey, snapshot);
      setLocalOrder((prev) => {
        const next = new Map(prev);
        next.set(fromSectionId, previousOrder);
        next.delete(toSectionId);
        return next;
      });
      setRankError("Couldn't move issue — reverted");
    };

    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) {
      rollback();
      return;
    }

    try {
      // Sprint-membership change first (D-03).
      if (toSectionId === 'backlog') {
        await moveIssuesToBacklog(jiraBaseUrl ?? '', token, [issueKey]);
      } else {
        const targetSprintId = parseInt(toSectionId.replace('sprint-', ''), 10);
        await addIssuesToSprint(jiraBaseUrl ?? '', token, targetSprintId, [issueKey]);
      }
      // Then rank within target section.
      const above = newOrder[newOrder.indexOf(issueKey) - 1];
      const below = newOrder[newOrder.indexOf(issueKey) + 1];
      const position:
        | { rankBeforeIssue: string }
        | { rankAfterIssue: string }
        | Record<string, never> =
        above !== undefined
          ? { rankAfterIssue: above }
          : below !== undefined
            ? { rankBeforeIssue: below }
            : {};
      await rankIssueApi(
        jiraBaseUrl ?? '',
        token,
        issueKey,
        backlog?.rankCustomFieldId ?? 0,
        position,
      );
      // Success: reconcile against the server. Because the optimistic cache
      // already placed the issue in the target section, the refetch lands the
      // identical membership → no visible jump. Drop the localOrder overrides so
      // the reconciled server order takes over cleanly (no double-insert).
      setLocalOrder((prev) => {
        const next = new Map(prev);
        next.delete(fromSectionId);
        next.delete(toSectionId);
        return next;
      });
      invalidateGhBacklogData(queryClient, boardId);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail'] });
    } catch {
      // Rollback cache + local order (RANK-04 analog for cross-section).
      rollback();
    }
  }

  function cancelDragMove() {
    if (!pendingDragMove) return;
    // "Keep Position" — no API call. Cross-section live-reorder mutated BOTH the
    // source and target localOrder, so restore the full pre-drag snapshot rather
    // than just the source section.
    restorePreDragOrder();
    setPendingDragMove(null);
  }

  // Section id that currently owns the dragged row — used to suppress the
  // cross-section highlight on the source section itself (D-05).
  const activeSourceSectionId = useMemo(() => {
    if (!activeId) return null;
    for (const { sprint, issues } of sprintSections) {
      if (issues.some((i) => i.key === activeId)) return `sprint-${sprint.id}`;
    }
    if (backlogIssuesAdapted.some((i) => i.key === activeId)) return 'backlog';
    return null;
  }, [activeId, sprintSections, backlogIssuesAdapted]);

  // ── Section renderer ──────────────────────────────────────────────────────────

  function renderSection(
    sectionId: string,
    title: string,
    badge: string | null,
    issues: JiraIssue[],
    showCreateStory: boolean,
    isSticky: boolean = false,
    moveToBacklog?: (issueKey: string) => void,
    sectionStoriesLoading: boolean = false,
  ) {
    const isCollapsed = collapsedSections.has(sectionId);
    const filteredIssues = applyFilters(issues);
    // D-08 / RANK-05: use localOrder override during drag window so a focus-
    // triggered refetch cannot snap the list back. localOrder keys are
    // stable section IDs ('sprint-<id>' / 'backlog').
    const orderedKeys = localOrder.get(sectionId);
    // Re-sort filteredIssues to match localOrder when a drag override is set.
    const displayIssues = orderedKeys
      ? [...filteredIssues].sort((a, b) => {
          const ai = orderedKeys.indexOf(a.key);
          const bi = orderedKeys.indexOf(b.key);
          // Issues not in localOrder (e.g. filtered-in mid-drag) go to end.
          return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
        })
      : filteredIssues;
    // SortableContext items — use localOrder if set, else server keys (RANK-01).
    const sortableItems = orderedKeys ?? issues.map((i) => i.key);

    return (
      <div key={sectionId} className="mb-2" data-testid={`sprint-section-${sectionId}`}>
        {/* Section header */}
        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          className={`flex items-center gap-2 w-full px-4 py-2 border-b border-border transition-colors text-left ${
            isSticky
              ? 'sticky top-0 z-[5] bg-muted shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:bg-muted'
              : 'bg-muted/40 hover:bg-muted/60'
          }`}
          data-testid={`section-header-${sectionId}`}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{title}</span>
          {badge && <Badge tone={badge === 'Active' ? 'green' : 'blue'}>{badge}</Badge>}
          <span className="ml-auto text-xs text-muted-foreground">
            {sectionStoriesLoading ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              <>
                {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
              </>
            )}
          </span>
        </button>

        {/* Section body — wrapped in a droppable so a cross-section drop
            resolves to this section even over a header/gap/empty section
            (D-03/D-04), and the section highlights while hovered (D-05). */}
        {!isCollapsed && (
          <DroppableSection
            sectionId={sectionId}
            isActiveDropTarget={
              !!activeId && overSectionId === sectionId && activeSourceSectionId !== sectionId
            }
          >
            {sectionStoriesLoading ? (
              /* Stories still loading — show skeleton rows */
              <div className="px-4 py-2 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : displayIssues.length > 0 ? (
              <SortableContext
                id={sectionId}
                items={sortableItems}
                strategy={verticalListSortingStrategy}
              >
                <VirtualizedBacklogTable
                  filteredIssues={displayIssues}
                  scrollElement={scrollRef.current}
                  onIssueClick={onIssueClick}
                  onOpenIssue={onOpenIssue}
                  storyPointsFieldKey={storyPointsFieldKey}
                  epicLinkFieldKey={epicLinkFieldKey}
                  epicNameFieldKey={epicNameFieldKey}
                  epicNames={epicNameMap}
                  epicColors={epicColorMap}
                  epicsLoading={isEpicsLoading}
                  visibleIssueKeys={visibleIssueKeys}
                  focusIndex={focusIndex}
                  rowRefs={rowRefs}
                  sprints={availableSprints}
                  onMoveToSprint={requestMoveToSprint}
                  onMoveToBacklog={moveToBacklog}
                  flaggedFieldKey={flaggedFieldKey}
                  onToggleFlag={handleToggleFlag}
                  justDragged={justDragged}
                />
              </SortableContext>
            ) : issues.length > 0 ? (
              /* All issues filtered out */
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No issues match the current filters
              </p>
            ) : (
              /* Sprint has no stories — keep some height so the empty section
                 remains a comfortable drop target (D-04 empty-section drop). */
              <p className="px-4 py-6 text-sm text-muted-foreground italic">
                No issues in this sprint
              </p>
            )}

            {/* Create story button at the bottom of the section */}
            {showCreateStory && !sectionStoriesLoading && (
              <div className="px-4 py-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => openCreateStory()}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`create-story-${sectionId}`}
                >
                  + Create Story
                </button>
              </div>
            )}
          </DroppableSection>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="backlog-page">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h1 className="text-lg font-semibold">Backlog</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>
          {/* Plan 05 — D-07 inline aria-live feedback span (mirrors SprintBoardTab). */}
          <span
            role="status"
            aria-live="polite"
            className="text-xs text-muted-foreground hidden sm:inline"
          >
            {reloadStatus ?? ''}
          </span>
          <button
            type="button"
            onClick={() => {
              void handleReloadBacklog();
            }}
            disabled={backlogFetching}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Reload backlog"
            title="Reload backlog"
          >
            <RefreshCw className={backlogFetching ? 'size-3 animate-spin' : 'size-3'} />
          </button>
          <button
            type="button"
            onClick={() => openCreateStory()}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            + Create Story
          </button>
        </div>
      </div>

      {/* Sprint move confirmation dialogs (context-menu initiated — keep default "Cancel") */}
      <ConfirmSprintMoveDialog
        open={!!pendingSprintMove}
        onOpenChange={(open) => {
          if (!open) setPendingSprintMove(null);
        }}
        issueKey={pendingSprintMove?.issueKey ?? ''}
        fromSprintName={pendingSprintMove?.fromSprintName ?? null}
        toSprintName={pendingSprintMove?.sprintName ?? ''}
        onConfirm={() => {
          if (pendingSprintMove) {
            void confirmMoveToSprint(pendingSprintMove.issueKey, pendingSprintMove.sprintId);
            setPendingSprintMove(null);
          }
        }}
      />
      <ConfirmSprintMoveDialog
        open={!!pendingBacklogMove}
        onOpenChange={(open) => {
          if (!open) setPendingBacklogMove(null);
        }}
        issueKey={pendingBacklogMove?.issueKey ?? ''}
        fromSprintName={pendingBacklogMove?.fromSprintName ?? null}
        toSprintName="Backlog"
        onConfirm={() => {
          if (pendingBacklogMove) {
            void confirmMoveToBacklog(pendingBacklogMove.issueKey);
            setPendingBacklogMove(null);
          }
        }}
      />

      {/* Cross-section drag confirmation dialog (D-03/D-04) — "Keep Position" cancel */}
      <ConfirmSprintMoveDialog
        open={!!pendingDragMove}
        onOpenChange={(open) => {
          if (!open) cancelDragMove();
        }}
        issueKey={pendingDragMove?.issueKey ?? ''}
        fromSprintName={pendingDragMove?.fromSprintName ?? null}
        toSprintName={pendingDragMove?.toSprintName ?? ''}
        cancelLabel="Keep Position"
        onConfirm={() => {
          void confirmDragMove();
        }}
      />

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* Filter bar — scrolls with content */}
        <UnifiedFilterBar filterOptions={filterOptions} />
        {/* Error state — no cached data */}
        {isError && !backlog && (
          <div className="p-4">
            <ErrorState error={error} onRetry={refetch} viewName="backlog" />
          </div>
        )}

        {/* Stale data banner — error with cached data */}
        {isError && backlog && !bannerDismissed && (
          <div className="px-4 pt-4">
            <StaleDataBanner onRetry={refetch} onDismiss={() => setBannerDismissed(true)} />
          </div>
        )}

        {/* Rank error banner (D-09, RANK-04) — inline, dismissible */}
        {rankError && (
          <div className="px-4 pt-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground flex-1">{rankError}</span>
              <button
                type="button"
                onClick={() => setRankError(null)}
                className="inline-flex items-center justify-center rounded p-1 hover:bg-accent transition-colors"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

        {showSkeleton ? (
          /* Skeleton loading state — backlog envelope not yet loaded */
          <BacklogSkeleton />
        ) : !isError &&
          !authBootstrapping &&
          backlog &&
          sprintSections.length === 0 &&
          backlogIssuesAdapted.length === 0 ? (
          /* Empty state — envelope settled with no data */
          <EmptyState
            icon={Inbox}
            title="Backlog is empty"
            subtitle="All issues are assigned to sprints"
            action={<Button onClick={() => openCreateStory()}>Create Issue</Button>}
          />
        ) : backlog && (sprintSections.length > 0 || backlogIssuesAdapted.length > 0) ? (
          /* Sprint sections + backlog section — wrapped in single DndContext (D-01) */
          <DndContext
            sensors={sensors}
            collisionDetection={backlogCollisionDetection}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div>
              {/* Sprint sections (active first, then future) — `data.sprints[]` order */}
              {sprintSections.map(({ sprint, issues }) =>
                renderSection(
                  `sprint-${sprint.id}`,
                  sprint.name,
                  sprint.state === 'ACTIVE' ? 'Active' : 'Future',
                  issues,
                  false,
                  true,
                  requestMoveToBacklog,
                  false,
                ),
              )}

              {/* Backlog section — always last */}
              {renderSection('backlog', 'Backlog', null, backlogIssuesAdapted, true, true)}
            </div>

            {/* DragOverlay ghost (D-07, fourth polish pass) — ONE coherent
                clone: a SOLID row (opacity 1) with a soft `shadow-lg` and a 1px
                `border border-border`. `dropAnimation={null}` disables the
                float-back-to-source animation on release: the clone simply
                disappears and the already-live-reordered list (with the dragged
                row now landed in its drop slot) is what remains — no jump, no
                float. Identical across intra- and cross-section drags. */}
            <DragOverlay dropAnimation={null}>
              {activeId
                ? (() => {
                    const activeIssue = adaptedIssues.find((i) => i.key === activeId);
                    if (!activeIssue) return null;
                    return (
                      <table className="w-full rounded-md border border-border bg-background text-sm shadow-lg">
                        <tbody>
                          <BacklogRow
                            issue={activeIssue}
                            onIssueClick={() => {}}
                            storyPointsFieldKey={storyPointsFieldKey}
                            epicLinkFieldKey={epicLinkFieldKey}
                            epicNameFieldKey={epicNameFieldKey}
                            epicNames={epicNameMap}
                            epicColors={epicColorMap}
                            isOverlay
                          />
                        </tbody>
                      </table>
                    );
                  })()
                : null}
            </DragOverlay>
          </DndContext>
        ) : null}
      </div>
    </div>
  );
}
