import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/avatarCache', () => ({
  getCachedBlobUrl: vi.fn(),
  fetchAndCacheAvatar: vi.fn(),
}));

import { fetchAndCacheAvatar, getCachedBlobUrl } from '@/services/avatarCache';
import { useAvatarCache } from './useAvatarCache';

describe('useAvatarCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-01
  it('returns { blobUrl: null, loading: false } when url is null', () => {
    vi.mocked(getCachedBlobUrl).mockReturnValue(null);

    const { result } = renderHook(() => useAvatarCache(null));

    expect(result.current.blobUrl).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetchAndCacheAvatar).not.toHaveBeenCalled();
  });

  // AC-02
  it('returns { blobUrl: null, loading: false } when url is undefined', () => {
    vi.mocked(getCachedBlobUrl).mockReturnValue(null);

    const { result } = renderHook(() => useAvatarCache(undefined));

    expect(result.current.blobUrl).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetchAndCacheAvatar).not.toHaveBeenCalled();
  });

  // AC-03
  it('returns cached blob URL synchronously when getCachedBlobUrl returns a value', () => {
    vi.mocked(getCachedBlobUrl).mockReturnValue('blob:cached-url');

    const { result } = renderHook(() => useAvatarCache('https://example.com/avatar.png'));

    expect(result.current.blobUrl).toBe('blob:cached-url');
    expect(result.current.loading).toBe(false);
    expect(fetchAndCacheAvatar).not.toHaveBeenCalled();
  });

  // AC-04
  it('starts loading: true then resolves to blob URL on successful fetch', async () => {
    vi.mocked(getCachedBlobUrl).mockReturnValue(null);
    vi.mocked(fetchAndCacheAvatar).mockResolvedValue('blob:fetched-url');

    const { result } = renderHook(() => useAvatarCache('https://example.com/avatar.png'));

    expect(result.current.loading).toBe(true);
    expect(result.current.blobUrl).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.blobUrl).toBe('blob:fetched-url');
  });

  // AC-05
  it('loading goes false and blobUrl stays null when fetchAndCacheAvatar returns null', async () => {
    vi.mocked(getCachedBlobUrl).mockReturnValue(null);
    vi.mocked(fetchAndCacheAvatar).mockResolvedValue(null);

    const { result } = renderHook(() => useAvatarCache('https://example.com/avatar.png'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.blobUrl).toBeNull();
  });

  // AC-06
  it('old fetch result is ignored (cancelled) when URL changes before fetch resolves', async () => {
    vi.mocked(getCachedBlobUrl).mockReturnValue(null);

    let resolveFirst!: (v: string | null) => void;
    const firstFetch = new Promise<string | null>((res) => {
      resolveFirst = res;
    });
    vi.mocked(fetchAndCacheAvatar)
      .mockReturnValueOnce(firstFetch) // first call (old URL): hangs
      .mockResolvedValueOnce(null); // second call (new URL): resolves immediately

    // Start with first URL — fetch hangs
    const { result, rerender } = renderHook(
      ({ url }: { url: string }) => useAvatarCache(url),
      { initialProps: { url: 'https://example.com/old.png' } },
    );

    expect(result.current.loading).toBe(true);

    // Change URL — triggers second fetch
    act(() => {
      rerender({ url: 'https://example.com/new.png' });
    });

    // Resolve the first (stale) fetch — result must NOT be applied
    act(() => {
      resolveFirst('blob:stale-result');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // State should reflect the second URL fetch (null), not the stale first result
    expect(result.current.blobUrl).toBeNull();
  });

  // AC-07
  it('state resets to { blobUrl: null, loading: false } when URL changes to null', async () => {
    vi.mocked(getCachedBlobUrl).mockReturnValue(null);
    vi.mocked(fetchAndCacheAvatar).mockResolvedValue('blob:fetched-url');

    const { result, rerender } = renderHook(
      ({ url }: { url: string | null }) => useAvatarCache(url),
      { initialProps: { url: 'https://example.com/avatar.png' as string | null } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.blobUrl).toBe('blob:fetched-url');

    act(() => {
      rerender({ url: null });
    });

    expect(result.current.blobUrl).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
