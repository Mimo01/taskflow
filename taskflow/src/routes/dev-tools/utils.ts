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
    return `${base} bg-orange-500/15 text-orange-600 dark:text-orange-400`;
  }
  return `${base} bg-purple-500/15 text-purple-600 dark:text-purple-400`;
}
