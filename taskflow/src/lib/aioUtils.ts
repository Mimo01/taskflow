/**
 * Shared AIO status normalizers.
 *
 * Lifted verbatim from AioCycleDetailPage.tsx so all AIO pages share a single
 * source of truth. Plan 02 (cycles redesign) and Plan 03 (cycle detail tabs)
 * import from here rather than re-defining locally.
 */

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

/**
 * Maps numeric AIO status IDs to canonical status strings.
 * Source: UI-SPEC.md Status Color Palette + CONTEXT.md D-05. Five entries only.
 * Used by progress-bar rendering in AioProjectOverviewPage (Plan 57-04).
 */
export const AIO_STATUS_MAP: Record<number, 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress'> =
  {
    51: 'notRun',
    52: 'inProgress',
    53: 'pass',
    54: 'fail',
    55: 'blocked',
    901: 'pass', // N/A — statusType PASSED per /config
  };

/**
 * Resolve a numeric AIO status ID to its canonical status string.
 * Falls back to 'notRun' for any unknown ID — never throws.
 * NOTE: testRunDistribution keys are JSON strings — always call Number(key) before this (Pitfall 3).
 */
export function normalizeStatusById(
  id: number,
): 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress' {
  return AIO_STATUS_MAP[id] ?? 'notRun';
}
