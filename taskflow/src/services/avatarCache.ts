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
const CACHE_VERSION = 2; // Bump to force full cache invalidation

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
  // Version check — wipe entire cache if schema changed
  const storedVersion = await diskStore.get<number>('__cache_version__').catch(() => null);
  if (storedVersion !== CACHE_VERSION) {
    const keys = await diskStore.keys().catch(() => [] as string[]);
    for (const key of keys) {
      await diskStore.delete(key).catch(() => {});
    }
    await diskStore.set('__cache_version__', CACHE_VERSION).catch(() => {});
    await diskStore.save().catch(() => {});
    return;
  }

  const keys = await diskStore.keys().catch(() => [] as string[]);
  const now = Date.now();
  let anyEvicted = false;

  for (const key of keys) {
    if (key === '__cache_version__') continue;
    const entry = await diskStore.get<AvatarDiskEntry>(key).catch(() => null);
    if (!entry) continue;

    // Evict stale or corrupted entries during init
    if (now - entry.lastAccessed > TTL_MS || !entry.mimeType?.toLowerCase().startsWith('image/')) {
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

/**
 * Detect image MIME type from magic bytes when the server omits Content-Type.
 * Returns null if the bytes don't match any known image signature.
 */
function detectMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38)
    return 'image/gif';
  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  // SVG: starts with '<' (0x3C) — typically <?xml or <svg
  if (bytes[0] === 0x3c) return 'image/svg+xml';
  return null;
}

/**
 * Extract lowercase hostname from a URL string. Returns null if the URL is
 * malformed. Used for hostname-based auth matching — more robust than
 * startsWith because Jira Server can return avatar URLs with a different
 * protocol (http vs https), port, or casing than the user-entered base URL.
 */
function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
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
      // Build headers — match by hostname so that http/https, port, and case
      // mismatches between jiraBaseUrl and the avatar URL don't prevent auth.
      const headers: Record<string, string> = {};
      const { jiraBaseUrl, gitlabBaseUrl } = useAuthStore.getState();
      const avatarHost = hostnameOf(originalUrl);

      if (avatarHost && jiraBaseUrl && avatarHost === hostnameOf(jiraBaseUrl)) {
        const token = await readSecret('jira-pat').catch(() => null);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } else if (avatarHost && gitlabBaseUrl && avatarHost === hostnameOf(gitlabBaseUrl)) {
        const token = await readSecret('gitlab-pat').catch(() => null);
        if (token) {
          headers['PRIVATE-TOKEN'] = token;
        }
      }

      const response = await fetch(
        originalUrl,
        Object.keys(headers).length > 0 ? { headers } : undefined,
      );
      if (!response.ok) return null;

      // Guard: reject non-image responses (e.g. HTML login pages from auth redirects)
      const contentType = response.headers?.get?.('content-type') ?? '';
      if (contentType && !contentType.toLowerCase().startsWith('image/')) return null;

      let blob = await response.blob();
      if (blob.size === 0) return null;

      // If blob has no MIME type (server omitted Content-Type), detect from magic bytes
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let mimeType = blob.type;
      if (!mimeType) {
        mimeType = detectMimeType(bytes) ?? 'image/png';
        blob = new Blob([bytes], { type: mimeType });
      }

      const blobUrl = URL.createObjectURL(blob);
      memoryCache.set(originalUrl, blobUrl);

      // Persist to disk as base64
      const base64 = uint8ToBase64(bytes);
      const entry: AvatarDiskEntry = {
        base64,
        mimeType,
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
