import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock plugin-http fetch
const mockFetch = vi.fn();
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: mockFetch }));

// Mock stronghold
vi.mock('@/services/stronghold', () => ({
  readSecret: vi.fn().mockResolvedValue('test-token'),
}));

// Mock auth store
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: vi.fn().mockReturnValue({ jiraBaseUrl: 'https://jira.example.com' }),
  },
}));

let blobUrlCounter = 0;

beforeEach(async () => {
  blobUrlCounter = 0;
  // Spy on URL methods rather than replacing the whole URL global
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++blobUrlCounter}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  mockFetch.mockReset();
  // Clear the shared disk store backing data between tests
  const { LazyStore } = await import('@tauri-apps/plugin-store');
  (LazyStore as unknown as { clearStore: (f: string) => void }).clearStore('avatar-cache.json');
  // Reset module state between tests
  const { resetForTesting } = await import('@/services/avatarCache');
  resetForTesting();
});

function makeFetchSuccess(content = 'fake-image', mimeType = 'image/jpeg') {
  mockFetch.mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob([content], { type: mimeType })),
  });
}

describe('avatarCache service', () => {
  it('Test 1: memory cache hit — second call returns same blob URL without second network request', async () => {
    makeFetchSuccess();
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    const url1 = await fetchAndCacheAvatar('https://example.com/avatar.jpg');
    const url2 = await fetchAndCacheAvatar('https://example.com/avatar.jpg');

    expect(url1).toBe('blob:test-1');
    expect(url2).toBe('blob:test-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('Test 2: inflight dedup — two concurrent calls fire only one network request', async () => {
    makeFetchSuccess();
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    const [url1, url2] = await Promise.all([
      fetchAndCacheAvatar('https://example.com/avatar2.jpg'),
      fetchAndCacheAvatar('https://example.com/avatar2.jpg'),
    ]);

    expect(url1).toBe('blob:test-1');
    expect(url2).toBe('blob:test-1');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('Test 3: getCachedBlobUrl sync — returns blob URL synchronously after fetch resolves', async () => {
    makeFetchSuccess();
    const { fetchAndCacheAvatar, getCachedBlobUrl } = await import('@/services/avatarCache');

    const url = 'https://example.com/avatar3.jpg';
    expect(getCachedBlobUrl(url)).toBeNull();

    await fetchAndCacheAvatar(url);

    expect(getCachedBlobUrl(url)).toBe('blob:test-1');
  });

  it('Test 4: disk init — initAvatarCache populates memoryCache from LazyStore', async () => {
    const { LazyStore } = await import('@tauri-apps/plugin-store');
    const { initAvatarCache, getCachedBlobUrl } = await import('@/services/avatarCache');

    // Manually set disk entries
    const store = new LazyStore('avatar-cache.json');
    const entry = {
      base64: btoa('fake-image-bytes'),
      mimeType: 'image/jpeg',
      lastAccessed: Date.now(),
    };
    await store.set('https://example.com/cached.jpg', entry);

    // initAvatarCache loads disk entries into memory
    await initAvatarCache();

    const blobUrl = getCachedBlobUrl('https://example.com/cached.jpg');
    expect(blobUrl).toMatch(/^blob:/);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('Test 5: TTL eviction — entries older than 30 days are evicted during initAvatarCache', async () => {
    const { LazyStore } = await import('@tauri-apps/plugin-store');
    const { initAvatarCache, getCachedBlobUrl } = await import('@/services/avatarCache');

    const store = new LazyStore('avatar-cache.json');
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const staleEntry = {
      base64: btoa('stale-image'),
      mimeType: 'image/jpeg',
      lastAccessed: thirtyOneDaysAgo,
    };
    await store.set('https://example.com/stale.jpg', staleEntry);

    await initAvatarCache();

    const blobUrl = getCachedBlobUrl('https://example.com/stale.jpg');
    expect(blobUrl).toBeNull();
  });

  it('Test 6: evictAvatar — removes from memory and disk, revokes blob URL', async () => {
    makeFetchSuccess();
    const { fetchAndCacheAvatar, evictAvatar, getCachedBlobUrl } = await import('@/services/avatarCache');

    const url = 'https://example.com/avatar6.jpg';
    const blobUrl = await fetchAndCacheAvatar(url);
    expect(getCachedBlobUrl(url)).toBe(blobUrl);

    await evictAvatar(url);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(blobUrl);
    expect(getCachedBlobUrl(url)).toBeNull();
  });

  it('Test 7: fetch failure — returns null, memory cache not populated', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const { fetchAndCacheAvatar, getCachedBlobUrl } = await import('@/services/avatarCache');

    const url = 'https://example.com/bad-avatar.jpg';
    const result = await fetchAndCacheAvatar(url);

    expect(result).toBeNull();
    expect(getCachedBlobUrl(url)).toBeNull();
  });

  it('Test 8: null/empty blob — returns null when blob has size 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob([], { type: 'image/jpeg' })),
    });
    const { fetchAndCacheAvatar, getCachedBlobUrl } = await import('@/services/avatarCache');

    const url = 'https://example.com/empty-avatar.jpg';
    const result = await fetchAndCacheAvatar(url);

    expect(result).toBeNull();
    expect(getCachedBlobUrl(url)).toBeNull();
  });
});
