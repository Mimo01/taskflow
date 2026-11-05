import { type RefObject, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import {
  initialViewerState,
  isPannable,
  type Point,
  type ViewerAction,
  type ViewerState,
  viewerReducer,
} from '@/lib/image-viewer';

const KEY_PAN_PX = 50;
/** A press that moves further than this is a drag, not a click. */
const CLICK_SLOP_PX = 4;
/**
 * A Safari pinch suppresses ctrl+wheel (WebKit may emit both for one pinch).
 * The suppression expires this long after the last gesture event, so a pinch
 * that never delivers `gestureend` can't disable wheel zoom indefinitely.
 */
export const GESTURE_STALE_MS = 300;

interface UseImageViewerResult {
  state: ViewerState;
  dispatch: (action: ViewerAction) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Wires zoom/pan/rotate input (non-passive wheel, Safari gesture*, pointer
 * drag, click-to-zoom, keyboard) onto a stage element. Listeners are registered
 * once and only dispatch reducer actions, so they never read stale state.
 */
export function useImageViewer(
  stageRef: RefObject<HTMLElement | null>,
  enabled = true,
): UseImageViewerResult {
  const [state, dispatch] = useReducer(viewerReducer, initialViewerState);
  const pannableRef = useRef(false);
  const scaleRef = useRef(1);

  // Mirror what the key handler needs; written in a layout effect, never during render.
  useLayoutEffect(() => {
    pannableRef.current = isPannable(state);
    scaleRef.current = state.scale;
  }, [state]);

  // Track stage size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !enabled) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) dispatch({ type: 'resize', stageW: rect.width, stageH: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [stageRef, enabled]);

  // Pointer-ish input on the stage.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !enabled) return;

    const toPoint = (clientX: number, clientY: number): Point => {
      const r = el.getBoundingClientRect();
      return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) };
    };

    let gestureActive = false;
    let lastGestureAt = 0;
    let startScale = 1;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const pinchInProgress = () =>
      gestureActive && performance.now() - lastGestureAt < GESTURE_STALE_MS;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (pinchInProgress()) return;
        gestureActive = false;
        dispatch({ type: 'wheelZoom', deltaY: e.deltaY, point: toPoint(e.clientX, e.clientY) });
        return;
      }
      if (pannableRef.current) {
        e.preventDefault();
        dispatch({ type: 'pan', dx: -e.deltaX, dy: -e.deltaY });
      }
    };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureActive = true;
      lastGestureAt = performance.now();
      startScale = scaleRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      if (!gestureActive) {
        gestureActive = true;
        startScale = scaleRef.current;
      }
      lastGestureAt = performance.now();
      dispatch({
        type: 'pinch',
        scale: startScale * g.scale,
        point: toPoint(g.clientX, g.clientY),
      });
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      gestureActive = false;
    };

    let downX = Number.NaN;
    let downY = Number.NaN;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      if (e.button !== 0 || !pannableRef.current) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture?.(e.pointerId);
      el.dataset.dragging = 'true';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      dispatch({ type: 'pan', dx, dy });
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      delete el.dataset.dragging;
      el.releasePointerCapture?.(e.pointerId);
    };
    // Single click on the image zooms in toward the cursor, or back to rest when
    // zoomed. A click that ends a drag (moved > CLICK_SLOP_PX) is ignored.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || !(e.target instanceof HTMLImageElement)) return;
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > CLICK_SLOP_PX) return;
      dispatch({ type: 'toggleZoom', point: toPoint(e.clientX, e.clientY) });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('click', onClick);
    };
  }, [stageRef, enabled]);

  // Keyboard. Capture phase so it runs before the parent modal's document listener.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      switch (e.key) {
        case '+':
        case '=':
          dispatch({ type: 'zoomIn' });
          break;
        case '-':
        case '_':
          dispatch({ type: 'zoomOut' });
          break;
        case '0':
          if (e.ctrlKey || e.metaKey) return;
          dispatch({ type: 'fit' });
          break;
        case '1':
          if (e.ctrlKey || e.metaKey) return;
          dispatch({ type: 'actual' });
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) return;
          dispatch({ type: 'rotate', dir: 1 });
          break;
        case 'R':
          if (e.ctrlKey || e.metaKey) return;
          dispatch({ type: 'rotate', dir: -1 });
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (!pannableRef.current) return;
          // Moving the view in the arrow's direction means shifting the image the other way.
          const dx = e.key === 'ArrowLeft' ? KEY_PAN_PX : e.key === 'ArrowRight' ? -KEY_PAN_PX : 0;
          const dy = e.key === 'ArrowUp' ? KEY_PAN_PX : e.key === 'ArrowDown' ? -KEY_PAN_PX : 0;
          dispatch({ type: 'pan', dx, dy });
          break;
        }
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled]);

  return { state, dispatch };
}
