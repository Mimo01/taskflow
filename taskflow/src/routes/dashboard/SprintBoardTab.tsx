/**
 * SprintBoardTab — Jira-style sprint board: 3 category columns x story swimlanes.
 *
 * Columns: always exactly "To Do" | "In Progress" | "Done", driven by the
 * statusCategory field that Jira returns on every status. All statuses with
 * statusCategory.key === "new" land in To Do, "indeterminate" in In Progress,
 * "done" in Done — regardless of how many workflow statuses the project has.
 *
 * Layout: sticky column headers -> collapsible story swimlanes -> card cells.
 * Status transitions: right-click context menu with optimistic update + rollback on failure.
 * Swimlane rows are virtualized via @tanstack/react-virtual for large boards.
 */

import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Columns3, RefreshCw } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { UnifiedFilterBar } from '@/components/UnifiedFilterBar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useBoardId } from '@/hooks/useBoardId';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { epicColorToTailwind } from '@/lib/epicColors';
import type { JiraIssue, JiraTransition } from '@/services/jira';
import {
  buildEntityMaps,
  createAdapter,
  fetchEpicsBasic,
  fetchIssueTransitionsWithFields,
  fetchProjectStatuses,
  filterTransitionsForStatus,
  invalidateGhAllData,
  invalidateGhTransitions,
  isIssueFlagged,
  peekGhTransitions,
  postTransition,
  resolveDropResolution,
  setIssueFlagged,
  transitionsWithFieldsKey,
  useGhAllData,
  useGhTransitions,
} from '@/services/jira';
import { warnOnce } from '@/services/jira/greenhopper/warnOnce';
import { fetchActiveSprint } from '@/services/jira/sprints';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useFilterStore } from '@/stores/filter.store';
import { useSettingsStore } from '@/stores/settings.store';
import { BoardResolutionDialog } from './BoardResolutionDialog';
import { QuickFilterChipRow } from './QuickFilterChipRow';
import { SprintBoardSkeleton } from './SprintBoardSkeleton';
import { SprintGoalBanner } from './SprintGoalBanner';
import { StoryHeaderRow } from './StoryHeaderRow';
import {
  buildDropModel,
  type DropModel,
  filterDroppableTransitions,
  resolveDropTransitionId,
} from './sprintBoardDragHelpers';
import TaskCard from './TaskCard';

/** The three fixed columns — all Jira statuses map into one of these via statusCategory. */
const CATEGORY_COLUMNS = [
  { key: 'new', label: 'To Do' },
  { key: 'indeterminate', label: 'In Progress' },
  { key: 'done', label: 'Done' },
] as const;

type CategoryKey = (typeof CATEGORY_COLUMNS)[number]['key'];

function categoryOf(issue: JiraIssue): CategoryKey {
  return (issue.fields.status.statusCategory?.key as CategoryKey) ?? 'new';
}

/** Data needed to render the sticky swimlane header overlay outside the scroll flow. */
type StickyHeaderData = {
  story: JiraIssue;
  subtasks: JiraIssue[];
  isExpanded: boolean;
} | null;

/**
 * Board-scoped collision detection — pointerWithin-first, then pointer-distance
 * fallback, then rectIntersection, then closestCenter.
 *
 * Copied verbatim from BacklogPage.tsx `backlogCollisionDetection` (PATTERNS.md).
 * Required for split-zone nested droppables where closestCenter biases toward
 * the source container. With a DragOverlay the collisionRect is the overlay
 * translated by pointer coords, so rectIntersection/closestCenter key off that
 * rect and drift from the pointer during column-gap hover. Pointer-distance
 * fallback uses continuously re-measured centers (MeasuringStrategy.Always).
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  const { pointerCoordinates, droppableRects, droppableContainers } = args;
  if (pointerCoordinates) {
    let closestId: string | number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const container of droppableContainers) {
      const rect = droppableRects.get(container.id);
      if (!rect) continue;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(centerX - pointerCoordinates.x, centerY - pointerCoordinates.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestId = container.id;
      }
    }
    if (closestId != null) return [{ id: closestId }];
  }

  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;
  return closestCenter(args);
};

// ── TransitionDropZone ─────────────────────────────────────────────────────────

/**
 * Per-category drop-zone tones — mirror the app's status category colors
 * (statusStyles.ts: To Do = muted, In Progress = blue, Done = green) so a zone
 * reads as the status it transitions to. `idle` is the resting state; `over` is
 * the stronger hover state when a card is dragged onto the zone.
 */
const DROP_ZONE_TONE: Record<'new' | 'indeterminate' | 'done', { idle: string; over: string }> = {
  new: {
    idle: 'bg-muted/60 border-border text-foreground/80',
    over: 'bg-muted border-foreground/50 text-foreground ring-1 ring-foreground/20',
  },
  indeterminate: {
    idle: 'bg-blue-500/10 border-blue-500/60 text-blue-700 dark:text-blue-300',
    over: 'bg-blue-500/25 border-blue-500 text-blue-800 dark:text-blue-200 ring-1 ring-blue-500/40',
  },
  done: {
    idle: 'bg-green-500/10 border-green-500/60 text-green-700 dark:text-green-300',
    over: 'bg-green-500/25 border-green-500 text-green-800 dark:text-green-200 ring-1 ring-green-500/40',
  },
};

/**
 * A single droppable sub-zone inside a column, tinted by its target status
 * category. `categoryKey` selects the color tone (mirrors the status pills).
 */
function TransitionDropZone({
  id,
  label,
  categoryKey,
}: {
  id: string;
  label: string;
  categoryKey: 'new' | 'indeterminate' | 'done';
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const tone = DROP_ZONE_TONE[categoryKey];
  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-md min-h-[80px] flex items-center justify-center text-xs font-semibold px-1 text-center transition-colors ${
        isOver ? tone.over : tone.idle
      }`}
    >
      {label}
    </div>
  );
}

// ── SingleColumnDroppable ──────────────────────────────────────────────────────

/**
 * Wraps a single-transition column cell in a useDroppable so the whole column
 * is a drop target. Renders the existing card list unchanged.
 */
function SingleColumnDroppable({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="contents">
      {children}
    </div>
  );
}

/** Virtualized swimlane list — renders swimlane rows with measureElement for variable heights. */
function VirtualizedSwimlanes({
  filteredSwimlanes,
  scrollElement,
  collapsedStories,
  toggleStory,
  setSelectedIssueKey,
  onOpenIssue,
  cardErrors,
  subtasksLoading,
  onStickyHeaderChange,
  stickyHeaderInnerRef,
  stickyOverlayRef,
  getTransitions,
  onTransition,
  epicNameMap,
  epicColorMap,
  epicLinkFieldKey,
  flaggedFieldKey,
  onToggleFlag,
  activeId,
  activeSwimlaneKey,
  dropModel,
  justDragged,
}: {
  filteredSwimlanes: { story: JiraIssue; subtasks: JiraIssue[] }[];
  scrollElement: HTMLElement | null;
  collapsedStories: Set<string>;
  toggleStory: (key: string) => void;
  setSelectedIssueKey: (key: string) => void;
  /** Phase 77 Plan 04 (PEEK-01): body click on card opens peek panel. */
  onOpenIssue: (key: string) => void;
  cardErrors: Map<string, string>;
  /**
   * When true, subtask cells show Skeleton placeholders instead of cards.
   * Used for progressive rendering when subtask data is loading separately
   * from story headers.
   */
  subtasksLoading: boolean;
  /** Called on scroll with the swimlane whose header should appear pinned,
   *  or null when no header should be pinned (e.g. not scrolled into swimlanes yet). */
  onStickyHeaderChange: (data: StickyHeaderData) => void;
  /** Ref to the sticky header inner div — push offset is applied directly for 60fps performance */
  stickyHeaderInnerRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to the sticky header overlay wrapper — hidden during swaps to prevent flicker */
  stickyOverlayRef: React.RefObject<HTMLDivElement | null>;
  getTransitions: (issue: JiraIssue) => JiraTransition[] | undefined;
  onTransition: (
    issueKey: string,
    transitionId: string,
    toStatusName: string,
    toStatusId: string,
    toStatusCategoryKey?: string,
  ) => void;
  epicNameMap: Map<string, string>;
  epicColorMap: Map<string, string>;
  epicLinkFieldKey: string;
  flaggedFieldKey: string;
  onToggleFlag: (issueKey: string) => void;
  /** Phase 79: key of the currently-dragged card (null when not dragging). */
  activeId: string | null;
  /** Phase 79: story key of the swimlane that owns the dragged card. Drop zones
   *  render ONLY in this swimlane — a transition moves a card horizontally across
   *  status columns within its own story row, so other rows stay normal. */
  activeSwimlaneKey: string | null;
  /** Phase 79: per-column drop model built at drag start (null when not dragging). */
  dropModel: DropModel | null;
  /** Phase 79 (D-12): ref set for 50ms after drop to suppress onClick on cards. */
  justDragged: React.MutableRefObject<boolean>;
}) {
  const swimlaneVirtualizer = useVirtualizer({
    count: filteredSwimlanes.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 120,
    overscan: 5,
    // Key the size cache by the stable story key, not the array index (the default).
    // @tanstack/react-virtual caches measured row heights keyed by getItemKey(index). With the
    // default index key, filtering re-maps which story sits at each index, so a story inherits
    // the *previous* occupant's cached height — wrong translateY offsets and total height, i.e.
    // gaps and misaligned rows until a scroll re-measures each visible row individually. Keying
    // by story.key makes each story carry its own measured height across filter changes, so
    // positions are correct on the first paint with no scroll needed.
    getItemKey: (index) => filteredSwimlanes[index]?.story.key ?? index,
  });

  const virtualItems = swimlaneVirtualizer.getVirtualItems();
  const useVirtual = virtualItems.length > 0;

  /**
   * Track the pixel offset of the virtualizer container from the top of the
   * scroll container. Content like SprintGoalBanner, QuickFilterChipRow, and
   * UnifiedFilterBar renders above the virtualizer and shifts it down.
   */
  const virtualizerWrapperRef = useRef<HTMLDivElement>(null);
  const swimlaneListOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (!virtualizerWrapperRef.current || !scrollElement) return;
    const measure = () => {
      if (!virtualizerWrapperRef.current) return;
      const wrapperRect = virtualizerWrapperRef.current.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      swimlaneListOffsetRef.current = wrapperRect.top - scrollRect.top + scrollElement.scrollTop;
    };
    measure();
    // Re-measure on resize (banners may appear/disappear)
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(scrollElement);
      return () => observer.disconnect();
    }
  }, [scrollElement]);

  /**
   * JS-driven sticky header: on scroll, determine which swimlane header should
   * be pinned. CSS sticky breaks inside virtualizer rows (position:absolute +
   * transform creates a containing block that confines sticky). Instead, we
   * report the current swimlane to the parent which renders a fixed overlay
   * outside the scroll flow.
   */
  const onStickyHeaderChangeRef = useRef(onStickyHeaderChange);
  onStickyHeaderChangeRef.current = onStickyHeaderChange;

  // Keep a ref of collapsedStories so the scroll handler can read it without
  // re-subscribing on every collapse/expand toggle.
  const collapsedStoriesRef = useRef(collapsedStories);
  collapsedStoriesRef.current = collapsedStories;

  // Keep a ref of filteredSwimlanes so the scroll handler always has the latest
  // data without needing filteredSwimlanes in the useEffect dep array.
  // Including filteredSwimlanes (a new array every render) in deps caused an infinite
  // loop: effect runs → onScroll() → setStickyHeader(new object) → re-render →
  // new filteredSwimlanes ref → effect runs again → repeat.
  const filteredSwimlanesRef = useRef(filteredSwimlanes);
  filteredSwimlanesRef.current = filteredSwimlanes;

  // Track the last reported sticky header key and expanded state so we avoid calling
  // setStickyHeader when the pinned swimlane hasn't actually changed (avoids spurious re-renders).
  const lastStickyKeyRef = useRef<string | null>(null);
  const lastStickyExpandedRef = useRef<boolean>(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ref.current values are intentionally not deps (refs don't trigger re-renders)
  useEffect(() => {
    // Clear any stale sticky header from previous render/reload
    if (lastStickyKeyRef.current !== null) {
      lastStickyKeyRef.current = null;
      lastStickyExpandedRef.current = true;
      onStickyHeaderChangeRef.current(null);
    }

    if (!scrollElement || filteredSwimlanesRef.current.length === 0) {
      return;
    }

    function onScroll() {
      const scrollTop = scrollElement?.scrollTop ?? 0;
      const listOffset = swimlaneListOffsetRef.current;

      // scrollTop relative to the start of the virtualizer list
      const relativeScroll = scrollTop - listOffset;

      if (relativeScroll <= 0) {
        if (lastStickyKeyRef.current !== null) {
          lastStickyKeyRef.current = null;
          onStickyHeaderChangeRef.current(null);
        }
        return;
      }

      // Find the swimlane whose range contains the current scroll position.
      // Walk visible virtual items backwards to find the last one whose start <= relativeScroll.
      const items = swimlaneVirtualizer.getVirtualItems();
      if (items.length === 0) {
        if (lastStickyKeyRef.current !== null) {
          lastStickyKeyRef.current = null;
          onStickyHeaderChangeRef.current(null);
        }
        return;
      }

      let foundIndex: number | null = null;
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].start <= relativeScroll) {
          foundIndex = items[i].index;
          break;
        }
      }

      if (foundIndex === null) {
        if (lastStickyKeyRef.current !== null) {
          lastStickyKeyRef.current = null;
          onStickyHeaderChangeRef.current(null);
        }
        return;
      }

      const swimlane = filteredSwimlanesRef.current[foundIndex];
      if (!swimlane) {
        if (lastStickyKeyRef.current !== null) {
          lastStickyKeyRef.current = null;
          onStickyHeaderChangeRef.current(null);
        }
        return;
      }

      // Push-out offset: apply directly to DOM for 60fps smoothness.
      // When the next swimlane's header approaches from below, slide the pinned
      // header upward pixel-by-pixel.
      const HEADER_HEIGHT = 37; // StoryHeaderRow height in px (py-2 + text = ~37)
      const currentItem = items.find((v) => v.index === foundIndex);
      let pushOffset = 0;
      if (currentItem) {
        const swimlaneEnd = currentItem.start + currentItem.size;
        const headerBottom = relativeScroll + HEADER_HEIGHT;
        if (headerBottom > swimlaneEnd) {
          pushOffset = headerBottom - swimlaneEnd;
        }
      }

      const newKey = swimlane.story.key;
      const isExpanded = !collapsedStoriesRef.current.has(swimlane.story.key);
      const keyChanged = lastStickyKeyRef.current !== newKey;

      // Apply push offset directly to the DOM — avoids React re-render per scroll frame.
      // Skip during a swap: the old header is still rendered and resetting its transform
      // would snap it back into view for one frame before React swaps content.
      if (!keyChanged && stickyHeaderInnerRef.current) {
        stickyHeaderInnerRef.current.style.transform =
          pushOffset > 0 ? `translateY(-${pushOffset}px)` : '';
      }

      if (keyChanged || lastStickyExpandedRef.current !== isExpanded) {
        // Hide overlay immediately during swap — useLayoutEffect in parent
        // will show it after React commits the new header content (no flicker).
        if (keyChanged && lastStickyKeyRef.current !== null && stickyOverlayRef.current) {
          stickyOverlayRef.current.style.visibility = 'hidden';
        }
        lastStickyKeyRef.current = newKey;
        lastStickyExpandedRef.current = isExpanded;
        onStickyHeaderChangeRef.current({
          story: swimlane.story,
          subtasks: swimlane.subtasks,
          isExpanded,
        });
      }
    }

    scrollElement.addEventListener('scroll', onScroll, { passive: true });
    // Run once immediately to sync sticky header with current scroll position
    onScroll();
    return () => scrollElement.removeEventListener('scroll', onScroll);
    // filteredSwimlanes intentionally excluded — accessed via ref to avoid infinite loop.
    // swimlaneVirtualizer is included to re-register the listener when virtual items change.
  }, [scrollElement, swimlaneVirtualizer]);

  function renderSwimlane(
    swimlane: { story: JiraIssue; subtasks: JiraIssue[] },
    measureRef?: (node: HTMLElement | null) => void,
    dataIndex?: number,
    style?: React.CSSProperties,
  ) {
    const { story, subtasks } = swimlane;
    const isExpanded = !collapsedStories.has(story.key);
    const cards = subtasks.length > 0 ? subtasks : [story];
    const storyEpicKey = story.fields[epicLinkFieldKey] as string | null;
    const storyEpicName = storyEpicKey ? (epicNameMap.get(storyEpicKey) ?? storyEpicKey) : null;
    const storyEpicColorResult = storyEpicKey
      ? epicColorToTailwind(epicColorMap.get(storyEpicKey) ?? null, storyEpicKey)
      : null;

    return (
      <div
        key={story.key}
        ref={measureRef}
        data-index={dataIndex}
        style={style}
        className="border-b border-border/40"
      >
        <div className="bg-background">
          <StoryHeaderRow
            storyKey={story.key}
            summary={story.fields.summary}
            statusName={story.fields.status.name}
            statusCategoryKey={story.fields.status.statusCategory?.key ?? 'new'}
            subtaskCount={subtasks.length}
            isExpanded={isExpanded}
            onToggle={() => toggleStory(story.key)}
            onOpenDetail={setSelectedIssueKey}
            transitions={getTransitions(story)}
            onTransition={(tid, name, toId, catKey) =>
              onTransition(story.key, tid, name, toId, catKey)
            }
            transitionError={cardErrors.get(story.key)}
            assigneeAvatarUrl={story.fields.assignee?.avatarUrls['48x48']}
            assigneeDisplayName={story.fields.assignee?.displayName}
            epicKey={storyEpicKey}
            epicName={storyEpicName}
            epicColorResult={storyEpicColorResult}
            onEpicClick={setSelectedIssueKey}
            isFlagged={isIssueFlagged(story, flaggedFieldKey)}
            onToggleFlag={() => onToggleFlag(story.key)}
          />
        </div>
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="flex bg-muted/10">
              {CATEGORY_COLUMNS.map((col) => {
                const colCards = cards.filter((c) => categoryOf(c) === col.key);
                // Drop zones render only in the dragged card's own swimlane (D-04):
                // a transition moves a card across status columns within its story row.
                const isActiveSwimlane = activeId != null && story.key === activeSwimlaneKey;
                const colModel = isActiveSwimlane
                  ? (dropModel?.get(col.key) ?? { kind: 'invalid' as const })
                  : null;
                const isInvalid = colModel?.kind === 'invalid';
                return (
                  <div
                    key={col.key}
                    className={`flex-1 min-w-0 min-h-[80px] flex flex-col gap-1.5 p-2 border-l border-border/20${isInvalid ? ' opacity-40 transition-opacity duration-150' : ''}`}
                  >
                    {subtasksLoading ? (
                      <Skeleton className="h-8 w-full" />
                    ) : colModel?.kind === 'split' ? (
                      // D-01: multi-transition column — render per-transition drop zones
                      <div className="flex flex-col gap-1 h-full">
                        {colModel.zones.map((zone) => (
                          <TransitionDropZone
                            key={zone.transitionId}
                            id={`zone:${zone.transitionId}`}
                            label={zone.transitionName}
                            categoryKey={col.key}
                          />
                        ))}
                      </div>
                    ) : colModel?.kind === 'single' ? (
                      // D-02: single-transition column — one labelled drop zone, same
                      // visual as split. The col: id resolves via the column model.
                      <div className="flex flex-col gap-1 h-full">
                        <TransitionDropZone
                          id={`col:${col.key}`}
                          label={colModel.zone.transitionName}
                          categoryKey={col.key}
                        />
                      </div>
                    ) : colModel?.kind === 'invalid' ? (
                      // D-06: zero-transition column — dim + register as droppable (resolves to null)
                      <SingleColumnDroppable id={`col:${col.key}`}>
                        {colCards.map((card) => (
                          <TaskCard
                            key={card.key}
                            issue={card}
                            isSubtask={card.fields.issuetype.subtask}
                            showStatus
                            onOpenIssue={onOpenIssue}
                            onIssueClick={setSelectedIssueKey}
                            transitions={getTransitions(card)}
                            onTransition={(tid, name, toId, catKey) =>
                              onTransition(card.key, tid, name, toId, catKey)
                            }
                            transitionError={cardErrors.get(card.key)}
                            isFlagged={isIssueFlagged(card, flaggedFieldKey)}
                            onToggleFlag={() => onToggleFlag(card.key)}
                            timeInColumn={
                              (card as { timeInColumn?: { enteredStatus: number } }).timeInColumn
                            }
                            isDraggable={!!card.fields.issuetype.subtask}
                            justDragged={justDragged}
                          />
                        ))}
                      </SingleColumnDroppable>
                    ) : (
                      // Not dragging — normal render
                      colCards.map((card) => (
                        <TaskCard
                          key={card.key}
                          issue={card}
                          isSubtask={card.fields.issuetype.subtask}
                          showStatus
                          onOpenIssue={onOpenIssue}
                          onIssueClick={setSelectedIssueKey}
                          transitions={getTransitions(card)}
                          onTransition={(tid, name, toId, catKey) =>
                            onTransition(card.key, tid, name, toId, catKey)
                          }
                          transitionError={cardErrors.get(card.key)}
                          isFlagged={isIssueFlagged(card, flaggedFieldKey)}
                          onToggleFlag={() => onToggleFlag(card.key)}
                          timeInColumn={
                            (card as { timeInColumn?: { enteredStatus: number } }).timeInColumn
                          }
                          isDraggable={!!card.fields.issuetype.subtask}
                          justDragged={justDragged}
                        />
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (useVirtual) {
    return (
      <div
        ref={virtualizerWrapperRef}
        style={{
          height: `${swimlaneVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const swimlane = filteredSwimlanes[virtualRow.index];
          return renderSwimlane(swimlane, swimlaneVirtualizer.measureElement, virtualRow.index, {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
          });
        })}
      </div>
    );
  }

  // Fallback: render all swimlanes without virtualization (jsdom, SSR, etc.)
  // CSS sticky works correctly here since there's no position:absolute.
  return (
    <div ref={virtualizerWrapperRef} className="flex flex-col">
      {filteredSwimlanes.map((swimlane) => {
        const { story, subtasks } = swimlane;
        const isExpanded = !collapsedStories.has(story.key);
        const cards = subtasks.length > 0 ? subtasks : [story];
        const fallbackEpicKey = story.fields[epicLinkFieldKey] as string | null;
        const fallbackEpicName = fallbackEpicKey
          ? (epicNameMap.get(fallbackEpicKey) ?? fallbackEpicKey)
          : null;
        const fallbackEpicColorResult = fallbackEpicKey
          ? epicColorToTailwind(epicColorMap.get(fallbackEpicKey) ?? null, fallbackEpicKey)
          : null;

        return (
          <div key={story.key} className="border-b border-border/40">
            <div className="sticky top-0 z-[9] bg-background">
              <StoryHeaderRow
                storyKey={story.key}
                summary={story.fields.summary}
                statusName={story.fields.status.name}
                statusCategoryKey={story.fields.status.statusCategory?.key ?? 'new'}
                subtaskCount={subtasks.length}
                isExpanded={isExpanded}
                onToggle={() => toggleStory(story.key)}
                onOpenDetail={setSelectedIssueKey}
                transitions={getTransitions(story)}
                onTransition={(tid, name, toId, catKey) =>
                  onTransition(story.key, tid, name, toId, catKey)
                }
                transitionError={cardErrors.get(story.key)}
                assigneeAvatarUrl={story.fields.assignee?.avatarUrls['48x48']}
                assigneeDisplayName={story.fields.assignee?.displayName}
                epicKey={fallbackEpicKey}
                epicName={fallbackEpicName}
                epicColorResult={fallbackEpicColorResult}
                onEpicClick={setSelectedIssueKey}
                isFlagged={isIssueFlagged(story, flaggedFieldKey)}
                onToggleFlag={() => onToggleFlag(story.key)}
              />
            </div>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden min-h-0">
                <div className="flex bg-muted/10">
                  {CATEGORY_COLUMNS.map((col) => {
                    const colCards = cards.filter((c) => categoryOf(c) === col.key);
                    // Drop zones render only in the dragged card's own swimlane (D-04).
                    const isActiveSwimlane = activeId != null && story.key === activeSwimlaneKey;
                    const colModel = isActiveSwimlane
                      ? (dropModel?.get(col.key) ?? { kind: 'invalid' as const })
                      : null;
                    const isInvalid = colModel?.kind === 'invalid';
                    return (
                      <div
                        key={col.key}
                        className={`flex-1 min-w-0 min-h-[80px] flex flex-col gap-1.5 p-2 border-l border-border/20${isInvalid ? ' opacity-40 transition-opacity duration-150' : ''}`}
                      >
                        {subtasksLoading ? (
                          <Skeleton className="h-8 w-full" />
                        ) : colModel?.kind === 'split' ? (
                          <div className="flex flex-col gap-1 h-full">
                            {colModel.zones.map((zone) => (
                              <TransitionDropZone
                                key={zone.transitionId}
                                id={`zone:${zone.transitionId}`}
                                label={zone.transitionName}
                                categoryKey={col.key}
                              />
                            ))}
                          </div>
                        ) : colModel?.kind === 'single' ? (
                          // D-02: single-transition column — one labelled drop zone.
                          <div className="flex flex-col gap-1 h-full">
                            <TransitionDropZone
                              id={`col:${col.key}`}
                              label={colModel.zone.transitionName}
                              categoryKey={col.key}
                            />
                          </div>
                        ) : colModel?.kind === 'invalid' ? (
                          <SingleColumnDroppable id={`col:${col.key}`}>
                            {colCards.map((card) => (
                              <TaskCard
                                key={card.key}
                                issue={card}
                                isSubtask={card.fields.issuetype.subtask}
                                showStatus
                                onOpenIssue={onOpenIssue}
                                onIssueClick={setSelectedIssueKey}
                                transitions={getTransitions(card)}
                                onTransition={(tid, name, toId, catKey) =>
                                  onTransition(card.key, tid, name, toId, catKey)
                                }
                                transitionError={cardErrors.get(card.key)}
                                isFlagged={isIssueFlagged(card, flaggedFieldKey)}
                                onToggleFlag={() => onToggleFlag(card.key)}
                                timeInColumn={
                                  (card as { timeInColumn?: { enteredStatus: number } })
                                    .timeInColumn
                                }
                                isDraggable={!!card.fields.issuetype.subtask}
                                justDragged={justDragged}
                              />
                            ))}
                          </SingleColumnDroppable>
                        ) : (
                          colCards.map((card) => (
                            <TaskCard
                              key={card.key}
                              issue={card}
                              isSubtask={card.fields.issuetype.subtask}
                              showStatus
                              onOpenIssue={onOpenIssue}
                              onIssueClick={setSelectedIssueKey}
                              transitions={getTransitions(card)}
                              onTransition={(tid, name, toId, catKey) =>
                                onTransition(card.key, tid, name, toId, catKey)
                              }
                              transitionError={cardErrors.get(card.key)}
                              isFlagged={isIssueFlagged(card, flaggedFieldKey)}
                              onToggleFlag={() => onToggleFlag(card.key)}
                              timeInColumn={
                                (card as { timeInColumn?: { enteredStatus: number } }).timeInColumn
                              }
                              isDraggable={!!card.fields.issuetype.subtask}
                              justDragged={justDragged}
                            />
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SprintBoardTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  // WR-02: fine-grained selectors avoid re-rendering the entire sprint
  // board when unrelated settings (sidebar collapse, theme, AIO project,
  // etc.) mutate. Matches the convention used in Sidebar.tsx.
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
  const epicLinkFieldKey = useSettingsStore((s) => s.epicLinkFieldKey);
  const epicNameFieldKey = useSettingsStore((s) => s.epicNameFieldKey);
  const epicColorFieldKey = useSettingsStore((s) => s.epicColorFieldKey);
  const flaggedFieldKey = useSettingsStore((s) => s.flaggedFieldKey);
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  const { boardId } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);
  const { onIssueClick: setSelectedIssueKey, onOpenIssue } = useOutletContext<{
    onIssueClick: (key: string) => void;
    onOpenIssue: (key: string) => void;
  }>();
  const queryClient = useQueryClient();

  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set());
  // Tracks which story keys the user has manually toggled — prevents data polling
  // from overriding user intent (e.g. user expands a done story, polling should not re-collapse it).
  const userToggledRef = useRef<Set<string>>(new Set());
  const toggleStory = (key: string) => {
    userToggledRef.current.add(key);
    setCollapsedStories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    // If toggling the currently-sticky swimlane, update the sticky header directly
    // so the expanded/collapsed state reflects immediately. Without this, the scroll
    // handler races with virtualizer re-measurement and may jump to a different swimlane.
    setStickyHeader((prev) => {
      if (!prev || prev.story.key !== key) return prev;
      return { ...prev, isExpanded: !prev.isExpanded };
    });
  };

  const [localIssues, setLocalIssues] = useState<JiraIssue[]>([]);
  const [cardErrors, setCardErrors] = useState<Map<string, string>>(new Map());

  // Phase 79 (D-04/D-12/D-13): dnd-kit drag state for drag-to-transition.
  const [activeId, setActiveId] = useState<string | null>(null);
  // Width of the dragged card at drag start, so the DragOverlay ghost matches the
  // card's real (column-width) dimensions instead of a fixed size.
  const [activeWidth, setActiveWidth] = useState<number | null>(null);
  const [dropModel, setDropModel] = useState<DropModel | null>(null);
  const isDraggingRef = useRef(false);
  const justDragged = useRef(false);
  // CR-01: monotonic drag token. Incremented on every drag start and captured at
  // the top of handleDragEnd; the async probe IIFE bails after each await if a
  // newer drag has superseded this one (dragTokenRef.current !== token). Prevents
  // a stale probe from opening a dialog / firing a transition over an unrelated
  // in-flight drag.
  const dragTokenRef = useRef(0);

  // REWORK2: when a drag drops into a resolution-capable transition, the card does
  // NOT move yet — instead BoardResolutionDialog opens and we stash everything needed
  // to execute the dragged transition (with fields.resolution) once the user confirms.
  const [pendingResolution, setPendingResolution] = useState<{
    issueKey: string;
    transitionId: string;
    toStatusName: string;
    toStatusId: string;
    toStatusCategoryKey?: string;
    allowedValues: Array<{ id: string; name: string }>;
  } | null>(null);

  // PointerSensor with 150ms delay + 5px tolerance — D-12: short delay so a
  // quick click still opens the peek panel; tolerance prevents accidental drag
  // on a tap. Verbatim from BacklogPage.tsx PATTERNS.md.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  // JS-driven sticky swimlane header — rendered outside the scroll flow so it
  // doesn't interfere with virtualizer layout. Updated by VirtualizedSwimlanes on scroll.
  const [stickyHeader, setStickyHeader] = useState<StickyHeaderData>(null);
  const stickyHeaderInnerRef = useRef<HTMLDivElement | null>(null);
  const stickyOverlayRef = useRef<HTMLDivElement | null>(null);
  // Ref tracks showSkeleton so the stable callback can guard against stale sticky
  // header being set during loading (reload race condition).
  const showSkeletonRef = useRef(true);

  // After React commits new sticky header content, reset transform and show overlay.
  // useLayoutEffect fires after DOM mutation but before browser paint — no flicker.
  useLayoutEffect(() => {
    if (stickyOverlayRef.current) {
      stickyOverlayRef.current.style.visibility = stickyHeader ? 'visible' : 'hidden';
    }
    if (stickyHeaderInnerRef.current) {
      stickyHeaderInnerRef.current.style.transform = '';
    }
  }, [stickyHeader]);

  // Stable callback — avoids re-creating the VirtualizedSwimlanes scroll listener
  // on every SprintBoardTab render just because the prop reference changed.
  const handleStickyHeaderChange = useCallback((data: StickyHeaderData) => {
    // Don't set sticky header while skeleton is showing (data not ready yet)
    if (showSkeletonRef.current && data !== null) return;
    setStickyHeader(data);
  }, []);

  // Scroll container — the inner scrollable area below the fixed column headers.
  // Using our own scroll container instead of <main> so column headers stay fixed.
  const boardRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setScrollElement(scrollContainerRef.current);
  }, []);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  // Phase 73 Plan 02 (D-01, D-03, D-04, D-04b, R-01, R-02, R-04, GH-BOARD-01/03/04):
  // The legacy 2-query path (sprint stories + sprint subtasks REST) is gone.
  // SprintBoardTab now reads a single allData envelope, adapts issues via the
  // Phase 71 createAdapter, and lets `statusCategory.key` drive the 3-bucket UI.
  // R-02 keeps the `activeSprint` REST query — see below.
  const {
    data: allData,
    isLoading: storiesLoading,
    isFetching: storiesFetching,
    isError,
    error,
    dataUpdatedAt,
  } = useGhAllData(boardId ?? null);

  // D-01: raw envelope returned by useGhAllData; adaptation is caller-side via
  // useMemo (per the planned discretion). entityMaps and the per-issue adapt()
  // are memoised on `allData` so we don't re-run N × adapter on every render.
  const entityMaps = useMemo(() => (allData ? buildEntityMaps(allData) : null), [allData]);
  const adapt = useMemo(
    () => (entityMaps ? createAdapter({ storyPointsFieldKey, entityMaps }) : null),
    [storyPointsFieldKey, entityMaps],
  );
  const adaptedIssues = useMemo(() => {
    if (!allData || !adapt) return [] as JiraIssue[];
    return allData.issuesData.issues.map((gh) => {
      // D-04b: orphan-subtask observability — parentId present, parentKey
      // absent means the parent is NOT in the sprint envelope. The adapter
      // will not synthesise `fields.parent`, so the card naturally falls into
      // its statusCategory bucket as a standalone row. The warnOnce call is
      // the deterministic signal for ops/debugging.
      if (gh.parentId !== undefined && gh.parentKey === undefined) {
        warnOnce('orphan-subtask', String(gh.parentId));
      }
      return adapt(gh) as JiraIssue;
    });
  }, [allData, adapt]);

  // Plan 02 keeps subtasksLoading as a no-op (there are no more subtask queries).
  // The skeleton inside each column was previously gated on it; collapsing it
  // to `false` means cards render as soon as `allData` resolves.
  const subtasksLoading = false;

  // `data` mirrors the legacy two-query merge: defined whenever the envelope
  // has resolved (even to zero issues, which is the empty-board state).
  const data = allData ? adaptedIssues : undefined;
  const isLoading = storiesLoading;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const showSkeleton = useDelayedLoading(isLoading) || isRefreshing;

  useEffect(() => {
    if (isRefreshing && !storiesFetching) setIsRefreshing(false);
  }, [isRefreshing, storiesFetching]);

  // Keep showSkeletonRef in sync for the stable handleStickyHeaderChange callback
  // and clear stale sticky header when data finishes loading (fixes stuck header on reload)
  const prevShowSkeletonRef = useRef(true);
  useEffect(() => {
    showSkeletonRef.current = showSkeleton;
    if (prevShowSkeletonRef.current && !showSkeleton) {
      setStickyHeader(null);
      if (stickyHeaderInnerRef.current) {
        stickyHeaderInnerRef.current.style.transform = '';
      }
    }
    prevShowSkeletonRef.current = showSkeleton;
  }, [showSkeleton]);

  // Fetch epic names for filter display (shared cache with EpicsPage)
  const { data: epicsBasic } = useQuery({
    queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchEpicsBasic(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        epicNameFieldKey,
        epicColorFieldKey,
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });
  // WR-05: memoise per-epicsBasic to avoid handing fresh Map instances
  // to VirtualizedSwimlanes on every render — defeats child memoisation
  // and the scroll-handler's ref-stable design.
  const epicNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of epicsBasic ?? []) m.set(e.key, e.epicName);
    return m;
  }, [epicsBasic]);
  const epicColorMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of epicsBasic ?? []) m.set(e.key, e.color ?? '');
    return m;
  }, [epicsBasic]);

  // Fetch active sprint (for goal text and board ID)
  const { data: activeSprint } = useQuery({
    queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
    queryFn: () =>
      fetchActiveSprint(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        boardId ?? undefined,
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  const [bannerDismissed, setBannerDismissed] = useState(false);
  // WR-06: reset the stale-data banner dismissal when the user switches
  // boards — a dismissal on board A should not silence the banner for
  // board B.
  // biome-ignore lint/correctness/useExhaustiveDependencies: boardId is an intentional re-run trigger (WR-06) — switching boards must reset the dismissal even though the body doesn't reference boardId.
  useEffect(() => {
    setBannerDismissed(false);
  }, [boardId]);

  /** Used for filter options — maps workflow status names */
  const { data: workflowStatuses } = useQuery({
    queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchProjectStatuses(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? ''),
    staleTime: Infinity,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  useEffect(() => {
    setLocalIssues(data ?? []);
  }, [data]);

  // Phase 72 (Plan 02): warm the GreenHopper transitions envelope once per
  // project mount. Phase 73 R-04: `adaptIssue` does NOT populate
  // `fields.project`, so we MUST source projectId from the raw GH envelope —
  // `allData.issuesData.issues[0]?.projectId` — not from `localIssues[0]`.
  // The sentinel issuetype id still comes from `localIssues[0]` since the
  // adapter preserves `fields.issuetype.id` is absent on AdaptedIssue too —
  // fall back to the raw envelope when needed.
  const sentinelProjectId =
    (allData?.issuesData.issues[0] as { projectId?: number } | undefined)?.projectId ?? 0;
  const sentinelIssueTypeId =
    localIssues[0]?.fields.issuetype?.id ??
    String(
      (allData?.issuesData.issues[0] as { typeId?: string | number } | undefined)?.typeId ?? '',
    );
  // WR-03: useGhTransitions internally gates with
  // `enabled: projectId > 0 && !!issueTypeId` (see
  // services/jira/greenhopper/transitions.ts), so passing the sentinel
  // (0, '') fallbacks here is safe — the query stays disabled until the
  // envelope resolves with at least one issue.
  useGhTransitions(sentinelProjectId, sentinelIssueTypeId);

  function getTransitions(issue: JiraIssue): JiraTransition[] | undefined {
    // Sync peek: envelope + status map are warmed once per project by the
    // sentinel useGhTransitions above, so any (projectId, issueTypeId) — including
    // subtask types whose per-type query was never registered — resolves from cache.
    // Phase 73 R-04: AdaptedIssue does NOT carry `fields.project`; fall back to
    // the sprint-board sentinel projectId derived from the raw GH envelope.
    const projectId = Number(issue.fields.project?.id ?? 0) || sentinelProjectId;
    const all = peekGhTransitions(queryClient, projectId, issue.fields.issuetype?.id ?? '');
    if (!all) return undefined;
    // The GH envelope returns every transition in the workflow regardless of
    // source status; filter down to the ones available from this card's current
    // status (plus global transitions). Mirrors the legacy per-issue REST behavior.
    return filterTransitionsForStatus(all, issue.fields.status?.id);
  }

  // Phase 73 Plan 03 (D-07 / D-07a / R-01 / R-02 / R-04): single "Reload board"
  // toolbar action. Replaces Phase 72's "Reload workflow transitions" item AND
  // the bare "Refresh" icon button. Invalidates FIVE query keys per the
  // updated invalidation set in CONTEXT.md §"Updated invalidation set for
  // 'Reload board'". 3-second aria-live auto-clear mirrors the prior pattern.
  const [reloadBoardStatus, setReloadBoardStatus] = useState<string | null>(null);
  useEffect(() => {
    if (!reloadBoardStatus) return;
    const t = setTimeout(() => setReloadBoardStatus(null), 3000);
    return () => clearTimeout(t);
  }, [reloadBoardStatus]);

  // Phase 79 drag handlers ─────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    // CR-01: bump the drag token so any still-pending probe from a previous drag
    // (whose async IIFE captured the old token) will bail before mutating state.
    dragTokenRef.current += 1;
    const issueKey = active.id as string;
    setActiveId(issueKey);
    // Capture the dragged card's measured width so the ghost keeps its real
    // dimensions (columns are flex-1, so width varies by viewport/board).
    setActiveWidth(active.rect.current.initial?.width ?? null);
    isDraggingRef.current = true;

    // Build the drop model for the dragged card: get all transitions from cache,
    // filter to reachable + droppable (no screen/validators — D-07), then bucket
    // into the per-column model. If transitions aren't warm yet (A1 assumption:
    // graceful), use an empty list so every column is invalid (snap-back).
    const draggedIssue = localIssues.find((i) => i.key === issueKey);
    if (draggedIssue) {
      const allTransitions = getTransitions(draggedIssue) ?? [];
      const droppable = filterDroppableTransitions(allTransitions, draggedIssue.fields.status?.id);
      setDropModel(buildDropModel(droppable));
    } else {
      setDropModel(buildDropModel([]));
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    isDraggingRef.current = false;
    setActiveId(null);
    setActiveWidth(null);
    setDropModel(null);

    // D-12: 50ms guard prevents the card's onClick from firing after a drop
    // (the pointer-up that ends the drag can also trigger click). Mirrors
    // BacklogPage.tsx handleDragEnd + BacklogRow.tsx onClick guard.
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 50);

    if (!over) return;

    const transitionId = resolveDropTransitionId(over.id as string, dropModel ?? new Map());
    if (transitionId === null) return; // D-06: invalid/own column — silent snap-back

    // Resolve the target transition's to-status fields for the optimistic update.
    // Look in the drop model we computed at drag start.
    const issueKey = active.id as string;
    const draggedIssue = localIssues.find((i) => i.key === issueKey);
    if (!draggedIssue) return;

    const allTransitions = getTransitions(draggedIssue) ?? [];
    const transition = allTransitions.find((t) => t.id === transitionId);
    if (!transition) return;

    // CR-01/CR-02: capture the current drag token. If a newer drag starts before
    // this probe resolves, dragTokenRef.current will have advanced and beginTransition
    // bails after every await so a stale probe can never mutate state for the wrong drag.
    const token = dragTokenRef.current;

    // Route the drop through the SHARED transition flow (same path the right-click
    // context menu uses) so a resolution-capable transition always prompts. The
    // early-return guards above stay SYNCHRONOUS; only the probe + dialog inside
    // beginTransition is async.
    beginTransition(
      issueKey,
      transitionId,
      transition.to.name,
      transition.to.id,
      transition.to.statusCategory?.key,
      { token },
    );
  }

  /**
   * Shared entry point for EVERY board transition (drag-to-column AND right-click
   * context menu). Probes the issue's REST transitions-with-fields and, if the
   * target transition is resolution-capable, opens the resolution picker before
   * executing — so resolution is prompted consistently no matter how the transition
   * was triggered. Non-capable transitions execute immediately (no fields), exactly
   * as before. `opts.token` (drag only) lets a superseded drag's in-flight probe bail.
   */
  function beginTransition(
    issueKey: string,
    transitionId: string,
    toStatusName: string,
    toStatusId: string,
    toStatusCategoryKey?: string,
    opts?: { token?: number },
  ) {
    const token = opts?.token;
    // Stale only applies to drag (token provided); context-menu calls pass none.
    const isStale = () => token !== undefined && dragTokenRef.current !== token;

    // CR-01/CR-02: never overwrite an already-open resolution dialog — drop the new
    // request and surface a card error rather than clobbering pendingResolution
    // (whose dialog's internal selection belongs to the first issue).
    if (pendingResolution !== null) {
      setCardErrors((prev) =>
        new Map(prev).set(issueKey, 'Finish the open resolution dialog before moving another card'),
      );
      return;
    }

    // GH metadata for the issue's current status (cache key) and hasScreen (WR-02).
    const issue = localIssues.find((i) => i.key === issueKey);
    const currentStatusId = issue?.fields.status?.id ?? '';
    const ghTransition = issue
      ? (getTransitions(issue) ?? []).find((t) => t.id === transitionId)
      : undefined;
    const hasScreen = ghTransition?.hasScreen ?? false;

    void (async () => {
      let meta: import('@/services/jira').JiraTransitionWithFields | undefined;
      try {
        const list = await queryClient.fetchQuery({
          queryKey: transitionsWithFieldsKey(issueKey, jiraBaseUrl ?? '', currentStatusId),
          queryFn: () =>
            fetchIssueTransitionsWithFields(jiraBaseUrl ?? '', jiraToken ?? '', issueKey),
          staleTime: Number.POSITIVE_INFINITY,
        });
        if (isStale()) return;
        meta = list.find((t) => t.id === transitionId);
      } catch {
        if (isStale()) return;
        // WR-02: probe failure. If the target has a transition screen, a resolution
        // may be REQUIRED — firing a plain transition would 400 after an optimistic
        // move. Surface a retryable card error instead. Otherwise fall back to plain.
        if (hasScreen) {
          setCardErrors((prev) =>
            new Map(prev).set(issueKey, 'Could not load resolution options — try again'),
          );
          return;
        }
        void handleTransition(
          issueKey,
          transitionId,
          toStatusName,
          toStatusId,
          toStatusCategoryKey,
        );
        return;
      }

      const decision = resolveDropResolution(meta);
      if (decision.kind === 'dialog') {
        // Re-check after the await: never clobber a dialog opened meanwhile.
        if (isStale() || pendingResolution !== null) return;
        // Resolution-capable: open the picker. Do NOT optimistically move the card.
        setPendingResolution({
          issueKey,
          transitionId,
          toStatusName,
          toStatusId,
          toStatusCategoryKey,
          allowedValues: decision.allowedValues,
        });
        return;
      }
      if (decision.kind === 'block') {
        if (isStale()) return;
        // WR-01: clear any pending dialog for THIS issue so a stale picker can't
        // remain open alongside the block error.
        setPendingResolution((prev) => (prev?.issueKey === issueKey ? null : prev));
        // WR-05: resolution required but no allowedValues — fire NO request.
        setCardErrors((prev) =>
          new Map(prev).set(
            issueKey,
            'This transition requires a resolution, but none are available',
          ),
        );
        return;
      }
      if (isStale()) return;
      // decision.kind === 'plain' — immediate transition, no fields.
      void handleTransition(issueKey, transitionId, toStatusName, toStatusId, toStatusCategoryKey);
    })();
  }

  function handleResolutionConfirm(resolution: { id: string } | null) {
    if (!pendingResolution) return;
    const p = pendingResolution;
    void handleTransition(
      p.issueKey,
      p.transitionId,
      p.toStatusName,
      p.toStatusId,
      p.toStatusCategoryKey,
      resolution,
    );
    setPendingResolution(null);
  }

  async function handleReloadBoard() {
    // R-04: projectId sourced from raw GH envelope (not adapted issues).
    const pid = sentinelProjectId;
    try {
      // 1) gh-all-data envelope (Plan 01)
      if (boardId) invalidateGhAllData(queryClient, boardId);
      // 2) gh-transitions (Phase 72)
      if (Number.isFinite(pid) && pid > 0) invalidateGhTransitions(queryClient, pid);
      // 3) jira-statuses
      await queryClient.invalidateQueries({ queryKey: ['jira-statuses'] });
      // 4) jira-active-sprint (R-02: sprint goal stays REST)
      await queryClient.invalidateQueries({
        queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl],
      });
      setReloadBoardStatus('Board reloaded');
    } catch {
      setReloadBoardStatus('Failed to reload board');
    }
  }

  async function handleTransition(
    issueKey: string,
    transitionId: string,
    toStatusName: string,
    toStatusId: string,
    toStatusCategoryKey?: string,
    // REWORK2: optional trailing resolution. Presence-checked via `arguments.length`
    // (NOT truthiness) so a `{ resolution: null }` clear survives and existing
    // context-menu callers — which pass no resolution arg — are unaffected.
    ...resolutionArg: [resolution: { id: string } | null] | []
  ) {
    const hasResolution = resolutionArg.length > 0;
    const resolution = hasResolution ? resolutionArg[0] : undefined;
    const originalIssue = localIssues.find((i) => i.key === issueKey);
    if (!originalIssue) return;

    // Optimistic update
    setLocalIssues((prev) =>
      prev.map((i) =>
        i.key === issueKey
          ? {
              ...i,
              fields: {
                ...i.fields,
                status: {
                  id: toStatusId,
                  name: toStatusName,
                  statusCategory: { key: toStatusCategoryKey ?? 'new' } as {
                    key: 'new' | 'indeterminate' | 'done';
                  },
                },
              },
            }
          : i,
      ),
    );
    setCardErrors((prev) => {
      const m = new Map(prev);
      m.delete(issueKey);
      return m;
    });

    try {
      // REWORK2: when a resolution was supplied (presence, not truthiness), execute
      // the transition WITH fields.resolution; otherwise call with no fields exactly
      // as today. postTransition presence-includes `fields` so a null clear survives.
      if (hasResolution) {
        await postTransition(jiraBaseUrl ?? '', jiraToken ?? '', issueKey, transitionId, {
          resolution,
        });
      } else {
        await postTransition(jiraBaseUrl ?? '', jiraToken ?? '', issueKey, transitionId);
      }
      // Phase 73 Plan 03 (GH-CUT-01): gh-all-data is the sole sprint board
      // data source; the legacy 'jira-sprint-stories' / 'jira-sprint-subtasks'
      // query keys were retired with the hard cutover and no longer have any
      // registered consumers.
      invalidateGhAllData(queryClient, boardId ?? undefined);
      // A board transition also changes this issue's status (and, when a
      // resolution was set, its resolution). The issue-detail sidebar caches that
      // separately, so invalidate it here — otherwise opening the issue shows the
      // stale resolution/status. Mirrors FieldsSection's transition invalidation.
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] });
      // Status changed → the transitions-with-fields gating must be re-read.
      queryClient.invalidateQueries({ queryKey: ['jira-issue-transitions-fields', issueKey] });
    } catch {
      // Rollback to original status
      setLocalIssues((prev) =>
        prev.map((i) =>
          i.key === issueKey
            ? { ...i, fields: { ...i.fields, status: originalIssue.fields.status } }
            : i,
        ),
      );
      setCardErrors((prev) => new Map(prev).set(issueKey, 'Transition failed'));
    }
  }

  async function handleToggleFlag(issueKey: string) {
    const originalIssue = localIssues.find((i) => i.key === issueKey);
    if (!originalIssue) return;

    const currentFlagged = isIssueFlagged(originalIssue, flaggedFieldKey);
    const newFlaggedValue = currentFlagged ? null : [{ value: 'Impediment' }];

    // Optimistic update
    setLocalIssues((prev) =>
      prev.map((i) =>
        i.key === issueKey
          ? { ...i, fields: { ...i.fields, [flaggedFieldKey]: newFlaggedValue } }
          : i,
      ),
    );
    setCardErrors((prev) => {
      const m = new Map(prev);
      m.delete(issueKey);
      return m;
    });

    try {
      await setIssueFlagged(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        issueKey,
        !currentFlagged,
        flaggedFieldKey,
      );
      // Phase 73 Plan 03 (GH-CUT-01): gh-all-data is the sole sprint board
      // data source; the legacy 'jira-sprint-stories' / 'jira-sprint-subtasks'
      // query keys were retired with the hard cutover and no longer have any
      // registered consumers.
      invalidateGhAllData(queryClient, boardId ?? undefined);
    } catch {
      // Rollback
      setLocalIssues((prev) =>
        prev.map((i) =>
          i.key === issueKey
            ? {
                ...i,
                fields: { ...i.fields, [flaggedFieldKey]: originalIssue.fields[flaggedFieldKey] },
              }
            : i,
        ),
      );
      setCardErrors((prev) => new Map(prev).set(issueKey, 'Flag update failed'));
    }
  }

  // WR-05: memoise the per-render partitioning so VirtualizedSwimlanes
  // (and the done-fingerprint effect below) only sees a new reference when
  // localIssues actually changes.
  const storyIssues = useMemo(
    () => localIssues.filter((i) => !i.fields.issuetype.subtask),
    [localIssues],
  );
  const subtaskIssues = useMemo(
    () => localIssues.filter((i) => i.fields.issuetype.subtask),
    [localIssues],
  );
  const swimlanes = useMemo(() => {
    const subtasksByParent = new Map<string, JiraIssue[]>();
    for (const sub of subtaskIssues) {
      const pk = sub.fields.parent?.key;
      if (pk) subtasksByParent.set(pk, [...(subtasksByParent.get(pk) ?? []), sub]);
    }
    return storyIssues.map((story) => ({
      story,
      subtasks: subtasksByParent.get(story.key) ?? [],
    }));
  }, [storyIssues, subtaskIssues]);

  // Stable fingerprint for the done-state of each swimlane — avoids a new array
  // reference every render triggering an infinite re-render loop in the effect below.
  const allDoneFingerprint = useMemo(() => {
    return swimlanes
      .map(({ story, subtasks }) => {
        const storyDone = categoryOf(story) === 'done';
        const allSubsDone =
          subtasks.length === 0 || subtasks.every((st) => categoryOf(st) === 'done');
        return `${story.key}:${storyDone && allSubsDone ? '1' : '0'}`;
      })
      .join(',');
  }, [swimlanes]);

  // Auto-collapse story swimlanes where the story AND all its subtasks are done.
  // Re-runs whenever the done-state of any lane changes (data refresh / initial load).
  // Respects user-toggled lanes — those are never overridden by auto-collapse.
  useEffect(() => {
    if (!allDoneFingerprint) return;
    const autoCollapsed = new Set<string>();
    for (const entry of allDoneFingerprint.split(',')) {
      const [key, done] = entry.split(':');
      if (done === '1') autoCollapsed.add(key);
    }
    setCollapsedStories((prev) => {
      const next = new Set(prev);
      for (const key of autoCollapsed) {
        if (!userToggledRef.current.has(key)) next.add(key);
      }
      for (const key of prev) {
        if (!autoCollapsed.has(key) && !userToggledRef.current.has(key)) next.delete(key);
      }
      return next;
    });
  }, [allDoneFingerprint]);

  const { activeEpics, activeLabels, activeAssignees, activeStatuses, activeLabelFilters } =
    useFilterStore();

  const filterOptionsEpics = new Map<string, string>();
  for (const e of epicsBasic ?? []) filterOptionsEpics.set(e.key, e.epicName);
  for (const issue of localIssues) {
    const epicKey = issue.fields[epicLinkFieldKey] as string | null;
    if (epicKey && !filterOptionsEpics.has(epicKey))
      filterOptionsEpics.set(epicKey, epicNameMap.get(epicKey) ?? epicKey);
  }
  const filterOptionsLabels = new Set<string>();
  const filterOptionsAssignees = new Set<string>();
  for (const issue of localIssues) {
    for (const label of (issue.fields.labels as string[] | undefined) ?? [])
      filterOptionsLabels.add(label);
    if (issue.fields.assignee?.displayName)
      filterOptionsAssignees.add(issue.fields.assignee.displayName);
  }
  const filterOptionsStatuses = new Set<string>();
  for (const s of workflowStatuses ?? []) filterOptionsStatuses.add(s.name);
  for (const issue of localIssues) {
    if (issue.fields.status?.name) filterOptionsStatuses.add(issue.fields.status.name);
  }
  const filterOptions = {
    epics: filterOptionsEpics,
    labels: Array.from(filterOptionsLabels),
    assignees: Array.from(filterOptionsAssignees),
    statuses: Array.from(filterOptionsStatuses).sort(),
  };

  function applyFilters(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => {
      const epicMatch =
        activeEpics.size === 0 ||
        (() => {
          const epicKey = issue.fields[epicLinkFieldKey] as string | null;
          return epicKey != null && activeEpics.has(epicKey);
        })();
      const labelMatch =
        activeLabels.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some((l) => activeLabels.has(l));
      const assigneeMatch =
        activeAssignees.size === 0 ||
        (() => {
          const name = issue.fields.assignee?.displayName ?? '';
          return Array.from(activeAssignees).some((q) =>
            name.toLowerCase().includes(q.toLowerCase()),
          );
        })();
      const statusMatch =
        activeStatuses.size === 0 ||
        (() => {
          const issueStatus = (issue.fields.status?.name ?? '').toLowerCase();
          return Array.from(activeStatuses).some((s) => s.toLowerCase() === issueStatus);
        })();

      // Label chip filters
      const labelChipMatch =
        activeLabelFilters.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some((l) =>
          activeLabelFilters.has(l),
        );

      return epicMatch && labelMatch && assigneeMatch && statusMatch && labelChipMatch;
    });
  }

  let filteredSwimlanes = swimlanes;

  // Apply local filters
  if (
    activeEpics.size > 0 ||
    activeLabels.size > 0 ||
    activeAssignees.size > 0 ||
    activeStatuses.size > 0 ||
    activeLabelFilters.size > 0
  ) {
    filteredSwimlanes = filteredSwimlanes
      .map(({ story, subtasks: sub }) => {
        const storyMatches = applyFilters([story]).length > 0;
        const filteredSubtasks = applyFilters(sub);
        if (!storyMatches && filteredSubtasks.length === 0) return null;
        return { story, subtasks: filteredSubtasks };
      })
      .filter((s): s is { story: JiraIssue; subtasks: JiraIssue[] } => s !== null);
  }

  // Phase 79: the swimlane (story row) that owns the dragged card. Drop zones
  // render only here so a drag doesn't inflate every row's height (scroll jump)
  // or offer transition zones in unrelated story rows.
  const activeSwimlaneKey =
    activeId == null
      ? null
      : (filteredSwimlanes.find(
          (s) => s.story.key === activeId || s.subtasks.some((t) => t.key === activeId),
        )?.story.key ?? null);

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  return (
    <>
      {/*
       * Flex column fills <main>. Column headers stay fixed at top (shrink-0),
       * everything else scrolls in the flex-1 overflow area below.
       * This avoids CSS sticky which breaks with virtualizer transforms.
       */}
      <div ref={boardRef} className="flex flex-col h-full">
        {/* Fixed column headers — never scroll */}
        <div className="shrink-0 bg-background border-b border-border relative h-10 z-20">
          <div className="flex h-full">
            {CATEGORY_COLUMNS.map((col) => {
              const count = localIssues.filter(
                (i) => i.fields.issuetype.subtask && categoryOf(i) === col.key,
              ).length;
              return (
                <div
                  key={col.key}
                  className="flex-1 min-w-0 px-3 flex items-center gap-1.5 border-l border-border/20 first:border-l-0"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                    {col.label}
                  </span>
                  <span className="text-xs text-muted-foreground/70 shrink-0">({count})</span>
                </div>
              );
            })}
          </div>
          {/* Refresh positioned absolutely so it doesn't affect column width distribution */}
          <div className="absolute right-0 top-0 h-full px-3 flex items-center gap-2 bg-background border-l border-border/20">
            <span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>
            {/* Phase 73 Plan 03 — D-07 inline aria-live feedback span. */}
            <span
              role="status"
              aria-live="polite"
              className="text-xs text-muted-foreground hidden sm:inline"
            >
              {reloadBoardStatus ?? ''}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsRefreshing(true);
                setStickyHeader(null);
                void handleReloadBoard();
              }}
              disabled={storiesFetching}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Reload board"
              title="Reload board"
            >
              <RefreshCw className={storiesFetching ? 'size-3 animate-spin' : 'size-3'} />
            </button>
          </div>
        </div>

        {/* Wrapper: relative container so the sticky header can overlay the scroll area */}
        <div className="flex-1 relative min-h-0">
          {/* JS-driven sticky swimlane header — absolutely positioned over the scroll
           *  area so it doesn't push content down or cause duplication. overflow-hidden
           *  + negative translateY creates the classic push-out effect when the next
           *  swimlane's header approaches from below. */}
          <div
            ref={stickyOverlayRef}
            className="absolute top-0 left-0 right-0 z-[9] overflow-hidden pointer-events-none"
            style={{ visibility: 'hidden' }}
          >
            {stickyHeader && (
              <div
                ref={stickyHeaderInnerRef}
                className="bg-background border-b border-border/30 pointer-events-auto"
              >
                <StoryHeaderRow
                  storyKey={stickyHeader.story.key}
                  summary={stickyHeader.story.fields.summary}
                  statusName={stickyHeader.story.fields.status.name}
                  statusCategoryKey={stickyHeader.story.fields.status.statusCategory?.key ?? 'new'}
                  subtaskCount={stickyHeader.subtasks.length}
                  isExpanded={stickyHeader.isExpanded}
                  onToggle={() => toggleStory(stickyHeader.story.key)}
                  onOpenDetail={setSelectedIssueKey}
                  transitions={getTransitions(stickyHeader.story)}
                  onTransition={(tid, name, toId, catKey) =>
                    beginTransition(stickyHeader.story.key, tid, name, toId ?? '', catKey)
                  }
                  transitionError={cardErrors.get(stickyHeader.story.key)}
                  assigneeAvatarUrl={stickyHeader.story.fields.assignee?.avatarUrls['48x48']}
                  assigneeDisplayName={stickyHeader.story.fields.assignee?.displayName}
                  epicKey={stickyHeader.story.fields[epicLinkFieldKey] as string | null}
                  epicName={(() => {
                    const ek = stickyHeader.story.fields[epicLinkFieldKey] as string | null;
                    return ek ? (epicNameMap.get(ek) ?? ek) : null;
                  })()}
                  epicColorResult={(() => {
                    const ek = stickyHeader.story.fields[epicLinkFieldKey] as string | null;
                    return ek ? epicColorToTailwind(epicColorMap.get(ek) ?? null, ek) : null;
                  })()}
                  onEpicClick={setSelectedIssueKey}
                  isFlagged={isIssueFlagged(stickyHeader.story, flaggedFieldKey)}
                  onToggleFlag={() => handleToggleFlag(stickyHeader.story.key)}
                />
              </div>
            )}
          </div>

          {/* Board-scoped DndContext (D-13): wraps ONLY the scrollable content
           * area, not the fixed column headers or AppLayout. Sensors use the
           * Phase 78 foundation verbatim (delay 150ms, tolerance 5px, no
           * modifiers, autoScroll=false). See PATTERNS.md § DndContext JSX. */}
          <DndContext
            sensors={sensors}
            collisionDetection={boardCollisionDetection}
            /* Re-measure droppable rects continuously — robustness for
               virtualized layouts where cards near the viewport edge may
               have stale rects. Verbatim from BacklogPage.tsx L1301. */
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            /* autoScroll DISABLED (UAT P78 final decision). dnd-kit 6.3.1 keys
               its collision/drop-target math off measured rects that it
               scroll-adjusts a frame behind, so during its built-in autoScroll
               *something* always lags the cursor (dnd-kit#1108, unresolved
               upstream). With autoScroll off, everything is frame-accurate.
               Tradeoff: to move a card beyond the visible area, drop + scroll
               + drag again. */
            autoScroll={false}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Scrollable content area */}
            <div ref={scrollContainerRef} className="h-full overflow-auto">
              {/* Loading skeleton */}
              {showSkeleton && <SprintBoardSkeleton />}

              {/* Error state — no cached data */}
              {isError && !data && (
                <div className="m-4">
                  <ErrorState
                    error={error}
                    onRetry={() => {
                      setIsRefreshing(true);
                      invalidateGhAllData(queryClient, boardId ?? undefined);
                    }}
                    viewName="sprint board"
                  />
                </div>
              )}

              {/* Stale data banner — error with cached data */}
              {isError && data && !bannerDismissed && (
                <div className="m-4">
                  <StaleDataBanner
                    onRetry={() => {
                      setIsRefreshing(true);
                      invalidateGhAllData(queryClient, boardId ?? undefined);
                    }}
                    onDismiss={() => setBannerDismissed(true)}
                  />
                </div>
              )}

              {/* Sprint goal banner */}
              {!showSkeleton && !isError && data && activeSprint?.goal && (
                <SprintGoalBanner goal={activeSprint.goal} />
              )}

              {/* Quick filter chip row */}
              {!showSkeleton && !isError && data && (
                <QuickFilterChipRow labels={filterOptions.labels} />
              )}

              {/* Unified filter bar */}
              {!showSkeleton && !isError && data && (
                <UnifiedFilterBar filterOptions={filterOptions} />
              )}

              {/* Empty */}
              {!showSkeleton && !isError && data && swimlanes.length === 0 && (
                <EmptyState
                  icon={Columns3}
                  title="No sprint issues"
                  subtitle="This board will populate when issues are added to the active sprint"
                />
              )}

              {/* Virtualized swimlane rows */}
              {!showSkeleton && !isError && data && filteredSwimlanes.length > 0 && (
                <VirtualizedSwimlanes
                  filteredSwimlanes={filteredSwimlanes}
                  scrollElement={scrollElement}
                  collapsedStories={collapsedStories}
                  toggleStory={toggleStory}
                  setSelectedIssueKey={setSelectedIssueKey}
                  onOpenIssue={onOpenIssue}
                  cardErrors={cardErrors}
                  subtasksLoading={subtasksLoading}
                  onStickyHeaderChange={handleStickyHeaderChange}
                  stickyHeaderInnerRef={stickyHeaderInnerRef}
                  stickyOverlayRef={stickyOverlayRef}
                  getTransitions={getTransitions}
                  onTransition={(issueKey, tid, name, toId, catKey) =>
                    beginTransition(issueKey, tid, name, toId ?? '', catKey)
                  }
                  epicNameMap={epicNameMap}
                  epicColorMap={epicColorMap}
                  epicLinkFieldKey={epicLinkFieldKey}
                  flaggedFieldKey={flaggedFieldKey}
                  onToggleFlag={handleToggleFlag}
                  activeId={activeId}
                  activeSwimlaneKey={activeSwimlaneKey}
                  dropModel={dropModel}
                  justDragged={justDragged}
                />
              )}
            </div>

            {/* Portaled DragOverlay ghost (D-13): portaled to document.body so
             * the transform coords are in viewport space — inside the scroll
             * container the overlay would drift by scroll delta (UAT P78 fix).
             * dropAnimation={null}: disables float-back; the optimistic state
             * update is already live. Ghost uses aria-hidden (UI-SPEC). */}
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {activeId
                  ? (() => {
                      const activeIssue = localIssues.find((i) => i.key === activeId);
                      if (!activeIssue) return null;
                      return (
                        <div
                          className="shadow-lg border border-border bg-card rounded-lg"
                          style={activeWidth != null ? { width: activeWidth } : undefined}
                        >
                          <TaskCard issue={activeIssue} isOverlay />
                        </div>
                      );
                    })()
                  : null}
              </DragOverlay>,
              document.body,
            )}
          </DndContext>
        </div>
      </div>
      {/* REWORK2: board-level resolution picker for drag-to-resolution-capable drops.
       * open iff a resolution-capable drop is pending; cancel/close clears it with NO
       * transition (the card never moved), confirm executes the dragged transition
       * with fields.resolution. */}
      {pendingResolution && (
        <BoardResolutionDialog
          // CR-02: key by issue so the dialog's internal selectedId state fully
          // remounts (resets) when the pending issue changes — a selection made
          // for issue A can never be applied to issue B.
          key={pendingResolution.issueKey}
          open={pendingResolution !== null}
          onOpenChange={(open) => {
            if (!open) setPendingResolution(null);
          }}
          issueKey={pendingResolution.issueKey}
          toStatusName={pendingResolution.toStatusName}
          allowedValues={pendingResolution.allowedValues}
          onConfirm={handleResolutionConfirm}
        />
      )}
    </>
  );
}
