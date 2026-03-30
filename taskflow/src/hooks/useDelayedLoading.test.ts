import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedLoading } from './useDelayedLoading';

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false initially when isPending is true (within 200ms window)', () => {
    const { result } = renderHook(() => useDelayedLoading(true));
    expect(result.current).toBe(false);
  });

  it('returns true after 200ms when isPending remains true', async () => {
    const { result } = renderHook(() => useDelayedLoading(true));
    expect(result.current).toBe(false);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);
  });

  it('returns false immediately when isPending transitions from true to false (even within 200ms)', async () => {
    const { result, rerender } = renderHook(
      ({ isPending }: { isPending: boolean }) => useDelayedLoading(isPending),
      { initialProps: { isPending: true } },
    );
    expect(result.current).toBe(false);
    // Transition to false before 200ms
    await act(async () => {
      vi.advanceTimersByTime(100);
      rerender({ isPending: false });
    });
    expect(result.current).toBe(false);
  });

  it('clears timeout when isPending goes false before 200ms (no stale setState)', async () => {
    const { result, rerender } = renderHook(
      ({ isPending }: { isPending: boolean }) => useDelayedLoading(isPending),
      { initialProps: { isPending: true } },
    );
    // Go false before timeout fires
    await act(async () => {
      vi.advanceTimersByTime(50);
      rerender({ isPending: false });
    });
    // Now advance past the original 200ms — should NOT flip to true
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(false);
  });

  it('returns false when isPending starts as false', () => {
    const { result } = renderHook(() => useDelayedLoading(false));
    expect(result.current).toBe(false);
  });
});
