/**
 * Duration parser/formatter for Jira time tracking.
 *
 * Jira uses a work-day model: 1d = 8h, 1w = 5d = 40h.
 * Accepts strings like "2h 30m", "1d 4h", "1w", "45m".
 * Returns seconds and a normalized display string.
 */

import type { ParsedDuration } from './types';

/** Seconds per unit using Jira's 8h workday model */
const UNIT_SECONDS: Record<string, number> = {
  w: 5 * 8 * 3600, // 144000
  d: 8 * 3600, // 28800
  h: 3600,
  m: 60,
};

/**
 * Parse a Jira duration string into seconds and a normalized display.
 *
 * @param input - Duration string like "2h 30m", "1d", "1w 2d 4h"
 * @returns ParsedDuration with seconds and display, or null if invalid/empty
 */
export function parseDuration(input: string): ParsedDuration | null {
  if (!input || !input.trim()) return null;

  const regex = /(\d+(?:\.\d+)?)\s*(w|d|h|m)/gi;
  let totalSeconds = 0;
  let matched = false;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const value = Number.parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = UNIT_SECONDS[unit];
    if (multiplier) {
      totalSeconds += value * multiplier;
      matched = true;
    }
  }

  if (!matched) return null;

  return {
    seconds: totalSeconds,
    display: formatDuration(totalSeconds),
  };
}

/**
 * Format seconds into a human-readable duration string.
 *
 * Uses hours and minutes only (no days/weeks) for unambiguous display.
 *
 * @param totalSeconds - Duration in seconds
 * @returns Formatted string like "2h 30m", "1h", "45m", "0m"
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}
