/**
 * PinnedTabStrip -- renders a horizontal strip of pinned issue tabs below the
 * TopBar. All tabs are shown in a scrollable row with drag-to-reorder support
 * via pointer events (HTML5 drag API is unreliable in Tauri WebView).
 *
 * A floating ghost clone follows the cursor during drag.
 *
 * Issue metadata (summary, type) is resolved from the react-query cache --
 * no additional network requests are made.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bug, BookOpen, CheckSquare, CornerDownRight } from 'lucide-react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface PinnedTabStripProps {
  pinnedKeys: string[];
  activeKey: string | null;
  onTabClick: (issueKey: string) => void;
  onTabClose: (issueKey: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

interface ResolvedIssue {
  summary: string;
  issueTypeName: string;
}

function resolveIssueFromCache(
  queryClient: QueryClient,
  issueKey: string,
): ResolvedIssue | undefined {
  type CachedIssue = { key: string; fields: { summary: string; issuetype: { name: string } } };

  const queries = queryClient.getQueriesData<CachedIssue[] | { issues?: CachedIssue[] }>({
    queryKey: ['jira-issues'],
  });
  for (const [, data] of queries) {
    if (!data) continue;
    if ('issues' in data && Array.isArray(data.issues)) {
      const match = data.issues.find((i) => i.key === issueKey);
      if (match) return { summary: match.fields.summary, issueTypeName: match.fields.issuetype.name };
    } else if (Array.isArray(data)) {
      const match = data.find((i) => i.key === issueKey);
      if (match) return { summary: match.fields.summary, issueTypeName: match.fields.issuetype.name };
    }
  }

  const backlogQueries = queryClient.getQueriesData<{
    sprints?: Array<{ issues: CachedIssue[] }>;
    backlog?: CachedIssue[];
  }>({
    queryKey: ['jira-backlog-view'],
  });
  for (const [, data] of backlogQueries) {
    if (!data) continue;
    const match = data.backlog?.find((i) => i.key === issueKey);
    if (match) return { summary: match.fields.summary, issueTypeName: match.fields.issuetype.name };
    if (data.sprints) {
      for (const s of data.sprints) {
        const m = s.issues.find((i) => i.key === issueKey);
        if (m) return { summary: m.fields.summary, issueTypeName: m.fields.issuetype.name };
      }
    }
  }

  const detailQueries = queryClient.getQueriesData<CachedIssue>({
    queryKey: ['jira-issue-detail', issueKey],
  });
  for (const [, data] of detailQueries) {
    if (data?.fields?.summary) {
      return { summary: data.fields.summary, issueTypeName: data.fields.issuetype?.name ?? '' };
    }
  }

  return undefined;
}

function IssueTypeIcon({ typeName }: { typeName: string }) {
  const cls = 'w-4 h-4 shrink-0';
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

interface DragGhost {
  index: number;
  x: number;
  y: number;
  width: number;
  offsetX: number;
}

export default function PinnedTabStrip({
  pinnedKeys,
  activeKey,
  onTabClick,
  onTabClose,
  onReorder,
}: PinnedTabStripProps) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const dragState = useRef<{ index: number; startX: number; didMove: boolean; offsetX: number } | null>(null);
  const didDragRef = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);

  const getDropIndex = useCallback((clientX: number): number | null => {
    let closest: { index: number; dist: number } | null = null;
    tabRefs.current.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - center);
      if (!closest || dist < closest.dist) {
        closest = { index: idx, dist };
      }
    });
    return closest ? closest.index : null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if ((e.target as HTMLElement).closest('[data-close-btn]')) return;
    const el = tabRefs.current.get(index);
    const rect = el?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : 0;
    dragState.current = { index, startX: e.clientX, didMove: false, offsetX };
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;

      if (!state.didMove && Math.abs(e.clientX - state.startX) < 5) return;

      if (!state.didMove) {
        state.didMove = true;
        setDraggingIndex(state.index);
        const el = tabRefs.current.get(state.index);
        const width = el?.getBoundingClientRect().width ?? 160;
        setGhost({ index: state.index, x: e.clientX, y: e.clientY, width, offsetX: state.offsetX });
      } else {
        setGhost((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
      }

      const target = getDropIndex(e.clientX);
      setDropTarget(target);
    };

    const handlePointerUp = () => {
      const state = dragState.current;
      didDragRef.current = !!state?.didMove;
      if (state?.didMove && dropTarget !== null && dropTarget !== state.index) {
        onReorder(state.index, dropTarget);
      }
      dragState.current = null;
      setDraggingIndex(null);
      setDropTarget(null);
      setGhost(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dropTarget, getDropIndex, onReorder]);

  // Render the ghost tab content
  const renderGhost = () => {
    if (!ghost) return null;
    const key = pinnedKeys[ghost.index];
    if (!key) return null;
    const resolved = resolveIssueFromCache(queryClient, key);

    return createPortal(
      <div
        className="fixed z-50 pointer-events-none flex items-center gap-2 px-3 h-12 min-w-[130px] max-w-[220px] rounded-md text-xs font-medium bg-background border border-border shadow-lg opacity-90"
        style={{
          left: ghost.x - ghost.offsetX,
          top: ghost.y - 24,
          width: ghost.width,
        }}
      >
        {resolved ? (
          <IssueTypeIcon typeName={resolved.issueTypeName} />
        ) : (
          <Skeleton className="w-4 h-4 rounded shrink-0" />
        )}
        <div className="flex flex-col min-w-0 text-left">
          <span className="font-mono text-[11px] leading-tight whitespace-nowrap">{key}</span>
          {resolved ? (
            <span className="truncate text-[10px] leading-tight text-muted-foreground">{resolved.summary}</span>
          ) : (
            <Skeleton className="h-2.5 w-16" />
          )}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <>
      <div
        ref={containerRef}
        className="h-14 border-b border-border flex items-end gap-1.5 px-4 flex-shrink-0 bg-background overflow-x-auto overflow-y-hidden no-scrollbar"
        role="tablist"
        aria-label="Pinned issues"
      >
        {pinnedKeys.map((key, index) => {
          const resolved = resolveIssueFromCache(queryClient, key);
          const isDragging = draggingIndex === index;
          const showPlaceholderBefore =
            draggingIndex !== null &&
            dropTarget !== null &&
            dropTarget !== draggingIndex &&
            dropTarget === index &&
            dropTarget < draggingIndex;
          const showPlaceholderAfter =
            draggingIndex !== null &&
            dropTarget !== null &&
            dropTarget !== draggingIndex &&
            dropTarget === index &&
            dropTarget > draggingIndex;

          return (
            <div key={key} className="flex items-end gap-1.5 shrink-0">
              {showPlaceholderBefore && (
                <div className="h-12 min-w-[130px] max-w-[220px] shrink-0 rounded-t-md border-2 border-dashed border-primary/30 bg-primary/5" style={{ width: ghost?.width }} />
              )}
              <div
                ref={(el) => { if (el) tabRefs.current.set(index, el); else tabRefs.current.delete(index); }}
                role="tab"
                tabIndex={0}
                aria-selected={key === activeKey}
                onPointerDown={(e) => handlePointerDown(e, index)}
                onClick={() => {
                  if (didDragRef.current) { didDragRef.current = false; return; }
                  onTabClick(key);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabClick(key); }}
                className={cn(
                  'flex items-center gap-2 px-3 h-12 min-w-[130px] max-w-[220px] shrink-0 rounded-t-md text-xs font-medium border-b-2 transition-colors group select-none',
                  key === activeKey
                    ? 'border-primary text-foreground bg-muted/50'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                  isDragging && dropTarget !== null && dropTarget !== draggingIndex && 'opacity-0 !min-w-0 !w-0 !px-0 !gap-0 !mx-0 overflow-hidden',
                  isDragging && (dropTarget === null || dropTarget === draggingIndex) && 'opacity-30',
                  draggingIndex !== null ? 'cursor-grabbing' : 'cursor-grab',
                )}
              >
                {resolved ? (
                  <IssueTypeIcon typeName={resolved.issueTypeName} />
                ) : (
                  <Skeleton className="w-4 h-4 rounded shrink-0" />
                )}
                <div className="flex flex-col min-w-0 text-left">
                  <span className="font-mono text-[11px] leading-tight whitespace-nowrap">{key}</span>
                  {resolved ? (
                    <span className="truncate text-[10px] leading-tight text-muted-foreground">{resolved.summary}</span>
                  ) : (
                    <Skeleton className="h-2.5 w-16" />
                  )}
                </div>
                <button
                  type="button"
                  data-close-btn
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(key);
                  }}
                  className="ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 transition-opacity"
                  aria-label={`Close ${key} tab`}
                >
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              {showPlaceholderAfter && (
                <div className="h-12 min-w-[130px] max-w-[220px] shrink-0 rounded-t-md border-2 border-dashed border-primary/30 bg-primary/5" style={{ width: ghost?.width }} />
              )}
            </div>
          );
        })}
      </div>
      {renderGhost()}
    </>
  );
}
