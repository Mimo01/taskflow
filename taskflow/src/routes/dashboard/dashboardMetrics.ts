/**
 * dashboardMetrics.ts — Phase 86 survivors
 *
 * Pure derivation functions for Dashboard components.
 * NO React, NO hooks. Importable in unit tests without any DOM environment.
 *
 * Survivors after Phase 86 clean slate (D-01):
 *   - filterNonSubtasks (used by MyIssuesCard)
 *   - formatHoursMinutes (used by HoursCommitsChart)
 *
 * All other exports (computePersonalTileCounts, computeSpDone, computeSpTotal,
 * computeDonutData, getDaysRemaining, WeekBucket, DAILY_TARGET_HOURS, buildWeekBuckets,
 * ActivityEntry, mergeActivityEntries, VelocityPoint, computePersonalVelocitySeries,
 * BurndownPoint, parseBurndownChanges, buildIdealGuideline) removed in Phase 86 —
 * their consumers (StatTile, SprintHealthSection, WeeklyTrendChart, ActivityStrip,
 * VelocityChart, BurndownChart) were deleted as part of D-01 clean slate.
 */
import type { JiraIssue } from '@/services/jira';

/**
 * Filter out subtask issues. Uses the boolean `issuetype.subtask` field —
 * never a name comparison (admin can rename issue types).
 */
export function filterNonSubtasks(issues: JiraIssue[]): JiraIssue[] {
  return issues.filter((i) => !i.fields.issuetype.subtask);
}

/**
 * Formats decimal hours as a human-readable h+m string.
 * 1.5 → "1h 30m", 8 → "8h", 0.25 → "15m". Minutes rounded to the nearest minute.
 *
 * Single source of truth for the hours axis/tooltip formatter.
 * Used by HoursCommitsChart for logged-hours bar labels and header totals.
 * Unit is HOURS — never SP.
 */
export function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
