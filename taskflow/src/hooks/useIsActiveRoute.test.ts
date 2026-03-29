import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '@/lib/query-constants';

// Mock react-router-dom so we can control useLocation without a real router
vi.mock('react-router-dom', () => ({
  useLocation: vi.fn(),
}));

import { useLocation } from 'react-router-dom';
import { useIsActiveRoute } from './useIsActiveRoute';

const mockUseLocation = useLocation as ReturnType<typeof vi.fn>;

describe('useIsActiveRoute', () => {
  it('returns true when pathname exactly matches routePath', () => {
    mockUseLocation.mockReturnValue({ pathname: '/sprint-board' });
    const { result } = renderHook(() => useIsActiveRoute('/sprint-board'));
    expect(result.current).toBe(true);
  });

  it('returns true when pathname starts with routePath followed by /', () => {
    mockUseLocation.mockReturnValue({ pathname: '/sprint-board/some-sub' });
    const { result } = renderHook(() => useIsActiveRoute('/sprint-board'));
    expect(result.current).toBe(true);
  });

  it('returns false when pathname does not match routePath', () => {
    mockUseLocation.mockReturnValue({ pathname: '/my-tasks' });
    const { result } = renderHook(() => useIsActiveRoute('/sprint-board'));
    expect(result.current).toBe(false);
  });

  it('returns false when pathname shares a prefix but is not a sub-route', () => {
    mockUseLocation.mockReturnValue({ pathname: '/sprint-board-extra' });
    const { result } = renderHook(() => useIsActiveRoute('/sprint-board'));
    expect(result.current).toBe(false);
  });
});

describe('query-constants', () => {
  it('POLL_INTERVAL_MS equals 60_000', () => {
    expect(POLL_INTERVAL_MS).toBe(60_000);
  });

  it('STALE_TIME_MS equals 30_000', () => {
    expect(STALE_TIME_MS).toBe(30_000);
  });

  it('STALE_TIME_MS is strictly less than POLL_INTERVAL_MS (invariant)', () => {
    expect(STALE_TIME_MS).toBeLessThan(POLL_INTERVAL_MS);
  });
});
