import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  type CreatemetaField,
  fetchIssuePriorityOptions,
  fetchPriorities,
  fetchProjectPriorityOptions,
  type JiraPriority,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';

interface UsePriorityOptionsArgs {
  mode: 'create' | 'edit';
  open: boolean;
  jiraBaseUrl: string | null;
  projectKey: string;
  selectedIssueType: string;
  inheritFromKey?: string;
  issueKey?: string;
  creatmetaFields?: CreatemetaField[];
  creatmetaLoading: boolean;
  issueTypesLoading: boolean;
}

export function usePriorityOptions({
  mode,
  open,
  jiraBaseUrl,
  projectKey,
  selectedIssueType,
  inheritFromKey,
  issueKey,
  creatmetaFields,
  creatmetaLoading,
  issueTypesLoading,
}: UsePriorityOptionsArgs): JiraPriority[] {
  // Priorities must be scoped to the priority scheme that actually applies here, not
  // the instance-wide list (which has many priorities this project never uses). In
  // create mode the scoped set is the createmeta priority field's allowedValues; in
  // edit mode it's the issue's editmeta allowedValues. Both fall back to the global
  // list. Never hardcode standard-Jira names like "Highest" which may not exist.
  const createmetaPriorities = useMemo<JiraPriority[]>(() => {
    const field = creatmetaFields?.find((f) => f.fieldId === 'priority');
    return (field?.schema.allowedValues ?? []) as unknown as JiraPriority[];
  }, [creatmetaFields]);

  const prioritiesQuery = useQuery<JiraPriority[]>({
    // Create mode gets its own key: the edit key ['jira-priorities', issueKey, base] is
    // shared with the issue-detail picker and must not hold a project-wide set.
    queryKey:
      mode === 'edit'
        ? ['jira-priorities', issueKey, jiraBaseUrl]
        : ['jira-create-priorities', projectKey, selectedIssueType, inheritFromKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      if (mode === 'edit' && issueKey) {
        const scoped = await fetchIssuePriorityOptions(jiraBaseUrl, token, issueKey);
        if (scoped.length > 0) return scoped;
      } else if (mode === 'create' && projectKey) {
        // createmeta omits priority when it is not on the create screen; borrow the
        // scheme from a reference issue so only this project's priorities show.
        const scoped = await fetchProjectPriorityOptions(
          jiraBaseUrl,
          token,
          projectKey,
          selectedIssueType,
          inheritFromKey,
        );
        if (scoped.length > 0) return scoped;
      }
      return fetchPriorities(jiraBaseUrl, token);
    },
    // Skip the network query when createmeta already gives us the scoped create-mode set.
    // Create mode waits for createmeta, so the instance-wide list never flashes in first.
    enabled:
      open &&
      !!jiraBaseUrl &&
      (mode === 'edit' ||
        (!creatmetaLoading && !issueTypesLoading && createmetaPriorities.length === 0)),
    staleTime: 10 * 60 * 1000,
  });

  return mode === 'create' && createmetaPriorities.length > 0
    ? createmetaPriorities
    : mode === 'create' && (creatmetaLoading || issueTypesLoading)
      ? []
      : (prioritiesQuery.data ?? []);
}
