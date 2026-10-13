import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AioTestRun } from '@/services/aio';
import { fetchJiraIssueByKey } from '@/services/jira';
import type { JiraIssue } from '@/services/jira/types';

export interface ResolvedDefect {
  defectKey: string;
  triggeredByRuns: AioTestRun[];
  issue: JiraIssue | null;
  isLoading: boolean;
}

/**
 * Resolves all defects linked to a cycle's runs into Jira issues. Owned in one
 * place via useQueries so consumers can sort/filter on the full JiraIssue objects.
 */
export function useCycleDefects({
  runs,
  jiraBaseUrl,
  token,
  tokenLoading,
}: {
  runs: AioTestRun[] | undefined;
  jiraBaseUrl: string | null | undefined;
  token: string | null | undefined;
  tokenLoading: boolean;
}) {
  // defectId -> runs that triggered it (built once)
  const triggers = useMemo(() => {
    const map = new Map<string, AioTestRun[]>();
    for (const run of runs ?? []) {
      for (const id of (run.jiraDefectIDs ?? []).map(String)) {
        if (!id) continue;
        const list = map.get(id);
        if (list) list.push(run);
        else map.set(id, [run]);
      }
    }
    return map;
  }, [runs]);

  const defectKeys = useMemo(() => [...triggers.keys()], [triggers]);

  const issueQueries = useQueries({
    queries: defectKeys.map((defectKey) => ({
      queryKey: ['jira', jiraBaseUrl, 'issue-lightweight', defectKey],
      queryFn: () => fetchJiraIssueByKey(jiraBaseUrl ?? '', token ?? '', defectKey),
      enabled: !!jiraBaseUrl && !!token && !tokenLoading,
    })),
  });

  const defects: ResolvedDefect[] = defectKeys.map((defectKey, i) => ({
    defectKey,
    triggeredByRuns: triggers.get(defectKey) ?? [],
    issue: (issueQueries[i]?.data ?? null) as JiraIssue | null,
    isLoading: issueQueries[i]?.isLoading ?? false,
  }));

  const openCount = defects.filter(
    (d) => d.issue && d.issue.fields.status?.statusCategory?.key !== 'done',
  ).length;
  const isResolving = defects.some((d) => d.isLoading);

  return { defects, openCount, isResolving };
}
