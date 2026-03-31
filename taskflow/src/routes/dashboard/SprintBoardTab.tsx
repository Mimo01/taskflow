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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bookmark, Columns3, RefreshCw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useIsActiveRoute } from '@/hooks/useIsActiveRoute';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '@/lib/query-constants';
import { UnifiedFilterBar } from '@/components/UnifiedFilterBar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { SprintBoardSkeleton } from './SprintBoardSkeleton';
import type { JiraIssue, JiraTransition } from '@/services/jira';
import {
  fetchEpicsBasic,
  fetchProjectStatuses,
  fetchTransitions,
  postTransition,
} from '@/services/jira';
import { fetchBoardQuickFilters } from '@/services/jira/board-config';
import { fetchAllSearchPages } from '@/services/jira/client';
import { fetchSprintStories, fetchSprintSubtasks } from '@/services/jira/issues';
import { fetchActiveSprint } from '@/services/jira/sprints';
import { useBoardId } from '@/hooks/useBoardId';
import type { JiraBoardQuickFilter } from '@/services/jira/types';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useFilterStore } from '@/stores/filter.store';
import { useSavedFilterStore } from '@/stores/saved-filter.store';
import { useSettingsStore } from '@/stores/settings.store';
import { QuickFilterChipRow } from './QuickFilterChipRow';
import { SprintGoalBanner } from './SprintGoalBanner';
import { StoryHeaderRow } from './StoryHeaderRow';
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

/** Virtualized swimlane list — renders swimlane rows with measureElement for variable heights. */
function VirtualizedSwimlanes({
  filteredSwimlanes,
  scrollElement,
  collapsedStories,
  toggleStory,
  setSelectedIssueKey,
  cardErrors,
  subtasksLoading,
  onStickyHeaderChange,
  stickyHeaderInnerRef,
  getTransitions,
  onTransition,
}: {
  filteredSwimlanes: { story: JiraIssue; subtasks: JiraIssue[] }[];
  scrollElement: HTMLElement | null;
  collapsedStories: Set<string>;
  toggleStory: (key: string) => void;
  setSelectedIssueKey: (key: string) => void;
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
  getTransitions: (issueKey: string) => JiraTransition[] | undefined;
  onTransition: (issueKey: string, transitionId: string, toStatusName: string, toStatusId: string, toStatusCategoryKey?: string) => void;
}) {
  const swimlaneVirtualizer = useVirtualizer({
    count: filteredSwimlanes.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 120,
    overscan: 5,
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
      const scrollTop = scrollElement!.scrollTop;
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

      // Apply push offset directly to the DOM — avoids React re-render per scroll frame
      if (stickyHeaderInnerRef.current) {
        stickyHeaderInnerRef.current.style.transform =
          pushOffset > 0 ? `translateY(-${pushOffset}px)` : '';
      }

      // Only call setStickyHeader when the pinned swimlane or its expanded state changes.
      // Calling it with a new object on every scroll event (even when story is same)
      // would trigger a parent re-render on every scroll frame.
      const newKey = swimlane.story.key;
      const isExpanded = !collapsedStoriesRef.current.has(swimlane.story.key);
      if (lastStickyKeyRef.current !== newKey || lastStickyExpandedRef.current !== isExpanded) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            transitions={getTransitions(story.key)}
            onTransition={(tid, name, toId, catKey) => onTransition(story.key, tid, name, toId, catKey)}
            transitionError={cardErrors.get(story.key)}
            assigneeAvatarUrl={story.fields.assignee?.avatarUrls['48x48']}
            assigneeDisplayName={story.fields.assignee?.displayName}
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
                return (
                  <div
                    key={col.key}
                    className="flex-1 min-h-[80px] flex flex-col gap-1.5 p-2 border-l border-border/20"
                  >
                    {subtasksLoading ? (
                      <Skeleton className="h-8 w-full" />
                    ) : (
                      colCards.map((card) => (
                        <TaskCard
                          key={card.key}
                          issue={card}
                          isSubtask={card.fields.issuetype.subtask}
                          showStatus
                          onClick={() => setSelectedIssueKey(card.key)}
                          transitions={getTransitions(card.key)}
                          onTransition={(tid, name, toId, catKey) => onTransition(card.key, tid, name, toId, catKey)}
                          transitionError={cardErrors.get(card.key)}
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
                transitions={getTransitions(story.key)}
                onTransition={(tid, name, toId, catKey) => onTransition(story.key, tid, name, toId, catKey)}
                transitionError={cardErrors.get(story.key)}
                assigneeAvatarUrl={story.fields.assignee?.avatarUrls['48x48']}
                assigneeDisplayName={story.fields.assignee?.displayName}
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
                    return (
                      <div
                        key={col.key}
                        className="flex-1 min-h-[80px] flex flex-col gap-1.5 p-2 border-l border-border/20"
                      >
                        {subtasksLoading ? (
                          <Skeleton className="h-8 w-full" />
                        ) : (
                          colCards.map((card) => (
                            <TaskCard
                              key={card.key}
                              issue={card}
                              isSubtask={card.fields.issuetype.subtask}
                              showStatus
                              onClick={() => setSelectedIssueKey(card.key)}
                              transitions={getTransitions(card.key)}
                              onTransition={(tid, name, toId, catKey) => onTransition(card.key, tid, name, toId, catKey)}
                              transitionError={cardErrors.get(card.key)}
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
  const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey, epicColorFieldKey } =
    useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  const { boardId } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);
  const { onIssueClick: setSelectedIssueKey } = useOutletContext<{
    onIssueClick: (key: string) => void;
  }>();
  const queryClient = useQueryClient();

  const isActive = useIsActiveRoute('/sprint-board');

  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set());
  // Tracks which story keys the user has manually toggled — prevents data polling
  // from overriding user intent (e.g. user expands a done story, polling should not re-collapse it).
  const userToggledRef = useRef<Set<string>>(new Set());
  const toggleStory = (key: string) => {
    userToggledRef.current.add(key);
    setCollapsedStories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
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

  // JS-driven sticky swimlane header — rendered outside the scroll flow so it
  // doesn't interfere with virtualizer layout. Updated by VirtualizedSwimlanes on scroll.
  const [stickyHeader, setStickyHeader] = useState<StickyHeaderData>(null);
  const stickyHeaderInnerRef = useRef<HTMLDivElement | null>(null);
  // Ref tracks showSkeleton so the stable callback can guard against stale sticky
  // header being set during loading (reload race condition).
  const showSkeletonRef = useRef(true);

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

  const { data: stories, isLoading: storiesLoading, isFetching: storiesFetching, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey],
    queryFn: () =>
      fetchSprintStories(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        false,
        storyPointsFieldKey,
        epicLinkFieldKey,
      ),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  const parentKeys = (stories ?? [])
    .filter((i) => !i.fields.issuetype.subtask)
    .map((i) => i.key)
    .sort(); // Pitfall 1: sorted for stable query key

  const { data: subtasksData, isLoading: subtasksLoading } = useQuery({
    queryKey: ['jira-sprint-subtasks', activeJiraProject, jiraBaseUrl, parentKeys],
    queryFn: () => fetchSprintSubtasks(jiraBaseUrl!, jiraToken!, parentKeys),
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!jiraBaseUrl && !!jiraToken && parentKeys.length > 0,
  });

  const data = useMemo(
    () => (stories ? [...stories, ...(subtasksData ?? [])] : undefined),
    [stories, subtasksData],
  );
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
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        epicNameFieldKey,
        epicColorFieldKey,
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });
  const epicNameMap = new Map<string, string>();
  for (const e of epicsBasic ?? []) epicNameMap.set(e.key, e.epicName);

  // Fetch active sprint (for goal text and board ID)
  const { data: activeSprint } = useQuery({
    queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchActiveSprint(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // Fetch board quick filters using the board ID from useBoardId hook (not activeSprint)
  const { data: boardQuickFilters } = useQuery({
    queryKey: ['jira-board-quickfilters', boardId],
    queryFn: () => fetchBoardQuickFilters(jiraBaseUrl!, jiraToken!, boardId!),
    staleTime: 5 * 60 * 1000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!boardId,
  });

  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  /** Used for filter options — maps workflow status names */
  const { data: workflowStatuses } = useQuery({
    queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchProjectStatuses(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: Infinity,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  useEffect(() => {
    setLocalIssues(data ?? []);
  }, [data]);

  // Pre-fetch transitions for all board cards (used by right-click context menu).
  // Depend only on stable primitives: jiraBaseUrl, jiraToken, and the count of local issues.
  // localIssues itself is read inside the effect via a ref to avoid stale closures without
  // adding the array reference (which changes on every data update) to the dep array.
  const localIssuesRef = useRef(localIssues);
  localIssuesRef.current = localIssues;

  useEffect(() => {
    if (!jiraBaseUrl || !jiraToken || !localIssuesRef.current.length) return;
    const issues = localIssuesRef.current;
    void Promise.allSettled(
      issues.map((issue) =>
        queryClient.fetchQuery({
          queryKey: ['transitions', issue.key],
          queryFn: () => fetchTransitions(jiraBaseUrl, jiraToken!, issue.key),
          staleTime: 5 * 60 * 1000,
        }),
      ),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraBaseUrl, jiraToken, localIssues.length, queryClient]);

  function getTransitions(issueKey: string): JiraTransition[] | undefined {
    return queryClient.getQueryData<JiraTransition[]>(['transitions', issueKey]);
  }

  async function handleTransition(issueKey: string, transitionId: string, toStatusName: string, toStatusId: string, toStatusCategoryKey?: string) {
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
                  statusCategory: { key: toStatusCategoryKey ?? 'new' } as { key: 'new' | 'indeterminate' | 'done' },
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
      await postTransition(jiraBaseUrl!, jiraToken!, issueKey, transitionId);
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-subtasks'] });
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

  const storyIssues = localIssues.filter((i) => !i.fields.issuetype.subtask);
  const subtaskIssues = localIssues.filter((i) => i.fields.issuetype.subtask);
  const subtasksByParent = new Map<string, JiraIssue[]>();
  for (const sub of subtaskIssues) {
    const pk = sub.fields.parent?.key;
    if (pk) subtasksByParent.set(pk, [...(subtasksByParent.get(pk) ?? []), sub]);
  }
  const swimlanes = storyIssues.map((story) => ({
    story,
    subtasks: subtasksByParent.get(story.key) ?? [],
  }));

  // Stable fingerprint for the done-state of each swimlane — avoids a new array
  // reference every render triggering an infinite re-render loop in the effect below.
  const allDoneFingerprint = useMemo(() => {
    return swimlanes
      .map(({ story, subtasks }) => {
        const storyDone = categoryOf(story) === 'done';
        const allSubsDone = subtasks.length === 0 || subtasks.every((st) => categoryOf(st) === 'done');
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

  const {
    activeEpics,
    activeLabels,
    activeAssignees,
    activeStatuses,
    activeJiraQuickFilters,
    activeLabelFilters,
  } = useFilterStore();

  const activeFilterId = useSavedFilterStore((s) => s.activeFilterId);
  const savedFilters = useSavedFilterStore((s) => s.savedFilters);
  const setActiveFilter = useSavedFilterStore((s) => s.setActiveFilter);
  const activeFilter = activeFilterId ? savedFilters.find((f) => f.id === activeFilterId) : null;

  // Saved filter: fetch JQL results to intersect with sprint issues
  const { data: savedFilterIssueKeys, isLoading: isSavedFilterLoading } = useQuery({
    queryKey: ['saved-filter-results', activeFilter?.jql],
    queryFn: async () => {
      const searchUrl = `${jiraBaseUrl!.replace(/\/$/, '')}/rest/api/2/search?jql=${encodeURIComponent(activeFilter!.jql)}&fields=key`;
      const results = await fetchAllSearchPages(searchUrl, {
        Authorization: `Bearer ${jiraToken!}`,
      });
      return new Set(results.map((issue) => issue.key));
    },
    enabled: !!activeFilter?.jql && !!jiraBaseUrl && !!jiraToken,
    staleTime: 30_000,
  });

  const filterOptionsEpics = new Map<string, string>();
  for (const e of epicsBasic ?? []) filterOptionsEpics.set(e.key, e.epicName);
  for (const issue of localIssues) {
    const epicKey = issue.fields[epicLinkFieldKey] as string | null;
    if (epicKey && !filterOptionsEpics.has(epicKey)) filterOptionsEpics.set(epicKey, epicNameMap.get(epicKey) ?? epicKey);
  }
  const filterOptionsLabels = new Set<string>();
  const filterOptionsAssignees = new Set<string>();
  for (const issue of localIssues) {
    for (const label of (issue.fields.labels as string[] | undefined) ?? []) filterOptionsLabels.add(label);
    if (issue.fields.assignee?.displayName) filterOptionsAssignees.add(issue.fields.assignee.displayName);
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
      // Jira board quick filter conditions (AND)
      const qfMatch =
        activeJiraQuickFilters.size === 0 ||
        (() => {
          for (const qfId of activeJiraQuickFilters) {
            const qf = (boardQuickFilters ?? []).find((q: JiraBoardQuickFilter) => q.id === qfId);
            if (qf) {
              const cond = parseSimpleJql(qf.jql);
              if (cond && !evaluateQfCondition(issue, cond)) return false;
            }
          }
          return true;
        })();

      // Label chip filters
      const labelChipMatch =
        activeLabelFilters.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some((l) =>
          activeLabelFilters.has(l),
        );

      return epicMatch && labelMatch && assigneeMatch && statusMatch && qfMatch && labelChipMatch;
    });
  }

  /** Parse simple JQL: "field = value" or "field != value" */
  function parseSimpleJql(jql: string): { field: string; op: string; value: string } | null {
    const match = jql.trim().match(/^(\w+)\s*(=|!=)\s*"?([^"]+)"?$/i);
    if (!match) return null;
    return { field: match[1].toLowerCase(), op: match[2], value: match[3] };
  }

  /** Evaluate a simple JQL condition against a Jira issue */
  function evaluateQfCondition(
    issue: JiraIssue,
    cond: { field: string; op: string; value: string },
  ): boolean {
    let fieldVal: string | undefined;
    switch (cond.field) {
      case 'issuetype':
        fieldVal = issue.fields.issuetype.name;
        break;
      case 'priority':
        fieldVal = (issue.fields as Record<string, unknown>).priority
          ? ((issue.fields as Record<string, unknown>).priority as { name?: string })?.name
          : undefined;
        break;
      case 'assignee':
        fieldVal = issue.fields.assignee?.displayName;
        break;
      case 'status':
        fieldVal = issue.fields.status.name;
        break;
      default:
        return true; // unknown field = pass through
    }
    if (!fieldVal) return cond.op === '!=';
    const isMatch = fieldVal.toLowerCase() === cond.value.toLowerCase();
    return cond.op === '=' ? isMatch : !isMatch;
  }

  let filteredSwimlanes = swimlanes;

  // Saved filter: intersect with JQL result keys
  if (savedFilterIssueKeys && savedFilterIssueKeys.size > 0) {
    filteredSwimlanes = filteredSwimlanes
      .map(({ story, subtasks: sub }) => {
        const storyMatches = savedFilterIssueKeys.has(story.key);
        const filteredSubtasks = sub.filter((s) => savedFilterIssueKeys.has(s.key));
        if (!storyMatches && filteredSubtasks.length === 0) return null;
        return { story, subtasks: filteredSubtasks };
      })
      .filter((s): s is { story: JiraIssue; subtasks: JiraIssue[] } => s !== null);
  }

  // Apply local filters on the (possibly already saved-filter-narrowed) result
  if (
    activeEpics.size > 0 ||
    activeLabels.size > 0 ||
    activeAssignees.size > 0 ||
    activeStatuses.size > 0 ||
    activeJiraQuickFilters.size > 0 ||
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
                  className="flex-1 px-3 flex items-center gap-1.5 border-l border-border/20 first:border-l-0"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {col.label}
                  </span>
                  <span className="text-xs text-muted-foreground/70">({count})</span>
                </div>
              );
            })}
          </div>
          {/* Refresh positioned absolutely so it doesn't affect column width distribution */}
          <div className="absolute right-0 top-0 h-full px-3 flex items-center gap-2 bg-background border-l border-border/20">
            <span className="text-xs text-muted-foreground hidden sm:inline">{lastRefreshed}</span>
            <button
              type="button"
              onClick={() => {
                setIsRefreshing(true);
                setStickyHeader(null);
                queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
        queryClient.invalidateQueries({ queryKey: ['jira-sprint-subtasks'] });
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="size-3" />
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
            className="absolute top-0 left-0 right-0 z-[9] bg-background border-b border-border/30 overflow-hidden transition-[opacity,transform] duration-150 ease-out"
            style={{
              opacity: stickyHeader ? 1 : 0,
              transform: stickyHeader ? 'translateY(0)' : 'translateY(-100%)',
              pointerEvents: stickyHeader ? 'auto' : 'none',
            }}
          >
            {stickyHeader && (
              <div ref={stickyHeaderInnerRef}>
                <StoryHeaderRow
                  storyKey={stickyHeader.story.key}
                  summary={stickyHeader.story.fields.summary}
                  statusName={stickyHeader.story.fields.status.name}
                  statusCategoryKey={stickyHeader.story.fields.status.statusCategory?.key ?? 'new'}
                  subtaskCount={stickyHeader.subtasks.length}
                  isExpanded={stickyHeader.isExpanded}
                  onToggle={() => toggleStory(stickyHeader.story.key)}
                  onOpenDetail={setSelectedIssueKey}
                  transitions={getTransitions(stickyHeader.story.key)}
                  onTransition={(tid, name, toId, catKey) => handleTransition(stickyHeader.story.key, tid, name, toId, catKey)}
                  transitionError={cardErrors.get(stickyHeader.story.key)}
                  assigneeAvatarUrl={stickyHeader.story.fields.assignee?.avatarUrls['48x48']}
                  assigneeDisplayName={stickyHeader.story.fields.assignee?.displayName}
                />
              </div>
            )}
          </div>

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
                    queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
        queryClient.invalidateQueries({ queryKey: ['jira-sprint-subtasks'] });
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
                    queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
        queryClient.invalidateQueries({ queryKey: ['jira-sprint-subtasks'] });
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
              <QuickFilterChipRow
                quickFilters={boardQuickFilters ?? []}
                labels={filterOptions.labels}
                issues={localIssues}
              />
            )}

            {/* Active saved filter banner */}
            {!showSkeleton && !isError && data && activeFilter && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-primary/20">
                <Bookmark className="size-3.5 text-primary" />
                <span className="text-xs font-medium">Filter: {activeFilter.name}</span>
                {isSavedFilterLoading && (
                  <span className="text-xs text-muted-foreground">(loading...)</span>
                )}
                <button
                  type="button"
                  onClick={() => setActiveFilter(null)}
                  className="text-xs text-primary/70 hover:text-primary ml-auto"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Unified filter bar */}
            {!showSkeleton && !isError && data && <UnifiedFilterBar filterOptions={filterOptions} />}

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
                cardErrors={cardErrors}
                subtasksLoading={subtasksLoading}
                onStickyHeaderChange={handleStickyHeaderChange}
                stickyHeaderInnerRef={stickyHeaderInnerRef}
                getTransitions={getTransitions}
                onTransition={handleTransition}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
