import { useEffect, useState } from 'react';
import { fetchAndCacheAvatar, getCachedBlobUrl } from '@/services/avatarCache';

/**
 * React hook that provides a cached blob URL for an avatar image.
 * Initializes with a synchronous cache hit (no loading flash), or fetches
 * the image asynchronously and triggers a re-render when it resolves.
 *
 * Used exclusively by CachedAvatar. Other components use <CachedAvatar/> directly.
 */
export function useAvatarCache(url: string | null | undefined): {
  blobUrl: string | null;
  loading: boolean;
} {
  const syncHit = url ? getCachedBlobUrl(url) : null;

  const [blobUrl, setBlobUrl] = useState<string | null>(syncHit);
  const [loading, setLoading] = useState<boolean>(url != null && syncHit === null);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setLoading(false);
      return;
    }

    // Already in memory — no async needed
    const cached = getCachedBlobUrl(url);
    if (cached) {
      setBlobUrl(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchAndCacheAvatar(url).then((result) => {
      if (!cancelled) {
        setBlobUrl(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { blobUrl, loading };
}
