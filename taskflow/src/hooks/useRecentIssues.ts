/**
 * Recent Items enrichment: one batched Jira fetch for recent issue keys that the
 * global-search index does not cover (closed issues, other boards, cold cache), so
 * history rows always show status, assignee, type and epic. Epics referenced by the
 * fetched issues are fetched in the same queryFn (name = epic summary). Only runs while
 * a recents list is open; 5-minute staleTime like the search index (D-21).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { fetchIssuesByKeys, type JiraIssue } from '../services/jira';
import { readSecret } from '../services/stronghold';
import { useAuthStore } from '../stores/auth.store';
import { useSettingsStore } from '../stores/settings.store';

/** Same freshness as the search index (D-21). */
const RECENT_ISSUES_STALE_MS = 5 * 60_000;

export interface RecentIssuesData {
  issues: Map<string, JiraIssue>;
  /** Epic key -> summary for epics referenced by the fetched issues. */
  epicNames: Map<string, string>;
  epicLinkFieldKey: string;
}

export function useRecentIssues(open: boolean, keys: string[]): RecentIssuesData {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const epicLinkFieldKey = useSettingsStore((s) => s.epicLinkFieldKey);
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
    queryKey: ['recent-issues', jiraBaseUrl, epicLinkFieldKey, sortedKeys],
    queryFn: async () => {
      const base = jiraBaseUrl ?? '';
      const tok = token ?? '';
      const issues = await fetchIssuesByKeys(base, tok, sortedKeys, [epicLinkFieldKey]);
      const epicKeys = [
        ...new Set(
          issues
            .map((i) => (i.fields as unknown as Record<string, unknown>)[epicLinkFieldKey])
            .filter((v): v is string => typeof v === 'string'),
        ),
      ];
      const epics = epicKeys.length > 0 ? await fetchIssuesByKeys(base, tok, epicKeys) : [];
      return { issues, epics };
    },
    enabled: open && !!jiraBaseUrl && !!token && sortedKeys.length > 0,
    staleTime: RECENT_ISSUES_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return useMemo(() => {
    const issues = new Map<string, JiraIssue>();
    for (const issue of query.data?.issues ?? []) issues.set(issue.key, issue);
    const epicNames = new Map<string, string>();
    for (const e of query.data?.epics ?? []) epicNames.set(e.key, e.fields?.summary ?? e.key);
    return { issues, epicNames, epicLinkFieldKey };
  }, [query.data, epicLinkFieldKey]);
}
