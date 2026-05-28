/**
 * Shared AIO status normalizers.
 *
 * Lifted verbatim from AioCycleDetailPage.tsx so all AIO pages share a single
 * source of truth. Plan 02 (cycles redesign) and Plan 03 (cycle detail tabs)
 * import from here rather than re-defining locally.
 */

import { fetchAioProjectConfig } from '@/services/aio/cycles';

/**
 * Maps a raw AIO test run status string to the canonical four-value union
 * used for progress-bar counting and filter chips.
 *
 * PASS → 'pass', FAIL → 'fail', BLOCKED → 'blocked', anything else → 'notRun'
 */
export function normalizeStatus(raw: string | undefined): 'pass' | 'fail' | 'blocked' | 'notRun' {
  switch ((raw ?? '').toUpperCase()) {
    case 'PASS':
      return 'pass';
    case 'FAIL':
      return 'fail';
    case 'BLOCKED':
      return 'blocked';
    default:
      return 'notRun';
  }
}

/**
 * Maps a raw AIO test run status string to a human-readable label for display
 * in status chips and table cells.
 *
 * PASS → 'Pass', FAIL → 'Fail', BLOCKED → 'Blocked',
 * NOT_EXECUTED → 'Not Run', anything else → original value or 'Not Run'
 */
export function normalizeStatusLabel(raw: string | undefined): string {
  switch ((raw ?? '').toUpperCase()) {
    case 'PASS':
      return 'Pass';
    case 'FAIL':
      return 'Fail';
    case 'BLOCKED':
      return 'Blocked';
    case 'NOT_EXECUTED':
      return 'Not Run';
    default:
      return raw ?? 'Not Run';
  }
}

// ─── Runtime AIO status map (CLEAN-07) ──────────────────────────────────────
//
// Populated by initializeAioStatusMap() when AIO integration activates.
// normalizeStatusById reads this cache — returns 'notRun' for any unknown ID.

const STATUS_TYPE_MAP: Record<string, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> = {
  PASSED: 'pass',
  FAILED: 'fail',
  BLOCKED: 'blocked',
  NOT_RUN: 'notRun',
  IN_PROGRESS: 'inProgress',
};

let runtimeAioStatusMap: Record<number, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> = {};

/**
 * Initialize AIO status map from the live /config endpoint.
 * Call once when AIO integration activates (credentials confirmed, project selected).
 * Silently no-ops on failure — normalizeStatusById falls back to 'notRun' for all IDs.
 *
 * Reuses fetchAioProjectConfig from cycles.ts — does not duplicate the HTTP call.
 * React Query caches the /config response, so subsequent calls serve from cache.
 */
export async function initializeAioStatusMap(
  baseUrl: string,
  token: string,
  jiraProjectId: number,
): Promise<void> {
  try {
    const statuses = await fetchAioProjectConfig(baseUrl, token, jiraProjectId);
    runtimeAioStatusMap = Object.fromEntries(
      statuses.map((s) => [s.ID, STATUS_TYPE_MAP[s.statusType] ?? 'notRun']),
    );
  } catch {
    // Fail silently — normalizeStatusById falls back to 'notRun' for all IDs
    runtimeAioStatusMap = {};
  }
}

/**
 * Resolve a numeric AIO status ID to its canonical status string.
 * Reads the runtime map populated by initializeAioStatusMap().
 * Falls back to 'notRun' for any unknown ID — never throws.
 * NOTE: testRunDistribution keys are JSON strings — always call Number(key) before this (Pitfall 3).
 */
export function normalizeStatusById(
  id: number,
): 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress' {
  return runtimeAioStatusMap[id] ?? 'notRun';
}
