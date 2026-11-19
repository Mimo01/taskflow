/**
 * Pure filtering helpers for the Developer Tools Logs tab.
 */
import type { ApiLogEntry } from '../../stores/debug-log.store';

export type StatusClass = 'error' | '2xx' | '3xx' | '4xx' | '5xx' | '1xx';

export const NO_OPERATION = '(none)';
export const STATUS_FACETS = ['2xx', '3xx', '4xx', '5xx', 'errors'] as const;

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
  const isError = entry.status === null || entry.status >= 400;
  if (statuses.has('errors') && isError) return true;
  return statuses.has(statusClass(entry.status));
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
      const hay = `${e.url}\n${e.requestBody ?? ''}\n${e.responseBody}`.toLowerCase();
      if (!hay.includes(needle)) return false;
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
