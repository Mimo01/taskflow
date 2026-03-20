/**
 * Shared utilities for Developer Tools components.
 */

export function formatBody(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function statusColor(status: number | null): string {
  if (status === null) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function sourceBadgeClass(source: 'jira' | 'gitlab'): string {
  const base = 'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase';
  if (source === 'jira') {
    return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300`;
  }
  return `${base} bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300`;
}
