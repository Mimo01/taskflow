/**
 * PinnedTabStrip -- renders a horizontal strip of pinned issue tabs below the
 * TopBar. All tabs are shown in a scrollable row with drag-to-reorder support
 * via pointer events (HTML5 drag API is unreliable in Tauri WebView).
 *
 * A floating ghost clone follows the cursor during drag.
 *
 * Tab metadata (summary/type for issues, name/projectKey for cycles) comes from
 * `resolvedTabs` -- a discriminated union map populated by main.tsx so each
 * pinned tab has its display data available at paint time.
 */

import {
  ArrowLeftToLine,
  ArrowRightToLine,
  BookOpen,
  Bug,
  CheckSquare,
  CornerDownRight,
  FlaskConical,
  Loader2,
  PinOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

interface PinnedTabStripProps {
  pinnedKeys: string[];
  activeKey: string | null;
  onTabClick: (issueKey: string) => void;
  onTabClose: (issueKey: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  resolvedTabs: Map<string, ResolvedTab>;
}

type IssueTab = { type: 'issue'; summary: string; issueTypeName: string };
type CycleTab = { type: 'cycle'; name: string; projectKey: string };
type ResolvedTab = IssueTab | CycleTab;

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
  resolvedTabs,
}: PinnedTabStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const dragState = useRef<{
    index: number;
    startX: number;
    didMove: boolean;
    offsetX: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [ghost, setGhost] = useState<DragGhost | null>(null);

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    const el = tabRefs.current.get(index);
    const rect = el?.getBoundingClientRect();
    const offsetX = rect ? e.clientX - rect.left : 0;
    dragState.current = { index, startX: e.clientX, didMove: false, offsetX };
  };

  useEffect(() => {
    const computeDropIndex = (clientX: number): number | null => {
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
    };

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
        setGhost((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      }

      const target = computeDropIndex(e.clientX);
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
  }, [dropTarget, onReorder]);

  // Render the ghost tab content
  const renderGhost = () => {
    if (!ghost) return null;
    const key = pinnedKeys[ghost.index];
    if (!key) return null;
    const resolved = resolvedTabs.get(key);

    return createPortal(
      <div
        className="fixed z-50 pointer-events-none flex items-center gap-1.5 px-2.5 h-9 rounded-md text-xs font-medium bg-background border border-border shadow-lg opacity-90"
        style={{
          left: ghost.x - ghost.offsetX,
          top: ghost.y - 18,
          width: ghost.width,
        }}
      >
        {resolved?.type === 'cycle' ? (
          <>
            <FlaskConical className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <div className="flex flex-col min-w-0 leading-none">
              <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
                {key}
              </span>
              <span className="truncate text-[11px] leading-tight">{resolved.name}</span>
            </div>
          </>
        ) : resolved?.type === 'issue' ? (
          <>
            <IssueTypeIcon typeName={resolved.issueTypeName} />
            <div className="flex flex-col min-w-0 leading-none">
              <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
                {key}
              </span>
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
        aria-label="Pinned tabs"
      >
        {pinnedKeys.map((key, index) => {
          const resolved = resolvedTabs.get(key);
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
                <div
                  className="h-9 w-[110px] shrink-0 rounded-t-md border-2 border-dashed border-primary/30 bg-primary/5"
                  style={{ width: ghost?.width }}
                />
              )}
              <ContextMenu>
                <ContextMenuTrigger>
                  <div
                    ref={(el) => {
                      if (el) tabRefs.current.set(index, el);
                      else tabRefs.current.delete(index);
                    }}
                    role="tab"
                    tabIndex={0}
                    aria-selected={key === activeKey}
                    onPointerDown={(e) => handlePointerDown(e, index)}
                    onClick={() => {
                      if (didDragRef.current) {
                        didDragRef.current = false;
                        return;
                      }
                      onTabClick(key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onTabClick(key);
                    }}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 h-9 shrink-0 rounded-t-md text-xs font-medium border-b-2 transition-all duration-150 ease-in-out group select-none',
                      resolved ? 'max-w-[180px]' : 'w-[110px]',
                      key === activeKey
                        ? 'border-primary text-foreground bg-muted/50'
                        : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
                      isDragging &&
                        dropTarget !== null &&
                        dropTarget !== draggingIndex &&
                        'opacity-0 !w-0 !px-0 !gap-0 !mx-0 overflow-hidden',
                      isDragging &&
                        (dropTarget === null || dropTarget === draggingIndex) &&
                        'opacity-30',
                      draggingIndex !== null ? 'cursor-grabbing' : 'cursor-grab',
                    )}
                  >
                    {resolved?.type === 'cycle' ? (
                      <>
                        <FlaskConical className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col min-w-0 leading-none">
                          <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
                            {key}
                          </span>
                          <span className="truncate text-[11px] leading-tight">
                            {resolved.name}
                          </span>
                        </div>
                      </>
                    ) : resolved?.type === 'issue' ? (
                      <>
                        <IssueTypeIcon typeName={resolved.issueTypeName} />
                        <div className="flex flex-col min-w-0 leading-none">
                          <span className="font-mono text-[9px] text-muted-foreground/60 whitespace-nowrap">
                            {key}
                          </span>
                          <span className="truncate text-[11px] leading-tight">
                            {resolved.summary}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" />
                        <span className="font-mono text-[11px] whitespace-nowrap">{key}</span>
                      </>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-[160px]">
                  <ContextMenuItem onClick={() => onReorder(index, 0)} disabled={index === 0}>
                    <ArrowLeftToLine className="w-3.5 h-3.5" />
                    Move to start
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onReorder(index, pinnedKeys.length - 1)}
                    disabled={index === pinnedKeys.length - 1}
                  >
                    <ArrowRightToLine className="w-3.5 h-3.5" />
                    Move to end
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem variant="destructive" onClick={() => onTabClose(key)}>
                    <PinOff className="w-3.5 h-3.5" />
                    Unpin
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
              {showPlaceholderAfter && (
                <div
                  className="h-9 w-[110px] shrink-0 rounded-t-md border-2 border-dashed border-primary/30 bg-primary/5"
                  style={{ width: ghost?.width }}
                />
              )}
            </div>
          );
        })}
      </div>
      {renderGhost()}
    </>
  );
}
