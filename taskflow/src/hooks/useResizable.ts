import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseResizableOptions {
  /** Width to initialise the hook with (px). Typically from the persisted store value. */
  initialWidth: number;
  /** Minimum allowed width in px. */
  min: number;
  /** Maximum allowed width in px. Can be a function to support dynamic bounds (e.g. 50% of container). */
  max: number | (() => number);
  /** Called with the final width (px) when the user releases the mouse after a drag. Use to persist to store. */
  onCommit: (width: number) => void;
  /**
   * Which edge the drag handle sits on.
   * 'right' (default): handle is on the right edge — dragging right increases width.
   * 'left': handle is on the left edge — dragging left increases width (delta is negated).
   */
  direction?: 'right' | 'left';
}

/**
 * Drag-to-resize hook for sidebar panels.
 *
 * Encapsulates mousedown/mousemove/mouseup drag logic, bounds clamping, cursor lock,
 * and selection suppression. Width is committed to persistent storage via `onCommit`
 * only on mouseup (not on every mousemove) to avoid excessive store writes.
 *
 * @param options.initialWidth — starting width in px (from persisted store)
 * @param options.min — minimum width in px
 * @param options.max — maximum width in px, or a function that computes it (for container-relative bounds)
 * @param options.onCommit — called with final px width on mouseup
 */
export function useResizable({
  initialWidth,
  min,
  max,
  onCommit,
  direction = 'right',
}: UseResizableOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  // Ref tracks live width to avoid stale closure in mouseup handler (Pitfall 1 in RESEARCH.md)
  const widthRef = useRef(width);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  // Keep widthRef in sync with state on every render
  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  // Sync width state when initialWidth changes after mount (e.g. store hydration)
  useEffect(() => {
    if (!isDragging) {
      setWidth(initialWidth);
      widthRef.current = initialWidth;
    }
  }, [initialWidth, isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, width: widthRef.current };
    setIsDragging(true);
    // Lock cursor on <html> element so it stays ew-resize even when mouse moves faster
    // than element boundaries (Pitfall 2 in RESEARCH.md)
    document.documentElement.style.cursor = 'ew-resize';
    // Prevent text selection during drag (Pitfall 3 in RESEARCH.md)
    document.documentElement.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    function onMouseMove(e: MouseEvent) {
      if (!startRef.current) return;
      const rawDelta = e.clientX - startRef.current.x;
      const delta = direction === 'left' ? -rawDelta : rawDelta;
      const maxVal = typeof max === 'function' ? max() : max;
      const next = Math.min(maxVal, Math.max(min, startRef.current.width + delta));
      setWidth(next);
    }

    function onMouseUp() {
      setIsDragging(false);
      document.documentElement.style.cursor = '';
      document.documentElement.style.userSelect = '';
      // Read from ref, not stale closure value (Pitfall 1 in RESEARCH.md)
      onCommit(widthRef.current);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, direction, min, max, onCommit]);

  return { width, isDragging, handleMouseDown };
}
