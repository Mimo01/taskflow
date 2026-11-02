/**
 * Two-pane resizable shell for the Standup Notes page: Yesterday (left) | Today (right).
 *
 * Reuses the shared useResizable hook (drag + keyboard) and persists the left pane
 * width in the settings store. Null width = 50/50 until the first resize.
 * Each pane keeps at least MIN_PANE px (left floor wins in a very narrow window).
 */

import { useRef, useState } from 'react';
import { useResizable } from '@/hooks/useResizable';
import { useSettingsStore } from '@/stores/settings.store';

const MIN_PANE = 320;
const DEFAULT_LEFT = 480;

interface StandupSplitProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export default function StandupSplit({ left, right }: StandupSplitProps) {
  const standupYesterdayWidth = useSettingsStore((s) => s.standupYesterdayWidth);
  const setStandupYesterdayWidth = useSettingsStore((s) => s.setStandupYesterdayWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const [handleHovered, setHandleHovered] = useState(false);

  const { width, isDragging, handleMouseDown, handleKeyDown } = useResizable({
    initialWidth: standupYesterdayWidth ?? DEFAULT_LEFT,
    min: MIN_PANE,
    max: () => (containerRef.current?.offsetWidth || 960) - MIN_PANE,
    onCommit: setStandupYesterdayWidth,
    direction: 'right',
    getStartWidth: () => leftRef.current?.offsetWidth || width,
  });

  const unset = standupYesterdayWidth === null && !isDragging;
  const active = handleHovered || isDragging;

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 overflow-hidden">
      <div
        ref={leftRef}
        className="relative shrink-0 overflow-auto px-6 py-4"
        style={{
          width: unset ? '50%' : width,
          maxWidth: `calc(100% - ${MIN_PANE}px)`,
          minWidth: MIN_PANE,
        }}
      >
        {left}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: draggable splitter, <hr> cannot take focus/drag handlers */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Yesterday and Today columns"
        aria-valuenow={Math.round(leftRef.current?.offsetWidth || width)}
        aria-valuemin={MIN_PANE}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => setStandupYesterdayWidth(null)}
        onMouseEnter={() => setHandleHovered(true)}
        onMouseLeave={() => setHandleHovered(false)}
        className="relative shrink-0 w-1 cursor-ew-resize border-l border-border transition-colors duration-100 focus-visible:outline-none focus-visible:border-ring before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-['']"
        style={active ? { borderColor: 'var(--ring)' } : undefined}
      />
      <div className="flex-1 min-w-0 overflow-auto">{right}</div>
    </div>
  );
}
