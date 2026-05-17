/**
 * Unified Jira status category styling.
 *
 * All status badges in the app should use these functions instead of
 * local STATUS_CATEGORY_STYLES constants or regex-based helpers.
 *
 * Jira status categories: "new" (To Do), "indeterminate" (In Progress), "done" (Done).
 */

const BADGE_STYLES: Record<string, string> = {
  new: 'bg-muted text-muted-foreground',
  indeterminate: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  done: 'bg-green-500/15 text-green-600 dark:text-green-400',
};

const DOT_STYLES: Record<string, string> = {
  new: 'bg-gray-400',
  indeterminate: 'bg-blue-500',
  done: 'bg-green-500',
};

/** Tailwind classes for a status badge (pill / chip) given a statusCategory.key */
export function statusCategoryBadgeClass(categoryKey: string | undefined): string {
  return BADGE_STYLES[categoryKey ?? 'new'] ?? BADGE_STYLES.new;
}

/** Tailwind classes for a small status dot given a statusCategory.key */
export function statusCategoryDotClass(categoryKey: string | undefined): string {
  return DOT_STYLES[categoryKey ?? 'new'] ?? DOT_STYLES.new;
}

const AIO_CYCLE_BADGE_STYLES: Record<string, string> = {
  Active: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Closed: 'bg-muted text-muted-foreground',
};

/** Tailwind classes for an AIO cycle status badge given a capitalized status string (e.g. "Active", "Closed") */
export function aioCycleStatusBadgeClass(status: string): string {
  return AIO_CYCLE_BADGE_STYLES[status] ?? 'bg-muted text-muted-foreground';
}

const AIO_RUN_BADGE_STYLES: Record<string, string> = {
  PASS: 'bg-green-500/15 text-green-600 dark:text-green-400',
  FAIL: 'bg-red-500/15 text-red-600 dark:text-red-400',
  BLOCKED: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  NOT_EXECUTED: 'bg-muted text-muted-foreground',
};

/** Tailwind classes for an AIO test run status badge given an uppercase status string (e.g. "PASS", "FAIL", "BLOCKED", "NOT_EXECUTED") */
export function aioRunStatusBadgeClass(status: string): string {
  return AIO_RUN_BADGE_STYLES[status] ?? 'bg-muted text-muted-foreground';
}

// ── Unified pill helpers ───────────────────────────────────────────────────────
//
// These helpers return the FULL className for a status pill (layout + color).
// Callers must NOT add additional geometry classes such as `rounded*`, `px-*`,
// `py-*`, `text-xs`, `font-*`, `inline-flex`, `min-w-*`, or `text-center` —
// all of those are already included in STATUS_PILL_LAYOUT_CLASS.
//
// For non-pill renderings that only need the color tokens (e.g. a <Badge>
// component with its own geometry), continue using the color-only helpers above.

/**
 * Shared layout class applied to every status pill across the app.
 * Matches the sprint board reference style.
 */
export const STATUS_PILL_LAYOUT_CLASS =
  'shrink-0 min-w-[5.5rem] text-center rounded px-1.5 py-0.5 text-xs font-medium';

/**
 * Full className for a Jira status pill (layout + color).
 * Do NOT add additional geometry classes when using this helper.
 */
export function statusPillClass(categoryKey: string | undefined): string {
  return `${STATUS_PILL_LAYOUT_CLASS} ${statusCategoryBadgeClass(categoryKey)}`;
}

/**
 * Full className for an AIO cycle status pill (layout + color).
 * Do NOT add additional geometry classes when using this helper.
 */
export function aioCycleStatusPillClass(status: string): string {
  return `${STATUS_PILL_LAYOUT_CLASS} ${aioCycleStatusBadgeClass(status)}`;
}

/**
 * Full className for an AIO test run / step status pill (layout + color).
 * Do NOT add additional geometry classes when using this helper.
 */
export function aioRunStatusPillClass(status: string): string {
  return `${STATUS_PILL_LAYOUT_CLASS} ${aioRunStatusBadgeClass(status)}`;
}
