/**
 * useDetectedBrowsers — session-cached list of installed browsers for the
 * right-click LinkContextMenu (quick task 260827-f6e).
 *
 * `list_browsers` does filesystem existence checks on the Rust side (see
 * src-tauri/src/lib.rs), and LinkContextMenu mounts on dozens of rows in list
 * views (wiki prose, discussion threads, notification rows). Without this
 * shared cache each mounted menu would re-invoke the command. staleTime/gcTime
 * Infinity + a fixed queryKey means the command fires at most once per app
 * session — this is load-bearing, not an optimisation.
 */
import { useQuery } from '@tanstack/react-query';
import type { BrowserInfo } from '@/lib/openExternal';
import { tauriService } from '@/services/tauri';

export function useDetectedBrowsers(): BrowserInfo[] {
  const { data } = useQuery({
    queryKey: ['detected-browsers'],
    queryFn: () => tauriService.invoke<BrowserInfo[]>('list_browsers'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return data ?? [];
}
