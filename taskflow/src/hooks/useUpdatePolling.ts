/**
 * useUpdatePolling — TanStack Query polling hook for app update checks.
 *
 * Mirrors useNotificationPolling pattern. Fires after a launch delay (D-03),
 * runs silently (D-01), logs errors to debug store (D-02).
 *
 * Must be rendered inside QueryClientProvider (called from AppLayout).
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { buildInfo } from '../lib/build-info';
import { updaterService } from '../services/updater';
import { useDebugLogStore } from '../stores/debug-log.store';
import { useSettingsStore } from '../stores/settings.store';
import { useUpdateStore } from '../stores/update.store';

/** D-03: Mid-range of 5-10s window to avoid competing with initial data fetches */
const LAUNCH_DELAY_MS = 7_000;

/** Dev builds (version contains "-dev") should never auto-check for updates. */
const IS_DEV_BUILD = buildInfo.version.includes('-dev');

export function useUpdatePolling() {
  const { setChecking, setAvailable, resetToIdle, setError } = useUpdateStore();
  const updateCheckInterval = useSettingsStore((s) => s.updateCheckInterval);
  const appendLog = useDebugLogStore((s) => s.append);
  const [ready, setReady] = useState(false);

  // D-03: Delay first check to avoid competing with Jira/GitLab fetches on launch
  useEffect(() => {
    if (IS_DEV_BUILD || updateCheckInterval === 'manual') return;
    const t = setTimeout(() => setReady(true), LAUNCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [updateCheckInterval]);

  const intervalMs =
    updateCheckInterval === 'manual' ? false : updateCheckInterval * 60 * 60 * 1000;

  useQuery({
    queryKey: ['update-check'],
    queryFn: async () => {
      setChecking();
      try {
        const info = await updaterService.check();
        if (info) {
          setAvailable(info.version, info.body, info.date);
          // Log success to dev tools
          appendLog({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source: 'jira', // reusing existing source type for dev tools display
            method: 'GET',
            url: 'tauri://updater/check',
            requestHeaders: {},
            status: 200,
            durationMs: 0,
            responseBody: `Update check: available — ${info.version}`,
          });
        } else {
          resetToIdle();
          appendLog({
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source: 'jira',
            method: 'GET',
            url: 'tauri://updater/check',
            requestHeaders: {},
            status: 200,
            durationMs: 0,
            responseBody: 'Update check: up to date',
          });
        }
        return info;
      } catch (err) {
        // D-02: Log to developer tools, do NOT surface to user
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        appendLog({
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source: 'jira',
          method: 'GET',
          url: 'tauri://updater/check',
          requestHeaders: {},
          status: null,
          durationMs: 0,
          responseBody: `Update check failed: ${msg}`,
          error: msg,
        });
        return null;
      }
    },
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false, // don't check while app is hidden
    staleTime: typeof intervalMs === 'number' ? intervalMs - 5_000 : Infinity,
    enabled: !IS_DEV_BUILD && ready && updateCheckInterval !== 'manual',
    retry: false, // don't retry on failure — next scheduled check will try
  });
}
