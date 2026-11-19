/**
 * useQueryCacheRows — throttled useSyncExternalStore snapshot of the TanStack Query cache.
 *
 * Query objects are mutated in place, so the snapshot is a fresh array of plain rows rebuilt
 * (coalesced to 250ms) on cache events plus a 1s tick (time-based staleness and relative times
 * change without any cache event). The store is built once per client; subscribe/getSnapshot
 * identity is stable so React does not resubscribe each render.
 */
import type { QueryClient } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';
import {
  type CacheRow,
  type QueryLike,
  toCacheRow,
} from '../../lib/dev-tools/query-cache-snapshot';

const COALESCE_MS = 250;
const TICK_MS = 1000;

function defaultStaleTime(client: QueryClient): number {
  const st = client.getDefaultOptions().queries?.staleTime;
  return typeof st === 'number' ? st : 0;
}

function buildRows(client: QueryClient): CacheRow[] {
  const now = Date.now();
  const staleTime = defaultStaleTime(client);
  return client
    .getQueryCache()
    .getAll()
    .map((q) => toCacheRow(q as unknown as QueryLike, staleTime, now));
}

function createStore<T>(client: QueryClient, build: (c: QueryClient) => T) {
  let snapshot = build(client);
  const listeners = new Set<() => void>();
  let unsubscribeCache: (() => void) | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let pending: ReturnType<typeof setTimeout> | null = null;

  const rebuild = () => {
    const next = build(client);
    // Primitive snapshots (counts) keep identity when unchanged.
    if (Array.isArray(next) || next !== snapshot) {
      snapshot = next;
      for (const l of listeners) l();
    }
  };
  const schedule = () => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      rebuild();
    }, COALESCE_MS);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        unsubscribeCache = client.getQueryCache().subscribe(schedule);
        tick = setInterval(rebuild, TICK_MS);
        // Cache may have changed between render and subscribe.
        schedule();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          unsubscribeCache?.();
          unsubscribeCache = null;
          if (tick) clearInterval(tick);
          tick = null;
          if (pending) clearTimeout(pending);
          pending = null;
        }
      };
    },
    getSnapshot: () => snapshot,
  };
}

export function useQueryCacheRows(client: QueryClient): CacheRow[] {
  const store = useMemo(() => createStore(client, buildRows), [client]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

const countOf = (client: QueryClient) => client.getQueryCache().getAll().length;

export function useQueryCacheCount(client: QueryClient): number {
  const store = useMemo(() => createStore(client, countOf), [client]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
