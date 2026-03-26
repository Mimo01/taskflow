/**
 * useSavedFilterSync — fetches Jira favourite filters and syncs to saved filter store.
 *
 * Runs inside QueryClientProvider (called from AppLayout in main.tsx).
 * Separated from Sidebar so data remains available to all store consumers
 * (SavedFiltersWidget, CommandPalette, SprintBoardTab) even when the sidebar
 * section is removed.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchFavouriteFilters } from '@/services/jira/filters';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSavedFilterStore } from '@/stores/saved-filter.store';

export function useSavedFilterSync() {
  const { jiraBaseUrl } = useAuthStore();
  const { setSavedFilters } = useSavedFilterStore();

  const { data: favouriteFilters } = useQuery({
    queryKey: ['jira-favourite-filters', jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat');
      return fetchFavouriteFilters(jiraBaseUrl!, token);
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!jiraBaseUrl,
  });

  useEffect(() => {
    if (favouriteFilters) setSavedFilters(favouriteFilters);
  }, [favouriteFilters, setSavedFilters]);
}
