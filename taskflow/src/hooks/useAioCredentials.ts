import { useEffect, useState } from 'react';
import { readSecret } from '@/services/stronghold';

/**
 * Reads the AIO/Jira PAT from Stronghold and returns `{ token, isLoading }`.
 *
 * Consumers: AioProjectOverviewPage, AioCycleDetailPage, AioTestRunDetailPage.
 *
 * Why `isLoading` exists (Pitfall 1 — flash-fire-with-null-token):
 * Stronghold resolution is asynchronous. Without a loading flag, the initial
 * render where `token === null` but Stronghold has not yet responded would
 * cause `useQuery.enabled` (which gates on `!!token`) to evaluate false only
 * transiently — but NOT fire the query. Adding `!isLoading` to the enabled
 * guard prevents any query from firing until the credential state is stable,
 * eliminating the race where a query starts with a null token.
 *
 * `isLoading` starts as `true` (not `false`) so the guard is closed by
 * default and opens only after `readSecret` resolves or rejects.
 */
export function useAioCredentials(): { token: string | null; isLoading: boolean } {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    readSecret('jira-pat')
      .then(setToken)
      .catch(() => setToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  return { token, isLoading };
}
