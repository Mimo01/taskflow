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
