/**
 * Standup date utilities for the Yesterday recap feature.
 *
 * Provides "last working day" resolution (with weekend + Tempo holiday skip)
 * and Jira key extraction from commit messages and branch names.
 *
 * Date handling: NEVER use toLocaleDateString() (locale-formatted, unstable).
 * For API string timestamps, slice(0, 10). For dates derived from `new Date()`
 * or local components, format with toLocalDateString() below — NOT toISOString(),
 * which converts to UTC and shifts the calendar day off-by-one for users east of
 * UTC or at day boundaries.
 */

import type { ScheduleDayType } from '@/services/tempo';

/**
 * Format a Date as a YYYY-MM-DD string using its LOCAL calendar components.
 *
 * Never use toISOString() here: that converts to UTC, so for a Date evaluated
 * by local getDay()/getDate() the returned string can land on the wrong day
 * (off-by-one) for users east of UTC or at the edges of the day. Local
 * components keep the string aligned with the day the rest of the logic sees.
 */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Resolve the "yesterday" date for standup purposes — the most recent working day
 * before today.
 *
 * Algorithm (D-15):
 * 1. Start from today − 1 calendar day.
 * 2. While candidate falls on Saturday (6) or Sunday (0), subtract one more day.
 * 3. If `tempoSchedule` is provided, additionally skip days where the schedule
 *    type is 'HOLIDAY' (Tempo public holiday).
 * 4. A 14-iteration safety cap prevents infinite loops in pathological inputs.
 *
 * @param tempoSchedule  Optional map of YYYY-MM-DD → ScheduleDayType from
 *                       fetchUserSchedule(). Pass `undefined` when Tempo is
 *                       disabled — weekend-skip-only mode is used.
 * @returns YYYY-MM-DD string for the last working day.
 */
export function resolveYesterdayDate(tempoSchedule?: Map<string, ScheduleDayType>): string {
  const today = new Date();
  const candidate = new Date(today);
  candidate.setDate(today.getDate() - 1);

  for (let i = 0; i < 14; i++) {
    const dow = candidate.getDay();
    const dateStr = toLocalDateString(candidate);

    // Skip weekends
    if (dow === 0 || dow === 6) {
      candidate.setDate(candidate.getDate() - 1);
      continue;
    }

    // Skip Tempo holidays when schedule is provided
    if (tempoSchedule?.get(dateStr) === 'HOLIDAY') {
      candidate.setDate(candidate.getDate() - 1);
      continue;
    }

    return dateStr;
  }

  // Fallback: safety cap reached — return whatever candidate we have
  return toLocalDateString(candidate);
}

/**
 * Build a list of recent calendar days (most-recent-first) as YYYY-MM-DD strings.
 *
 * Returns `count` entries: index 0 = today − 1, index count−1 = today − count.
 *
 * Date math uses LOCAL calendar components — never toISOString() (which converts
 * to UTC and shifts the date for users east of UTC or at day boundaries), matching
 * the Phase 62 standing rule applied throughout this module.
 *
 * @param count  Number of past days to include (typically 14).
 * @returns Array of YYYY-MM-DD strings, most-recent-first.
 */
export function buildRecentDayOptions(count: number): string[] {
  const base = new Date();
  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    result.push(toLocalDateString(d));
  }
  return result;
}

/**
 * Returns today's calendar date as a YYYY-MM-DD string.
 *
 * Uses LOCAL calendar components via toLocalDateString(new Date()) — never
 * toISOString() (which converts to UTC and shifts the date for users east of UTC
 * or at day boundaries), matching the standing rule documented in the file header.
 *
 * @returns Today's date as a YYYY-MM-DD string.
 */
export function getTodayDate(): string {
  return toLocalDateString(new Date());
}

/**
 * Returns the date range needed to fetch the Tempo schedule for holiday detection.
 *
 * Covers 14 days before today so that the schedule map contains entries for
 * resolveYesterdayDate() to check even across long holiday stretches.
 *
 * @returns Object with `from` and `to` as YYYY-MM-DD strings.
 */
export function getScheduleLookbackRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 14);
  return {
    from: toLocalDateString(from),
    to: toLocalDateString(today),
  };
}

/**
 * Shared regex for Jira key extraction.
 * Matches the first occurrence of an uppercase project key + issue number.
 * Pattern: one uppercase letter, followed by uppercase letters or digits,
 * a hyphen, and one or more digits (e.g. PROJ-123, AB12-9, ESHOP-456).
 *
 * Non-global so repeated calls never carry lastIndex state.
 */
const JIRA_KEY_REGEX = /[A-Z][A-Z0-9]+-\d+/;

/**
 * Extract the first Jira issue key from a commit message.
 *
 * Matches uppercase-only project prefixes (e.g. PROJ-123, ESHOP-456).
 * Does NOT match lowercase prefixes (e.g. abc-1 → null).
 *
 * @param message  Commit message string.
 * @returns The first matching Jira key, or null if none found.
 */
export function extractJiraKeyFromMessage(message: string): string | null {
  const match = message.match(JIRA_KEY_REGEX);
  return match ? match[0] : null;
}

/**
 * Extract the first Jira issue key from a Git branch name.
 *
 * Typical patterns: `feature/PROJ-456-description`, `ESHOP-123-fix-cart`.
 * Does NOT match lowercase project prefixes.
 *
 * @param branchName  Git branch name string.
 * @returns The first matching Jira key, or null if none found.
 */
export function extractJiraKeyFromBranch(branchName: string): string | null {
  const match = branchName.match(JIRA_KEY_REGEX);
  return match ? match[0] : null;
}
