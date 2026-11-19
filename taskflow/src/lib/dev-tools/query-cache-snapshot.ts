/**
 * Pure helpers that turn live TanStack Query `Query` objects into plain rows for the Cache tab.
 *
 * Query instances are mutated in place, so the UI must never memoise on them (React Compiler
 * would see an unchanged reference). Rows are fresh plain objects built on every snapshot.
 */
import { safeStringify } from './json-preview';

/** Structural subset of TanStack's Query, so tests can pass a fake. */
export interface QueryLike {
  queryHash: string;
  queryKey: readonly unknown[];
  state: {
    status: 'pending' | 'error' | 'success';
    fetchStatus: 'fetching' | 'paused' | 'idle';
    dataUpdatedAt: number;
    errorUpdatedAt: number;
    isInvalidated: boolean;
    error: Error | null;
    data: unknown;
    dataUpdateCount: number;
    fetchFailureCount: number;
  };
  options: { gcTime?: number };
  getObserversCount: () => number;
  isActive: () => boolean;
  isDisabled: () => boolean;
  isStaleByTime: (staleTime?: number) => boolean;
}

export interface CacheRow {
  hash: string;
  key: readonly unknown[];
  keyLabel: string;
  status: 'pending' | 'error' | 'success';
  fetchStatus: 'fetching' | 'paused' | 'idle';
  stale: boolean;
  invalidated: boolean;
  observers: number;
  active: boolean;
  dataUpdatedAt: number;
  error: string | null;
}

const MAX_LABEL = 160;

export function formatQueryKey(key: readonly unknown[]): string {
  const label = key
    .map((part) => {
      if (part === undefined) return 'undefined';
      if (typeof part === 'string') return part;
      return safeStringify(part, 0);
    })
    .join(' › ');
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
}

export function toCacheRow(query: QueryLike, staleTimeMs: number, _now: number): CacheRow {
  const { state } = query;
  return {
    hash: query.queryHash,
    key: query.queryKey,
    keyLabel: formatQueryKey(query.queryKey),
    status: state.status,
    fetchStatus: state.fetchStatus,
    stale: state.isInvalidated || query.isStaleByTime(staleTimeMs),
    invalidated: state.isInvalidated,
    observers: query.getObserversCount(),
    active: query.isActive(),
    dataUpdatedAt: state.dataUpdatedAt,
    error: state.error ? state.error.message : null,
  };
}

export const CACHE_STATE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'fetching', label: 'Fetching' },
  { value: 'stale', label: 'Stale' },
  { value: 'error', label: 'Error' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'invalidated', label: 'Invalidated' },
] as const;

export function filterCacheRows(
  rows: CacheRow[],
  { search, state }: { search: string; state: string },
): CacheRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((r) => {
    if (needle && !r.keyLabel.toLowerCase().includes(needle)) return false;
    switch (state) {
      case 'fetching':
        return r.fetchStatus === 'fetching';
      case 'stale':
        return r.stale;
      case 'error':
        return r.status === 'error';
      case 'inactive':
        return r.observers === 0;
      case 'invalidated':
        return r.invalidated;
      default:
        return true;
    }
  });
}
