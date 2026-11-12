import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { type EpicOption, searchOpenEpics } from '@/services/jira/epics';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

interface Args {
  projectKey?: string;
  query: string;
  open: boolean;
}

/**
 * Server-side open-epic search. The typed term (debounced 200ms) goes to Jira as JQL, so epics
 * beyond a capped page are findable. The PAT is read inside the queryFn, never in the key.
 */
export function useEpicSearch({ projectKey, query, open }: Args): {
  epics: EpicOption[];
  isLoading: boolean;
} {
  const base = useAuthStore((s) => s.jiraBaseUrl) ?? '';
  const epicNameFieldKey = useSettingsStore((s) => s.epicNameFieldKey);
  const epicColorFieldKey = useSettingsStore((s) => s.epicColorFieldKey);
  const trimmed = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(trimmed);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 200);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const result = useQuery({
    queryKey: ['jira-epic-search', projectKey ?? '', base, debouncedQuery],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return [];
      return searchOpenEpics(base, token, projectKey ?? '', debouncedQuery, {
        epicNameFieldKey,
        epicColorFieldKey,
      });
    },
    enabled: open && !!projectKey && !!base,
    staleTime: 60_000,
  });

  return { epics: result.data ?? EMPTY, isLoading: result.isLoading };
}

// Stable reference so consumers can safely use `epics` in effect deps.
const EMPTY: EpicOption[] = [];
