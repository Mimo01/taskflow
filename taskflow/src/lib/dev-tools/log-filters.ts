/**
 * Pure filtering helpers for the Developer Tools Logs tab.
 */
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { entryState } from './log-entry';

export type StatusClass = 'error' | '2xx' | '3xx' | '4xx' | '5xx' | '1xx' | 'pending';

export const NO_OPERATION = '(none)';
export const STATUS_FACETS = ['2xx', '3xx', '4xx', '5xx', 'errors', 'pending'] as const;

/** Status class of an entry; a pending entry is its own class and never an error. */
export function entryStatusClass(entry: ApiLogEntry): StatusClass {
  if (entryState(entry) === 'pending') return 'pending';
  return statusClass(entry.status);
}

export function statusClass(status: number | null): StatusClass {
  if (status === null) return 'error';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return '1xx';
}

export interface LogFilters {
  search: string;
  sources: Set<string>;
  statuses: Set<string>;
  methods: Set<string>;
  operations: Set<string>;
}

function matchesStatus(entry: ApiLogEntry, statuses: Set<string>): boolean {
  if (statuses.size === 0) return true;
  if (entryState(entry) === 'pending') return statuses.has('pending');
  const isError = entry.status === null || entry.status >= 400;
  if (statuses.has('errors') && isError) return true;
  return statuses.has(statusClass(entry.status));
}

const haystackCache = new WeakMap<ApiLogEntry, string>();

/** Lowercase search text for an entry, computed once per entry object (WR-04). */
export function searchHaystack(entry: ApiLogEntry): string {
  let hay = haystackCache.get(entry);
  if (hay === undefined) {
    hay = `${entry.url}\n${entry.requestBody ?? ''}\n${entry.responseBody}`.toLowerCase();
    haystackCache.set(entry, hay);
  }
  return hay;
}

/** Empty facet sets mean "all". Search is a case-insensitive substring match (never a regex). */
export function filterLogs(entries: ApiLogEntry[], filters: LogFilters): ApiLogEntry[] {
  const needle = filters.search.trim().toLowerCase();
  return entries.filter((e) => {
    if (filters.sources.size > 0 && !filters.sources.has(e.source)) return false;
    if (filters.methods.size > 0 && !filters.methods.has(e.method)) return false;
    if (!matchesStatus(e, filters.statuses)) return false;
    if (filters.operations.size > 0 && !filters.operations.has(e.operation ?? NO_OPERATION)) {
      return false;
    }
    if (needle) {
      if (!searchHaystack(e).includes(needle)) return false;
    }
    return true;
  });
}

export function facetOptions(entries: ApiLogEntry[]): {
  sources: string[];
  methods: string[];
  operations: string[];
} {
  const sources = new Set<string>();
  const methods = new Set<string>();
  const operations = new Set<string>();
  for (const e of entries) {
    sources.add(e.source);
    methods.add(e.method);
    operations.add(e.operation ?? NO_OPERATION);
  }
  return {
    sources: [...sources].sort(),
    methods: [...methods].sort(),
    operations: [...operations].sort(),
  };
}
