import { fetch } from '@tauri-apps/plugin-http';
import { LazyStore } from '@tauri-apps/plugin-store';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

// In-memory blob URL pool (survives component unmounts within session)
let memoryCache = new Map<string, string>(); // originalUrl -> blobUrl

// Disk persistence store (survives app restarts)
let diskStore = new LazyStore('avatar-cache.json');

// Pending fetches (prevents duplicate in-flight requests for same URL)
let inflight = new Map<string, Promise<string | null>>();

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface AvatarDiskEntry {
  base64: string;
  mimeType: string;
  lastAccessed: number; // Date.now() ms
}

/**
 * Convert Uint8Array to base64 using chunked processing to avoid
 * "Maximum call stack size exceeded" on large arrays (pitfall from RESEARCH).
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Initialize: load disk cache into memory Map on app startup */
export async function initAvatarCache(): Promise<void> {
  const keys = await diskStore.keys().catch(() => [] as string[]);
  const now = Date.now();
  let anyEvicted = false;

  for (const key of keys) {
    const entry = await diskStore.get<AvatarDiskEntry>(key).catch(() => null);
    if (!entry) continue;

    // Evict stale entries during init
    if (now - entry.lastAccessed > TTL_MS) {
      await diskStore.delete(key).catch(() => {});
      anyEvicted = true;
      continue;
    }

    // Reconstruct blob URL from base64
    const bytes = Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: entry.mimeType });
    const blobUrl = URL.createObjectURL(blob);
    memoryCache.set(key, blobUrl);
  }

  if (anyEvicted) {
    await diskStore.save().catch(() => {});
  }
}

/** Get blob URL from memory cache (null if not cached) */
export function getCachedBlobUrl(originalUrl: string): string | null {
  return memoryCache.get(originalUrl) ?? null;
}

/** Fetch avatar, cache in memory + disk, return blob URL */
export async function fetchAndCacheAvatar(originalUrl: string): Promise<string | null> {
  // Return from memory if already cached
  const cached = memoryCache.get(originalUrl);
  if (cached) return cached;

  // Deduplicate in-flight requests for the same URL
  const pending = inflight.get(originalUrl);
  if (pending) return pending;

  const promise = (async (): Promise<string | null> => {
    try {
      // Build headers — add auth for Jira and GitLab URLs
      const headers: Record<string, string> = {};
      const { jiraBaseUrl, gitlabBaseUrl } = useAuthStore.getState();
      if (jiraBaseUrl && originalUrl.startsWith(jiraBaseUrl.replace(/\/$/, ''))) {
        const token = await readSecret('jira-pat').catch(() => null);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } else if (gitlabBaseUrl && originalUrl.startsWith(gitlabBaseUrl.replace(/\/$/, ''))) {
        const token = await readSecret('gitlab-pat').catch(() => null);
        if (token) {
          headers['PRIVATE-TOKEN'] = token;
        }
      }

      const response = await fetch(originalUrl, Object.keys(headers).length > 0 ? { headers } : undefined);
      if (!response.ok) return null;

      const blob = await response.blob();
      if (blob.size === 0) return null;

      const blobUrl = URL.createObjectURL(blob);
      memoryCache.set(originalUrl, blobUrl);

      // Persist to disk as base64
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const base64 = uint8ToBase64(bytes);
      const entry: AvatarDiskEntry = {
        base64,
        mimeType: blob.type || 'image/jpeg',
        lastAccessed: Date.now(),
      };
      await diskStore.set(originalUrl, entry).catch(() => {});
      await diskStore.save().catch(() => {});

      return blobUrl;
    } catch {
      return null;
    } finally {
      inflight.delete(originalUrl);
    }
  })();

  inflight.set(originalUrl, promise);
  return promise;
}

/** Evict a URL from memory + disk and revoke its blob URL */
export async function evictAvatar(originalUrl: string): Promise<void> {
  const blobUrl = memoryCache.get(originalUrl);
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  memoryCache.delete(originalUrl);
  await diskStore.delete(originalUrl).catch(() => {});
  await diskStore.save().catch(() => {});
}

/**
 * Reset all module-level state for testing isolation.
 * Each test needs a clean slate since module state persists between tests.
 */
export function resetForTesting(): void {
  memoryCache = new Map<string, string>();
  inflight = new Map<string, Promise<string | null>>();
  diskStore = new LazyStore('avatar-cache.json');
}
