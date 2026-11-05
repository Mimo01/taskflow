/**
 * Two-pane resizable shell for the Standup Notes page: Yesterday (left) | Today (right).
 *
 * Reuses the shared useResizable hook (drag + keyboard, in px) and persists the left pane
 * as a FRACTION of the split container (standupYesterdayRatio), so opening/closing the app
 * sidebar or resizing the window resizes both panes proportionally. Null = 50/50 until the
 * first resize. While idle the left pane is a percentage width; the live px width is used
 * only during a drag. Each pane keeps at least MIN_PANE_PX (CSS safety net + clamp helper).
 */

import { useRef, useState } from 'react';
import { useResizable } from '@/hooks/useResizable';
import { useSettingsStore } from '@/stores/settings.store';
import {
  clampSplitRatio,
  DEFAULT_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  MIN_PANE_PX,
  MIN_SPLIT_RATIO,
  pxToSplitRatio,
} from './split-ratio';

const FALLBACK_CONTAINER_PX = 960;

interface StandupSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export default function StandupSplit({ left, right }: StandupSplitProps) {
  const standupYesterdayRatio = useSettingsStore((s) => s.standupYesterdayRatio);
  const setStandupYesterdayRatio = useSettingsStore((s) => s.setStandupYesterdayRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const [handleHovered, setHandleHovered] = useState(false);

  const containerPx = () => containerRef.current?.offsetWidth || FALLBACK_CONTAINER_PX;
  const ratio = standupYesterdayRatio ?? DEFAULT_SPLIT_RATIO;

  const { width, isDragging, handleMouseDown, handleKeyDown } = useResizable({
    initialWidth: ratio * FALLBACK_CONTAINER_PX,
    min: MIN_PANE_PX,
    max: () => containerPx() - MIN_PANE_PX,
    onCommit: (px) => setStandupYesterdayRatio(pxToSplitRatio(px, containerPx())),
    direction: 'right',
    getStartWidth: () => leftRef.current?.offsetWidth || width,
  });

  const shownRatio = clampSplitRatio(
    Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, ratio)),
    FALLBACK_CONTAINER_PX,
  );
  const active = handleHovered || isDragging;

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
      <div
        ref={leftRef}
        className="relative shrink-0 overflow-auto px-6 py-4"
        style={{
          width: isDragging ? width : `${shownRatio * 100}%`,
          maxWidth: `calc(100% - ${MIN_PANE_PX}px)`,
          minWidth: MIN_PANE_PX,
        }}
      >
        {left}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: draggable splitter, <hr> cannot take focus/drag handlers */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Yesterday and Today columns"
        aria-valuenow={Math.round(shownRatio * 100)}
        aria-valuemin={Math.round(MIN_SPLIT_RATIO * 100)}
        aria-valuemax={Math.round(MAX_SPLIT_RATIO * 100)}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => setStandupYesterdayRatio(null)}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        className="relative shrink-0 w-1 cursor-ew-resize border-l border-border transition-colors duration-100 focus-visible:outline-none focus-visible:border-ring before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-['']"
        style={active ? { borderColor: 'var(--ring)' } : undefined}
      />
      <div className="flex-1 min-w-0 overflow-auto">{right}</div>
    </div>
  );
}
