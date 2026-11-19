/**
 * Shared utilities for Developer Tools components.
 */
import { isPending } from '../../lib/dev-tools/log-entry';
import type { ApiLogEntry } from '../../stores/debug-log.store';

export function formatBody(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Pending requests read as muted text with no tint; they are never an error. */
export function statusColor(status: number | null, pending = false): string {
  if (pending) return 'text-muted-foreground';
  if (status === null) return 'bg-red-500/15 text-red-600 dark:text-red-400';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'bg-red-500/15 text-red-600 dark:text-red-400';
}

/** Status pill for the inspector header: status colour (the only colour on a row) on a tint. */
export function statusPillClass(status: number | null, pending = false): string {
  const base = 'rounded px-1.5 py-0.5 font-mono text-xs font-semibold';
  if (pending) return `${base} bg-muted text-muted-foreground`;
  if (status !== null && status >= 200 && status < 300) {
    return `${base} bg-green-500/15 text-green-600 dark:text-green-400`;
  }
  if (status !== null && status >= 300 && status < 400) {
    return `${base} bg-yellow-500/15 text-yellow-600 dark:text-yellow-400`;
  }
  return `${base} ${statusColor(status)}`;
}

/** Row status text colour (no tint). Pending is muted. */
export function statusText(status: number | null, pending = false): string {
  if (pending) return 'text-muted-foreground';
  if (status === null) return 'text-red-600 dark:text-red-400';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Bar colour for a request on the waterfall and timeline: status only.
 * ok neutral, 4xx amber, 5xx or network error red, pending muted and pulsing.
 */
export function timelineBarClass(entry: Pick<ApiLogEntry, 'state' | 'status'>): string {
  if (isPending(entry)) return 'bg-muted-foreground/40 animate-pulse';
  const { status } = entry;
  if (status === null || status >= 500) return 'bg-red-500/70';
  if (status >= 400) return 'bg-amber-500/70';
  return 'bg-foreground/30';
}

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function sourceBadgeClass(source: 'jira' | 'gitlab' | 'updater' | 'aio' | 'tempo'): string {
  const base = 'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase';
  if (source === 'jira') {
    return `${base} bg-orange-500/15 text-orange-600 dark:text-orange-400`;
  }
  if (source === 'updater') {
    return `${base} bg-sky-500/15 text-sky-600 dark:text-sky-400`;
  }
  if (source === 'tempo') {
    return `${base} bg-green-500/15 text-green-600 dark:text-green-400`;
  }
  if (source === 'aio') {
    return `${base} bg-teal-500/15 text-teal-600 dark:text-teal-400`;
  }
  return `${base} bg-purple-500/15 text-purple-600 dark:text-purple-400`;
}
