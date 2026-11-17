import type { Editor } from '@tiptap/core';
import type { JiraAssignableUser } from '@/services/jira/types';
import { fetchAssignableUsers } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { getHost } from '../host';

/** Mirrors the useAssignableUserSearch key so both share the same cache entries. */
export function peopleQueryKey(
  ctx: { issueKey?: string | null; projectKey?: string | null },
  baseUrl: string,
  query: string,
): readonly [string, string, string, string] {
  return ['jira-assignable-users', ctx.issueKey ?? ctx.projectKey ?? '', baseUrl, query];
}

/**
 * Server-side assignable-user search, one request per distinct query (never a client-side
 * filter of a capped page). The fetcher swallows errors and yields [] (callers show the
 * empty state only).
 */
export async function searchPeople(
  editor: Editor,
  query: string,
  signal?: AbortSignal,
): Promise<JiraAssignableUser[]> {
  const host = getHost(editor);
  const baseUrl = useAuthStore.getState().jiraBaseUrl ?? '';
  const { queryClient, projectKey, issueKey } = host;
  if (!queryClient || !baseUrl) return [];
  const users = await queryClient.fetchQuery({
    queryKey: peopleQueryKey({ issueKey, projectKey }, baseUrl, query),
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return [] as JiraAssignableUser[];
      return fetchAssignableUsers(baseUrl, token, projectKey ?? '', query, {
        issueKey: issueKey ?? undefined,
      });
    },
    staleTime: 60_000,
  });
  if (signal?.aborted) return [];
  return users;
}
