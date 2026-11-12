import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllReleases,
  isRateLimited,
  type ReleaseEntry,
  ReleasesFetchError,
  selectRollup,
} from './releases';

function res(rows: unknown[], link?: string, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => rows,
    headers: { get: (n: string) => (n.toLowerCase() === 'link' ? (link ?? null) : null) },
  };
}

const rel = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  published_at: '2026-01-01T00:00:00Z',
  body: `notes ${tag}`,
  prerelease: false,
  draft: false,
  ...extra,
});

afterEach(() => vi.unstubAllGlobals());

describe('fetchAllReleases', () => {
  it('follows the Link header, filters and sorts newest first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        res(
          [rel('v1.2.0'), rel('v1.10.0', { draft: true }), rel('v1.3.0-rc1', { prerelease: true })],
          '<https://api.example/page2>; rel="next", <https://api.example/p9>; rel="last"',
        ),
      )
      .mockResolvedValueOnce(res([rel('v1.10.0'), rel('not-a-version'), rel('v1.9.0')]));
    vi.stubGlobal('fetch', fetchMock);

    const out = await fetchAllReleases();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('per_page=100');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example/page2');
    expect(out.map((r) => r.version)).toEqual(['1.10.0', '1.9.0', '1.2.0']);
    expect(out[0]).toMatchObject({ tag: 'v1.10.0', body: 'notes v1.10.0' });
  });

  it('tolerates responses without headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [rel('v1.0.0')] }),
    );
    expect((await fetchAllReleases()).map((r) => r.version)).toEqual(['1.0.0']);
  });

  it('dedupes v-prefixed and bare tags of the same version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(res([rel('v1.2.0'), rel('1.2.0'), rel('v1.1.0')])),
    );
    expect((await fetchAllReleases()).map((r) => r.version)).toEqual(['1.2.0', '1.1.0']);
  });

  it('hides 0.x test builds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res([rel('v1.6.0'), rel('v0.1.0')])));
    expect((await fetchAllReleases()).map((r) => r.version)).toEqual(['1.6.0']);
  });

  it('drops unflagged semver prerelease tags', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res([rel('v1.3.0-rc1'), rel('v1.2.0')])));
    expect((await fetchAllReleases()).map((r) => r.version)).toEqual(['1.2.0']);
  });

  it('flags 403/429 as rate limited, not other errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res([], undefined, false, 403)));
    const err = await fetchAllReleases().catch((e) => e);
    expect(err).toBeInstanceOf(ReleasesFetchError);
    expect(isRateLimited(err)).toBe(true);
    expect(isRateLimited(new ReleasesFetchError(429))).toBe(true);
    expect(isRateLimited(new ReleasesFetchError(500))).toBe(false);
    expect(isRateLimited(new Error('x'))).toBe(false);
  });

  it('caps pagination at 10 pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(res([], '<https://api.example/n>; rel="next"'));
    vi.stubGlobal('fetch', fetchMock);
    await fetchAllReleases();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res([], undefined, false, 403)));
    await expect(fetchAllReleases()).rejects.toThrow('403');
  });
});

describe('selectRollup', () => {
  const list: ReleaseEntry[] = ['1.14.20', '1.14.19', '1.14.18', '1.14.17'].map((version) => ({
    version,
    tag: `v${version}`,
    publishedAt: '',
    body: '',
    prerelease: false,
  }));

  it('is exclusive at both ends and newest first', () => {
    expect(selectRollup(list, '1.14.17', '1.14.20').map((r) => r.version)).toEqual([
      '1.14.19',
      '1.14.18',
    ]);
  });

  it('returns [] for an invalid or null from', () => {
    expect(selectRollup(list, null, '1.14.20')).toEqual([]);
    expect(selectRollup(list, 'old', '1.14.20')).toEqual([]);
  });
});
