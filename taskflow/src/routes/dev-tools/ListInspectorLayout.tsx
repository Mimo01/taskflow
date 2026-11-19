/**
 * ListInspectorLayout — shared toolbar + scrolling list + resizable inspector used by every
 * Developer Tools tab. Only the list and inspector panes scroll, never the page.
 */
import { Maximize2, Minimize2, MousePointerClick } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useResizable } from '@/hooks/useResizable';
import { cn } from '@/lib/utils';
import { useDevToolsViewStore } from './dev-tools-view.store';

/** Ghost icon button toggling the inspector between its side panel and the whole pane. */
export function InspectorMaximizeButton() {
  const maximized = useDevToolsViewStore((s) => s.inspectorMaximized);
  const setMaximized = useDevToolsViewStore((s) => s.setInspectorMaximized);
  const label = maximized ? 'Restore inspector' : 'Maximize inspector';
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={maximized}
      onClick={() => setMaximized(!maximized)}
    >
      {maximized ? <Minimize2 /> : <Maximize2 />}
    </Button>
  );
}

interface ListInspectorLayoutProps {
  toolbar: ReactNode;
  summary?: ReactNode;
  list: ReactNode;
  /** Null when nothing is selected. */
  inspector: ReactNode | null;
  emptyInspector?: ReactNode;
  /** Title of the default empty-inspector state. */
  emptyTitle?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export default function ListInspectorLayout({
  toolbar,
  summary,
  list,
  inspector,
  emptyInspector,
  emptyTitle = 'Select a row',
  onKeyDown,
}: ListInspectorLayoutProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [handleHovered, setHandleHovered] = useState(false);
  const inspectorWidth = useDevToolsViewStore((s) => s.inspectorWidth);
  const setInspectorWidth = useDevToolsViewStore((s) => s.setInspectorWidth);
  const inspectorMaximized = useDevToolsViewStore((s) => s.inspectorMaximized);
  const maximized = inspectorMaximized && inspector !== null;
  const {
    width,
    isDragging,
    handleMouseDown: onHandleMouseDown,
    handleKeyDown: onHandleKeyDown,
  } = useResizable({
    initialWidth: inspectorWidth,
    min: 320,
    max: () => (layoutRef.current?.offsetWidth ?? 1000) * 0.85,
    onCommit: setInspectorWidth,
    direction: 'left',
  });

  return (
    <div ref={layoutRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-6 py-2">
        {toolbar}
      </div>
      {summary ? (
        <div className="shrink-0 border-b px-6 py-1.5 text-xs text-muted-foreground">{summary}</div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard-navigable list scroller */}
        <div
          onKeyDown={onKeyDown}
          data-testid="devtools-list"
          className={cn(
            'relative min-h-0 min-w-0 flex-1 overflow-auto outline-none',
            maximized && 'hidden',
          )}
        >
          {list}
        </div>
        <div
          data-testid="devtools-inspector"
          style={maximized ? undefined : { width }}
          className={cn(
            'relative min-h-0 overflow-auto border-l',
            maximized ? 'flex-1' : 'flex-none',
            !isDragging && !maximized && 'transition-[width] duration-150',
          )}
        >
          {!maximized && (
            // biome-ignore lint/a11y/useSemanticElements: draggable splitter; <hr> cannot take focus or key handlers
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize inspector"
              aria-valuenow={Math.round(width)}
              tabIndex={0}
              data-testid="devtools-inspector-resize"
              onMouseDown={onHandleMouseDown}
              onKeyDown={onHandleKeyDown}
              onMouseEnter={() => setHandleHovered(true)}
              onMouseLeave={() => setHandleHovered(false)}
              style={{ borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined }}
              className="absolute top-0 left-0 z-20 h-full w-3 cursor-ew-resize border-l border-border outline-none transition-colors duration-100 focus-visible:border-ring"
            />
          )}
          {inspector ?? emptyInspector ?? (
            <EmptyState compact icon={MousePointerClick} title={emptyTitle} className="pt-16" />
          )}
        </div>
      </div>
    </div>
  );
}
