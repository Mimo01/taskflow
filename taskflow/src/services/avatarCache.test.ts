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
    getState: vi.fn().mockReturnValue({
      jiraBaseUrl: 'https://jira.example.com',
      gitlabBaseUrl: 'https://gitlab.example.com',
    }),
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
    await store.set('__cache_version__', 2);
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
    await store.set('__cache_version__', 2);
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

  it('Test 9: Jira auth — sends Authorization Bearer header for Jira avatar URLs', async () => {
    makeFetchSuccess();
    const { readSecret } = await import('@/services/stronghold');
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    const url = 'https://jira.example.com/secure/useravatar?ownerId=alice&avatarId=10000';
    await fetchAndCacheAvatar(url);

    expect(readSecret).toHaveBeenCalledWith('jira-pat');
    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('Test 10: GitLab auth — sends PRIVATE-TOKEN header for GitLab avatar URLs', async () => {
    makeFetchSuccess();
    const { readSecret } = await import('@/services/stronghold');
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    const url = 'https://gitlab.example.com/uploads/user/avatar/42/photo.jpg';
    await fetchAndCacheAvatar(url);

    expect(readSecret).toHaveBeenCalledWith('gitlab-pat');
    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: { 'PRIVATE-TOKEN': 'test-token' },
    });
  });

  it('Test 11: external URL — no auth headers for third-party avatar URLs', async () => {
    makeFetchSuccess();
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    const url = 'https://secure.gravatar.com/avatar/abc123';
    await fetchAndCacheAvatar(url);

    expect(mockFetch).toHaveBeenCalledWith(url, undefined);
  });

  it('Test 12: content-type guard — rejects non-image responses (e.g. HTML login page)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: (h: string) => h === 'content-type' ? 'text/html; charset=utf-8' : null },
      blob: () => Promise.resolve(new Blob(['<html>login page</html>'], { type: 'text/html' })),
    });
    const { fetchAndCacheAvatar, getCachedBlobUrl } = await import('@/services/avatarCache');

    const url = 'https://jira.example.com/secure/useravatar?ownerId=alice';
    const result = await fetchAndCacheAvatar(url);

    expect(result).toBeNull();
    expect(getCachedBlobUrl(url)).toBeNull();
  });

  it('Test 13: content-type guard — accepts image/png responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: (h: string) => h === 'content-type' ? 'image/png' : null },
      blob: () => Promise.resolve(new Blob(['fake-png-data'], { type: 'image/png' })),
    });
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    const url = 'https://jira.example.com/secure/useravatar?ownerId=bob';
    const result = await fetchAndCacheAvatar(url);

    expect(result).toBe('blob:test-1');
  });

  it('Test 14: hostname matching — adds Jira auth even when avatar URL uses http instead of https', async () => {
    makeFetchSuccess();
    const { readSecret } = await import('@/services/stronghold');
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    // jiraBaseUrl is https://jira.example.com but avatar URL returned by Jira uses http
    const url = 'http://jira.example.com/secure/useravatar?ownerId=carol&avatarId=10300';
    await fetchAndCacheAvatar(url);

    expect(readSecret).toHaveBeenCalledWith('jira-pat');
    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('Test 15: hostname matching — adds Jira auth when avatar URL has different port', async () => {
    makeFetchSuccess();
    const { readSecret } = await import('@/services/stronghold');
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    // jiraBaseUrl is https://jira.example.com but avatar URL has port 8443
    const url = 'https://jira.example.com:8443/secure/useravatar?ownerId=dave';
    await fetchAndCacheAvatar(url);

    expect(readSecret).toHaveBeenCalledWith('jira-pat');
    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('Test 16: hostname matching — adds Jira auth case-insensitively', async () => {
    makeFetchSuccess();
    const { readSecret } = await import('@/services/stronghold');
    const { fetchAndCacheAvatar } = await import('@/services/avatarCache');

    // jiraBaseUrl is https://jira.example.com but avatar URL has different casing
    const url = 'https://Jira.Example.Com/secure/useravatar?ownerId=eve';
    await fetchAndCacheAvatar(url);

    expect(readSecret).toHaveBeenCalledWith('jira-pat');
    expect(mockFetch).toHaveBeenCalledWith(url, {
      headers: { Authorization: 'Bearer test-token' },
    });
  });
});
