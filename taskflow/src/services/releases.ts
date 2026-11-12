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
  const out: ReleaseEntry[] = [];
  let url: string | null = RELEASES_API_URL;
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: Response = await fetch(url);
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const rows = (await res.json()) as GitHubRelease[];
    for (const r of rows) {
      if (r.draft || r.prerelease) continue;
      const tag = r.tag_name ?? '';
      const version = tag.replace(/^v/, '');
      if (!validate(version)) continue;
      out.push({
        version,
        tag,
        publishedAt: r.published_at ?? '',
        body: r.body ?? '',
        prerelease: false,
      });
    }
    url = nextLink(res.headers?.get?.('link') ?? null);
  }
  return out.sort((a, b) => compareVersions(b.version, a.version));
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
