/**
 * Standup date utilities for the Yesterday recap feature.
 *
 * Provides "last working day" resolution (with weekend + Tempo holiday skip)
 * and Jira key extraction from commit messages and branch names.
 *
 * NEVER use toLocaleDateString() for date computation — always use
 * toISOString().slice(0, 10) for timezone-stable ISO date strings. (Phase 62 rule)
 */

import type { ScheduleDayType } from '@/services/tempo';

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
export function resolveYesterdayDate(
  tempoSchedule?: Map<string, ScheduleDayType>,
): string {
  const today = new Date();
  const candidate = new Date(today);
  candidate.setDate(today.getDate() - 1);

  for (let i = 0; i < 14; i++) {
    const dow = candidate.getDay();
    const dateStr = candidate.toISOString().slice(0, 10);

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
  return candidate.toISOString().slice(0, 10);
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
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
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
