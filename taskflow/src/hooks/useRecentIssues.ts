/**
 * Recent Items enrichment: one batched Jira fetch for recent issue keys that the
 * global-search index does not cover (closed issues, other boards, cold cache), so
 * history rows always show status, assignee and type. Only runs while a recents
 * list is open; 5-minute staleTime like the search index (D-21).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { fetchIssuesByKeys, type JiraIssue } from '../services/jira';
import { readSecret } from '../services/stronghold';
import { useAuthStore } from '../stores/auth.store';

/** Same freshness as the search index (D-21). */
const RECENT_ISSUES_STALE_MS = 5 * 60_000;

export function useRecentIssues(open: boolean, keys: string[]): Map<string, JiraIssue> {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const [token, setToken] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: jiraBaseUrl is an intentional re-run trigger — re-read the secret on instance switch.
  useEffect(() => {
    let cancelled = false;
    readSecret('jira-pat')
      .then((t) => {
        if (!cancelled) setToken(t);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [jiraBaseUrl]);

  const sortedKeys = useMemo(() => [...new Set(keys)].sort(), [keys]);
  const query = useQuery({
    queryKey: ['recent-issues', jiraBaseUrl, sortedKeys],
    queryFn: () => fetchIssuesByKeys(jiraBaseUrl ?? '', token ?? '', sortedKeys),
    enabled: open && !!jiraBaseUrl && !!token && sortedKeys.length > 0,
    staleTime: RECENT_ISSUES_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return useMemo(() => {
    const map = new Map<string, JiraIssue>();
    for (const issue of query.data ?? []) map.set(issue.key, issue);
    return map;
  }, [query.data]);
}
