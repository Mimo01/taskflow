import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResizable } from './useResizable';

function makeMouseEvent(type: string, clientX: number) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
}

function makeReactMouseEvent(clientX: number) {
  return { clientX, preventDefault: vi.fn() } as unknown as React.MouseEvent;
}

describe('useResizable', () => {
  beforeEach(() => {
    // Reset cursor/userSelect after each test
    document.documentElement.style.cursor = '';
    document.documentElement.style.userSelect = '';
  });

  afterEach(() => {
    document.documentElement.style.cursor = '';
    document.documentElement.style.userSelect = '';
  });

  // UR-01
  it('returns initialWidth on first render', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 224, min: 160, max: 320, onCommit: vi.fn() }),
    );
    expect(result.current.width).toBe(224);
    expect(result.current.isDragging).toBe(false);
  });

  // UR-02
  it('isDragging is false initially, true after mousedown, false after mouseup', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 224, min: 160, max: 320, onCommit: vi.fn() }),
    );

    expect(result.current.isDragging).toBe(false);

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(0));
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      document.dispatchEvent(makeMouseEvent('mouseup', 0));
    });
    expect(result.current.isDragging).toBe(false);
  });

  // UR-03
  it('width increases when dragging right (direction: right, delta positive)', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 320, onCommit: vi.fn() }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 150));
    });
    expect(result.current.width).toBe(250);
  });

  // UR-04
  it('width decreases when dragging left (direction: right, delta negative)', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 320, onCommit: vi.fn() }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 80));
    });
    expect(result.current.width).toBe(180);
  });

  // UR-05
  it('width is clamped to min when drag would go below', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 320, onCommit: vi.fn() }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 0)); // delta = -100, would be 100 < min=160
    });
    expect(result.current.width).toBe(160);
  });

  // UR-06
  it('width is clamped to max when drag would exceed', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 320, onCommit: vi.fn() }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 400)); // delta = +300, would be 500 > max=320
    });
    expect(result.current.width).toBe(320);
  });

  // UR-07
  it('direction: left negates delta — dragging left increases width', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 400, onCommit: vi.fn(), direction: 'left' }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(200));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 150)); // rawDelta=-50, negated=+50 → 250
    });
    expect(result.current.width).toBe(250);
  });

  // UR-08
  it('max as function is evaluated on each mousemove', () => {
    let dynamicMax = 300;
    const maxFn = vi.fn(() => dynamicMax);

    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: maxFn, onCommit: vi.fn() }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 600)); // would be 700, clamped to 300
    });
    expect(maxFn).toHaveBeenCalled();
    expect(result.current.width).toBe(300);

    dynamicMax = 450;
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 600));
    });
    expect(result.current.width).toBe(450);
  });

  // UR-09
  it('onCommit is called once on mouseup with the final width, not on every mousemove', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 320, onCommit }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 130));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 150));
    });
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(makeMouseEvent('mouseup', 150));
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(250);
  });

  // UR-10
  it('cursor locked to ew-resize on mousedown, cleared on mouseup', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 320, onCommit: vi.fn() }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    expect(document.documentElement.style.cursor).toBe('ew-resize');

    act(() => {
      document.dispatchEvent(makeMouseEvent('mouseup', 100));
    });
    expect(document.documentElement.style.cursor).toBe('');
  });

  // UR-11
  it('userSelect set to none on mousedown, cleared on mouseup', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 200, min: 160, max: 320, onCommit: vi.fn() }),
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(100));
    });
    expect(document.documentElement.style.userSelect).toBe('none');

    act(() => {
      document.dispatchEvent(makeMouseEvent('mouseup', 100));
    });
    expect(document.documentElement.style.userSelect).toBe('');
  });

  // UR-12
  it('initialWidth change after mount syncs width state when not dragging', () => {
    const { result, rerender } = renderHook(
      ({ initialWidth }: { initialWidth: number }) =>
        useResizable({ initialWidth, min: 160, max: 320, onCommit: vi.fn() }),
      { initialProps: { initialWidth: 224 } },
    );

    expect(result.current.width).toBe(224);

    act(() => {
      rerender({ initialWidth: 280 });
    });
    expect(result.current.width).toBe(280);
  });

  // UR-13
  it('initialWidth change during drag is ignored until mouseup', () => {
    const { result, rerender } = renderHook(
      ({ initialWidth }: { initialWidth: number }) =>
        useResizable({ initialWidth, min: 160, max: 320, onCommit: vi.fn() }),
      { initialProps: { initialWidth: 224 } },
    );

    act(() => {
      result.current.handleMouseDown(makeReactMouseEvent(0));
    });
    act(() => {
      document.dispatchEvent(makeMouseEvent('mousemove', 50)); // width → 274
    });
    expect(result.current.width).toBe(274);

    // initialWidth changes while dragging — must not override the live drag width
    act(() => {
      rerender({ initialWidth: 200 });
    });
    expect(result.current.width).toBe(274);

    act(() => {
      document.dispatchEvent(makeMouseEvent('mouseup', 50));
    });
  });
});
