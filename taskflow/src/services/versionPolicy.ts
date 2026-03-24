/**
 * versionPolicy — Fetches and validates version-policy.json from a remote URL.
 *
 * Fail-open semantics (D-16): any fetch error, non-OK response, or malformed JSON
 * returns null — app continues normally with no banner or overlay shown.
 *
 * isBelow() performs semver comparison using compare-versions library.
 * Dev builds (version containing '-dev' or '0.0.0-dev') always skip enforcement.
 */
import { fetch } from '@tauri-apps/plugin-http';
import { compareVersions } from 'compare-versions';

export interface VersionPolicy {
  softMinimum: string;
  hardMinimum: string;
  message?: string;
}

/**
 * Fetches and validates version-policy.json from the given URL.
 * Returns null on any error (fail-open per D-16).
 */
export async function fetchVersionPolicy(url: string): Promise<VersionPolicy | null> {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d.softMinimum !== 'string' || typeof d.hardMinimum !== 'string') return null;
    return {
      softMinimum: d.softMinimum,
      hardMinimum: d.hardMinimum,
      message: typeof d.message === 'string' ? d.message : undefined,
    };
  } catch {
    return null; // D-16: fail-open
  }
}

/**
 * Returns true if `current` is strictly below `minimum` per semver.
 * Fails open: returns false on parse error or dev builds.
 */
export function isBelow(current: string, minimum: string): boolean {
  if (current.includes('-dev') || current === '0.0.0-dev') return false;
  try {
    return compareVersions(current, minimum) < 0;
  } catch {
    return false; // fail-open on parse error
  }
}
