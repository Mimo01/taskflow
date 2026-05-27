import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { JiraIssueDetail } from '@/services/jira';
import { updateIssueField } from '@/services/jira';
import { readSecret } from '@/services/stronghold';

/**
 * Shared mutation hook implementing Pattern 4 from RESEARCH.md.
 * Handles optimistic updates and rollback for field mutations.
 */
export function useFieldMutation(issueKey: string, jiraBaseUrl: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldName, value }: { fieldName: string; value: unknown }) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) throw new Error('No token');
      return updateIssueField(jiraBaseUrl, token, issueKey, fieldName, value);
    },
    onMutate: async ({ fieldName, value }) => {
      await queryClient.cancelQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      const previous = queryClient.getQueryData<JiraIssueDetail>([
        'jira-issue-detail',
        issueKey,
        jiraBaseUrl,
      ]);
      queryClient.setQueryData<JiraIssueDetail>(
        ['jira-issue-detail', issueKey, jiraBaseUrl],
        (old) => {
          if (!old) return old;
          return { ...old, fields: { ...old.fields, [fieldName]: value } };
        },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['jira-issue-detail', issueKey, jiraBaseUrl], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
      queryClient.invalidateQueries({ queryKey: ['jira-epics-basic'] });
      queryClient.invalidateQueries({ queryKey: ['jira-fixversion-issues'] });
      queryClient.invalidateQueries({ queryKey: ['jira-version-counts'] });
    },
  });
}

/** Debounce hook for text field updates. */
export function useDebounce<T extends unknown[]>(fn: (...args: T) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const delayRef = useRef(delay);
  delayRef.current = delay;
  const stableRef = useRef<(...args: T) => void>(null!);
  if (!stableRef.current) {
    stableRef.current = (...args: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delayRef.current);
    };
  }
  return stableRef.current;
}
