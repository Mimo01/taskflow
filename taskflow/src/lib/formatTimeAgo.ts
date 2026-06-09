/**
 * Time-ago formatting helpers built on `Intl.RelativeTimeFormat`.
 *
 * Phase 73 R-03: third-party time-format libraries are not project
 * dependencies. The existing convention (see
 * `routes/dashboard/IssueDetailContent.tsx:37-45`) uses
 * `Intl.RelativeTimeFormat`. These helpers extract that pattern so the
 * sprint-board TaskCard `timeInColumn` badge (Plan 02) can render unix-ms
 * `enteredStatus` values without coupling to the dashboard module.
 *
 * Two exports:
 *   - `formatTimeAgoStrict(ms)` — compact badge text: `"30s" / "1m" / "1h" / "1d"`.
 *   - `formatTimeAgo(ms)` — natural phrasing for the badge `title` attribute,
 *     produced by `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`.
 *
 * Both helpers clamp future timestamps so a clock skew or stale envelope
 * can never produce a NaN or negative-duration UI value (threat T-73-02).
 */

const SECOND = 1;
const MINUTE = 60;
const HOUR = 3_600;
const DAY = 86_400;
const YEAR_SECS = 365 * DAY;

/**
 * Compact time-ago badge text for unix-millisecond `enteredStatus`.
 *
 * Output: `"30s"`, `"5m"`, `"3h"`, `"7d"`. Future timestamps (clock skew or
 * stale envelope) clamp to `"0s"` rather than producing a negative string.
 */
export function formatTimeAgoStrict(enteredStatusMs: number): string {
  const diffSecs = Math.floor((Date.now() - enteredStatusMs) / 1000);
  if (diffSecs < 0) return '0s';
  if (diffSecs < MINUTE) return `${diffSecs}s`;
  if (diffSecs < HOUR) return `${Math.floor(diffSecs / MINUTE)}m`;
  if (diffSecs < DAY) return `${Math.floor(diffSecs / HOUR)}h`;
  return `${Math.floor(diffSecs / DAY)}d`;
}

/**
 * Natural-language time-ago phrasing for the badge `title` attribute.
 *
 * Uses `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` to match the
 * existing `IssueDetailContent.relativeTime` pattern (R-03). Future
 * timestamps (or `enteredStatus === Date.now()`) clamp to `"now"`.
 *
 * Locale-specific exact output is intentionally not asserted in callers —
 * Node `Intl` output is platform-implementation-specific. Tests assert
 * non-empty + presence of expected unit substring instead.
 */
export function formatTimeAgo(enteredStatusMs: number): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffSecs = Math.floor((Date.now() - enteredStatusMs) / 1000);
  if (diffSecs <= 0) return 'now';
  if (diffSecs < MINUTE) return rtf.format(-diffSecs * SECOND, 'second');
  if (diffSecs < HOUR) return rtf.format(-Math.floor(diffSecs / MINUTE), 'minute');
  if (diffSecs < DAY) return rtf.format(-Math.floor(diffSecs / HOUR), 'hour');
  if (diffSecs >= YEAR_SECS) {
    const years = Math.floor(diffSecs / YEAR_SECS);
    const remainingDays = Math.floor((diffSecs % YEAR_SECS) / DAY);
    const yearLabel = years === 1 ? '1 year' : `${years} years`;
    return remainingDays === 0
      ? `${yearLabel} ago`
      : `${yearLabel} ${remainingDays} day${remainingDays === 1 ? '' : 's'} ago`;
  }
  return rtf.format(-Math.floor(diffSecs / DAY), 'day');
}
