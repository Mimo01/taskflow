/**
 * standup-date.ts
 *
 * Pure utility functions for Standup Notes date resolution and Jira key extraction.
 *
 * - resolveYesterdayDate: returns the last working day as YYYY-MM-DD, skipping
 *   weekends and optionally Tempo-schedule holidays (STAND-02).
 * - getScheduleLookbackRange: returns a 14-day lookback range for Tempo schedule fetch.
 * - extractJiraKeyFromMessage: extracts the first Jira issue key from a commit message.
 * - extractJiraKeyFromBranch: extracts the first Jira issue key from a branch name.
 */

import type { ScheduleDayType } from '@/services/tempo';

/**
 * Returns the last working day relative to today.
 *
 * Algorithm (D-15):
 * 1. Start at today − 1 calendar day.
 * 2. Repeatedly subtract one day while the candidate is a Saturday (6) or Sunday (0).
 * 3. If a Tempo schedule map is provided, additionally skip days marked 'HOLIDAY'.
 * 4. Safety cap of 14 iterations prevents infinite loops.
 *
 * All date arithmetic uses ISO strings sliced to 10 chars — never toLocaleDateString().
 *
 * @param tempoSchedule Optional map of YYYY-MM-DD → ScheduleDayType from fetchUserSchedule.
 * @returns YYYY-MM-DD string of the last working day.
 */
export function resolveYesterdayDate(tempoSchedule?: Map<string, ScheduleDayType>): string {
  const today = new Date();
  const candidate = new Date(today);
  candidate.setDate(today.getDate() - 1);

  for (let i = 0; i < 14; i++) {
    const dow = candidate.getDay(); // 0 = Sun, 6 = Sat
    const dateStr = candidate.toISOString().slice(0, 10);

    if (dow !== 0 && dow !== 6 && tempoSchedule?.get(dateStr) !== 'HOLIDAY') {
      return dateStr;
    }

    candidate.setDate(candidate.getDate() - 1);
  }

  // Safety fallback: return the last computed date string
  return candidate.toISOString().slice(0, 10);
}

/**
 * Returns the lookback range for fetching the Tempo user schedule.
 *
 * Covers 14 calendar days before today to ensure holidays in any plausible
 * "last working day" window are captured.
 *
 * @returns { from: YYYY-MM-DD, to: YYYY-MM-DD }
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
 * Extracts the first Jira issue key from a commit message.
 *
 * Matches patterns like PROJ-123, ABC-1, AB12-99. Requires uppercase
 * project prefix — lowercase patterns are not matched.
 *
 * @param message Commit message string.
 * @returns The first matching issue key, or null if none found.
 */
export function extractJiraKeyFromMessage(message: string): string | null {
  const match = message.match(/[A-Z][A-Z0-9]+-\d+/);
  return match ? match[0] : null;
}

/**
 * Extracts the first Jira issue key from a Git branch name.
 *
 * Matches patterns like feature/PROJ-456-description → 'PROJ-456'.
 * Requires uppercase project prefix.
 *
 * @param branchName Git branch name string.
 * @returns The first matching issue key, or null if none found.
 */
export function extractJiraKeyFromBranch(branchName: string): string | null {
  const match = branchName.match(/[A-Z][A-Z0-9]+-\d+/);
  return match ? match[0] : null;
}
