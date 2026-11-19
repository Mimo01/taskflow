import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { nowMs } from '../lib/dev-tools/log-entry';
import { diffQueryActivity, type QuerySnap, snapshotQuery } from '../lib/dev-tools/query-activity';
import { formatQueryKey } from '../lib/dev-tools/query-cache-snapshot';
import { useQueryActivityStore } from '../stores/query-activity.store';
import { useSettingsStore } from '../stores/settings.store';

/**
 * Records query-cache events (fetch, success, error, invalidated, removed) into the query-activity
 * store for the Developer Tools timeline. Mounted once at app level.
 *
 * Capture is gated on devToolsEnabled && requestLogging. When it is off the subscriber returns
 * immediately: no snapshotting, no key formatting. It writes only to its own store, never to
 * anything an app component renders from.
 */
export function useQueryActivityCapture(): void {
  const client = useQueryClient();
  useEffect(() => {
    const prev = new Map<string, QuerySnap>();
    return client.getQueryCache().subscribe((event) => {
      const { devToolsEnabled, requestLogging } = useSettingsStore.getState();
      if (!devToolsEnabled || !requestLogging) {
        if (prev.size > 0) prev.clear();
        return;
      }
      try {
        const query = event.query;
        const hash = query.queryHash;
        let kinds: ReturnType<typeof diffQueryActivity>;
        if (event.type === 'removed') {
          kinds = diffQueryActivity(prev.get(hash), null);
          prev.delete(hash);
        } else if (event.type === 'added' || event.type === 'updated') {
          const next = snapshotQuery(query);
          kinds = diffQueryActivity(prev.get(hash), next);
          prev.set(hash, next);
        } else {
          return;
        }
        if (kinds.length === 0) return;
        const keyLabel = formatQueryKey(query.queryKey);
        const append = useQueryActivityStore.getState().append;
        for (const kind of kinds) {
          append({ id: crypto.randomUUID(), at: nowMs(), kind, queryHash: hash, keyLabel });
        }
      } catch {
        // capture must never affect the app
      }
    });
  }, [client]);
}
