/**
 * releases — GitHub Releases history for the update surfaces.
 *
 * One fetcher serves the Update available modal, the What's new modal (both
 * for the skipped-releases roll-up) and Settings → Updates. Follows the `Link`
 * header past the 100-per-page cap, drops drafts, prereleases and non-semver
 * tags, and sorts newest-first client-side (the API does not guarantee order).
 */
import { compareVersions, validate } from 'compare-versions';

export const RELEASES_API_URL =
  'https://api.github.com/repos/Mimo01/taskflow-releases/releases?per_page=100';

const MAX_PAGES = 10;
const FETCH_TIMEOUT_MS = 10_000;
const STRICT_SEMVER = /^\d+\.\d+\.\d+$/;

export class ReleasesFetchError extends Error {
  constructor(readonly status: number) {
    super(`GitHub API error: ${status}`);
  }
}

/** 403/429 = unauthenticated rate limit — retrying only burns more quota. */
export function isRateLimited(err: unknown): boolean {
  return err instanceof ReleasesFetchError && (err.status === 403 || err.status === 429);
}

export interface ReleaseEntry {
  /** Bare semver, no leading "v". */
  version: string;
  tag: string;
  publishedAt: string;
  body: string;
  prerelease: boolean;
}

interface GitHubRelease {
  tag_name?: string;
  published_at?: string | null;
  body?: string | null;
  prerelease?: boolean;
  draft?: boolean;
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(',')) {
    const m = /<([^>]+)>\s*;\s*rel="next"/.exec(part);
    if (m) return m[1];
  }
  return null;
}

export async function fetchAllReleases(): Promise<ReleaseEntry[]> {
  const byVersion = new Map<string, ReleaseEntry>();
  let url: string | null = RELEASES_API_URL;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: Response = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new ReleasesFetchError(res.status);
    const rows = (await res.json()) as GitHubRelease[];
    for (const r of rows) {
      if (r.draft || r.prerelease) continue;
      const tag = r.tag_name ?? '';
      const version = tag.replace(/^v/, '');
      // Strict X.Y.Z: an unflagged "1.2.3-rc1" tag must not show as a normal release.
      if (!STRICT_SEMVER.test(version) || byVersion.has(version)) continue;
      // 0.x builds were internal update-pipeline tests, not user-facing releases.
      if (version.startsWith('0.')) continue;
      byVersion.set(version, {
        version,
        tag,
        publishedAt: r.published_at ?? '',
        body: r.body ?? '',
        prerelease: false,
      });
    }
    url = nextLink(res.headers?.get?.('link') ?? null);
  }
  return [...byVersion.values()].sort((a, b) => compareVersions(b.version, a.version));
}

/** Releases strictly between `from` and `to` (exclusive), newest first. */
export function selectRollup(
  releases: ReleaseEntry[],
  from: string | null | undefined,
  to: string,
): ReleaseEntry[] {
  if (!from || !validate(from) || !validate(to)) return [];
  return releases
    .filter(
      (r) =>
        !r.prerelease && compareVersions(r.version, from) > 0 && compareVersions(r.version, to) < 0,
    )
    .sort((a, b) => compareVersions(b.version, a.version));
}
