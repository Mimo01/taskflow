/**
 * Pure helpers for reading an ApiLogEntry's lifecycle and timing.
 * Legacy entries (no `state` / `startedAt`) fall back to values derived from status and timestamp.
 */
import type { ApiLogEntry } from '../../stores/debug-log.store';

export type EntryState = 'pending' | 'done' | 'error';

export function entryState(e: Pick<ApiLogEntry, 'state' | 'status'>): EntryState {
  if (e.state) return e.state;
  return e.status === null ? 'error' : 'done';
}

export function isPending(e: Pick<ApiLogEntry, 'state' | 'status'>): boolean {
  return entryState(e) === 'pending';
}

/** Start time in epoch ms (fractional when captured with high resolution). */
export function entryStart(e: Pick<ApiLogEntry, 'startedAt' | 'timestamp'>): number {
  return e.startedAt ?? Date.parse(e.timestamp);
}

/** End time in epoch ms: `now` while the request is still pending. */
export function entryEnd(
  e: Pick<ApiLogEntry, 'startedAt' | 'timestamp' | 'endedAt' | 'state' | 'status' | 'durationMs'>,
  now: number,
): number {
  if (e.endedAt !== undefined) return e.endedAt;
  if (isPending(e)) return now;
  return entryStart(e) + e.durationMs;
}

/** High-resolution epoch ms. */
export function nowMs(): number {
  return performance.timeOrigin + performance.now();
}

/** Current app route path ('/dashboard'), without the leading '#' or any query. */
export function currentRoute(): string {
  if (typeof window === 'undefined') return '';
  const raw = window.location.hash.replace(/^#/, '').split('?')[0];
  return raw === '' ? '/' : raw;
}
