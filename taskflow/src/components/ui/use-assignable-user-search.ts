import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { JiraAssignableUser } from '@/services/jira/types';
import { fetchAssignableUsers } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';

interface Args {
  jiraBaseUrl: string;
  projectKey?: string;
  issueKey?: string;
  query: string;
  enabled: boolean;
}

/**
 * Server-side assignable-user search. The typed term (debounced 200ms) is sent to Jira via
 * `username=` so users beyond the first capped page are findable — never filter a capped
 * page client-side. The PAT is read inside the queryFn and is never part of the query key.
 */
export function useAssignableUserSearch({
  jiraBaseUrl,
  projectKey,
  issueKey,
  query,
  enabled,
}: Args): { users: JiraAssignableUser[]; isLoading: boolean; debouncedQuery: string } {
  const trimmed = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(trimmed);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 200);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const result = useQuery({
    queryKey: ['jira-assignable-users', issueKey ?? projectKey ?? '', jiraBaseUrl, debouncedQuery],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return [];
      return fetchAssignableUsers(jiraBaseUrl, token, projectKey ?? '', debouncedQuery, {
        issueKey,
      });
    },
    enabled: enabled && !!jiraBaseUrl && !!(issueKey || projectKey),
    staleTime: 60_000,
  });

  return { users: result.data ?? [], isLoading: result.isLoading, debouncedQuery };
}
