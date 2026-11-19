/**
 * Pure derivation of query-cache activity events by diffing a query's state between cache events.
 * No React; the app-level subscriber lives in hooks/useQueryActivityCapture.
 */
import { entryStart } from './log-entry';

export type QueryActivityKind = 'fetch' | 'success' | 'error' | 'invalidated' | 'removed';

export interface QuerySnap {
  fetchStatus: string;
  status: string;
  isInvalidated: boolean;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
}

/** Structural subset of a TanStack Query. */
interface SnapSource {
  state: {
    fetchStatus: string;
    status: string;
    isInvalidated: boolean;
    dataUpdatedAt: number;
    errorUpdatedAt: number;
  };
}

export function snapshotQuery(query: SnapSource): QuerySnap {
  const s = query.state;
  return {
    fetchStatus: s.fetchStatus,
    status: s.status,
    isInvalidated: s.isInvalidated,
    dataUpdatedAt: s.dataUpdatedAt,
    errorUpdatedAt: s.errorUpdatedAt,
  };
}

const INITIAL: QuerySnap = {
  fetchStatus: 'idle',
  status: 'pending',
  isInvalidated: false,
  dataUpdatedAt: 0,
  errorUpdatedAt: 0,
};

/** Events implied by moving from `prev` to `next` (`null` means the query was removed). */
export function diffQueryActivity(
  prev: QuerySnap | undefined,
  next: QuerySnap | null,
): QueryActivityKind[] {
  if (next === null) return ['removed'];
  const p = prev ?? INITIAL;
  const out: QueryActivityKind[] = [];
  if (p.fetchStatus !== 'fetching' && next.fetchStatus === 'fetching') out.push('fetch');
  if (next.status === 'success' && next.dataUpdatedAt > p.dataUpdatedAt) out.push('success');
  if (next.errorUpdatedAt > p.errorUpdatedAt || (next.status === 'error' && p.status !== 'error')) {
    out.push('error');
  }
  if (!p.isInvalidated && next.isInvalidated) out.push('invalidated');
  return out;
}

/** A request that starts this soon after a cache marker was likely caused by it. */
export const CORRELATION_WINDOW_MS = 150;

/** Ids of the entries whose start falls within [markerAt, markerAt + windowMs]. */
export function correlatedRequestIds(
  markerAt: number,
  entries: { id: string; startedAt?: number; timestamp: string }[],
  windowMs = CORRELATION_WINDOW_MS,
): Set<string> {
  const ids = new Set<string>();
  for (const e of entries) {
    const start = entryStart(e);
    if (start >= markerAt && start <= markerAt + windowMs) ids.add(e.id);
  }
  return ids;
}
