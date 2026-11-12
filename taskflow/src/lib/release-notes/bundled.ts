/**
 * Bundled release notes — the CHANGELOG.md shipped inside this build.
 *
 * GitHub release bodies (and tag annotations) are immutable history and older
 * releases are wordy. CHANGELOG.md holds the concise rewrite, so for every
 * version it covers the app prefers it. Versions newer than this build (not in
 * the bundle yet) keep their GitHub body. Older clients are unaffected: they
 * still read GitHub bodies / latest.json as before.
 */
import changelogRaw from '../../../CHANGELOG.md?raw';

const SECTION_RE = /^## \[([^\]]+)\][^\n]*\n/gm;
const STRICT_SEMVER = /^\d+\.\d+\.\d+$/;

/** Map of X.Y.Z version → section body. Milestone-style "1.7" headers are skipped. */
export function parseChangelog(md: string): Map<string, string> {
  const out = new Map<string, string>();
  const heads = [...md.matchAll(SECTION_RE)];
  heads.forEach((m, i) => {
    const version = m[1].trim();
    if (!STRICT_SEMVER.test(version) || out.has(version)) return;
    const start = (m.index ?? 0) + m[0].length;
    const end = heads[i + 1]?.index ?? md.length;
    const body = md.slice(start, end).trim();
    if (body) out.set(version, body);
  });
  return out;
}

let cache: Map<string, string> | null = null;

export function bundledNotes(): Map<string, string> {
  cache ??= parseChangelog(changelogRaw);
  return cache;
}

/** Concise bundled notes for a version, or null when this build doesn't know it. */
export function bundledNotesFor(version: string | null | undefined): string | null {
  return version ? (bundledNotes().get(version) ?? null) : null;
}

/** Replace each release body with the bundled concise notes where available. */
export function withBundledNotes<T extends { version: string; body: string }>(
  releases: T[],
  notes: Map<string, string> = bundledNotes(),
): T[] {
  return releases.map((r) => {
    const body = notes.get(r.version);
    return body ? { ...r, body } : r;
  });
}
