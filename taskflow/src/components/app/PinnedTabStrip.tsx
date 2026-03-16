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
import { Bug, BookOpen, CheckSquare, CornerDownRight, Loader2 } from 'lucide-react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
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
  const dragState = useRef<{ index: number; startX: number; startY: number; didMove: boolean; offsetX: number } | null>(null);
  const didDragRef = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [draggedOff, setDraggedOff] = useState(false);

  const getDropIndex = useCallback((clientX: number): number | null => {
    let closestIndex: number | null = null;
    let closestDist = Infinity;
    tabRefs.current.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const center = rect.left + rect.width / 2;
      const dist = Math.abs(clientX - center);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = idx;
      }
    });
    return closestIndex;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    const el = tabRefs.current.get(index);
    const rect = el?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : 0;
    dragState.current = { index, startX: e.clientX, startY: e.clientY, didMove: false, offsetX };
  }, []);

  const DRAG_OFF_THRESHOLD = 40; // pixels below the strip to trigger unpin

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragState.current;
      if (!state) return;

      const dist = Math.sqrt((e.clientX - state.startX) ** 2 + (e.clientY - state.startY) ** 2);
      if (!state.didMove && dist < 5) return;

      if (!state.didMove) {
        state.didMove = true;
        setDraggingIndex(state.index);
        const el = tabRefs.current.get(state.index);
        const width = el?.getBoundingClientRect().width ?? 160;
        setGhost({ index: state.index, x: e.clientX, y: e.clientY, width, offsetX: state.offsetX });
      } else {
        setGhost((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
      }

      // Check if dragged below the strip
      const container = containerRef.current;
      if (container) {
        const stripBottom = container.getBoundingClientRect().bottom;
        setDraggedOff(e.clientY > stripBottom + DRAG_OFF_THRESHOLD);
      }

      const target = getDropIndex(e.clientX);
      setDropTarget(target);
    };

    const handlePointerUp = () => {
      const state = dragState.current;
      didDragRef.current = !!state?.didMove;

      if (state?.didMove && draggedOff) {
        // Dragged off strip — unpin
        const key = pinnedKeys[state.index];
        if (key) onTabClose(key);
      } else if (state?.didMove && dropTarget !== null && dropTarget !== state.index) {
        onReorder(state.index, dropTarget);
      }

      dragState.current = null;
      setDraggingIndex(null);
      setDropTarget(null);
      setGhost(null);
      setDraggedOff(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dropTarget, draggedOff, getDropIndex, onReorder, onTabClose, pinnedKeys]);

  // Render the ghost tab content
  const renderGhost = () => {
    if (!ghost) return null;
    const key = pinnedKeys[ghost.index];
    if (!key) return null;
    const resolved = resolveIssueFromCache(queryClient, key);

    return createPortal(
      <div
        className={cn(
          'fixed z-50 pointer-events-none flex items-center gap-1.5 px-2.5 h-9 rounded-md text-xs font-medium bg-background border shadow-lg transition-opacity duration-100',
          draggedOff
            ? 'border-destructive/50 opacity-50 scale-90'
            : 'border-border opacity-90',
        )}
        style={{
          left: ghost.x - ghost.offsetX,
          top: ghost.y - 18,
          width: ghost.width,
          transform: draggedOff ? 'scale(0.9)' : undefined,
        }}
      >
        {resolved ? (
          <>
            <IssueTypeIcon typeName={resolved.issueTypeName} />
            <div className="flex flex-col min-w-0 leading-none">
              <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">{key}</span>
              <span className="truncate text-[11px] leading-tight">{resolved.summary}</span>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" />
            <span className="font-mono text-[11px] whitespace-nowrap">{key}</span>
          </>
        )}
      </div>,
      document.body,
    );
  };

  return (
    <>
      <div
        ref={containerRef}
        className="h-10 border-b border-border flex items-end gap-1 px-3 flex-shrink-0 bg-background overflow-x-auto overflow-y-hidden no-scrollbar"
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
            <div key={key} className="flex items-end gap-1 shrink-0">
              {showPlaceholderBefore && (
                <div className="h-9 w-[110px] shrink-0 rounded-t-md border-2 border-dashed border-primary/30 bg-primary/5" style={{ width: ghost?.width }} />
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
                  'flex items-center gap-1.5 px-2.5 h-9 shrink-0 rounded-t-md text-xs font-medium border-b-2 transition-all duration-150 ease-in-out group select-none',
                  resolved ? 'max-w-[180px]' : 'w-[110px]',
                  key === activeKey
                    ? 'border-primary text-foreground bg-muted/50'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                  isDragging && dropTarget !== null && dropTarget !== draggingIndex && 'opacity-0 !w-0 !px-0 !gap-0 !mx-0 overflow-hidden',
                  isDragging && (dropTarget === null || dropTarget === draggingIndex) && 'opacity-30',
                  draggingIndex !== null ? 'cursor-grabbing' : 'cursor-grab',
                )}
              >
                {resolved ? (
                  <>
                    <IssueTypeIcon typeName={resolved.issueTypeName} />
                    <div className="flex flex-col min-w-0 leading-none">
                      <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">{key}</span>
                      <span className="truncate text-[11px] leading-tight">{resolved.summary}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" />
                    <span className="font-mono text-[11px] whitespace-nowrap">{key}</span>
                  </>
                )}
              </div>
              {showPlaceholderAfter && (
                <div className="h-9 w-[110px] shrink-0 rounded-t-md border-2 border-dashed border-primary/30 bg-primary/5" style={{ width: ghost?.width }} />
              )}
            </div>
          );
        })}
      </div>
      {renderGhost()}
    </>
  );
}
