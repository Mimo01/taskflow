/**
 * ListInspectorLayout — shared toolbar + scrolling list + resizable inspector used by every
 * Developer Tools tab. Only the list and inspector panes scroll, never the page.
 */
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react';
import { useResizable } from '@/hooks/useResizable';
import { cn } from '@/lib/utils';
import { useDevToolsViewStore } from './dev-tools-view.store';

interface ListInspectorLayoutProps {
  toolbar: ReactNode;
  summary?: ReactNode;
  list: ReactNode;
  /** Null when nothing is selected. */
  inspector: ReactNode | null;
  emptyInspector?: ReactNode;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
}

export default function ListInspectorLayout({
  toolbar,
  summary,
  list,
  inspector,
  emptyInspector,
  onKeyDown,
}: ListInspectorLayoutProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [handleHovered, setHandleHovered] = useState(false);
  const inspectorWidth = useDevToolsViewStore((s) => s.inspectorWidth);
  const setInspectorWidth = useDevToolsViewStore((s) => s.setInspectorWidth);
  const {
    width,
    isDragging,
    handleMouseDown: onHandleMouseDown,
  } = useResizable({
    initialWidth: inspectorWidth,
    min: 320,
    max: () => (layoutRef.current?.offsetWidth ?? 1000) * 0.6,
    onCommit: setInspectorWidth,
    direction: 'left',
  });

  return (
    <div ref={layoutRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-6 py-2">{toolbar}</div>
      {summary ? (
        <div className="shrink-0 border-b px-6 py-1.5 text-xs text-muted-foreground">{summary}</div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard-navigable list scroller */}
        <div
          // biome-ignore lint/a11y/noNoninteractiveTabindex: scroller needs focus for arrow-key navigation
          tabIndex={0}
          onKeyDown={onKeyDown}
          data-testid="devtools-list"
          className="relative min-h-0 min-w-0 flex-1 overflow-auto outline-none"
        >
          {list}
        </div>
        <div
          data-testid="devtools-inspector"
          style={{ width }}
          className={cn(
            'relative min-h-0 flex-none overflow-auto border-l',
            !isDragging && 'transition-[width] duration-150',
          )}
        >
          <div
            aria-hidden="true"
            data-testid="devtools-inspector-resize"
            onMouseDown={onHandleMouseDown}
            onMouseEnter={() => setHandleHovered(true)}
            onMouseLeave={() => setHandleHovered(false)}
            style={{ borderColor: isDragging || handleHovered ? 'var(--ring)' : undefined }}
            className="absolute top-0 left-0 z-20 h-full w-3 cursor-ew-resize border-l border-border transition-colors duration-100"
          />
          {inspector ?? emptyInspector ?? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Select a row to inspect it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
