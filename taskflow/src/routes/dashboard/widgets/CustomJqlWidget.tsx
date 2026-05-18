/**
 * CustomJqlWidget -- executes a user-defined JQL query and displays results.
 *
 * The JQL query is persisted in the widget's config.jql field via the
 * updateWidgetConfig store action. Uses Jira search API directly.
 */

import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { JiraIssue } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

async function searchByJql(baseUrl: string, token: string, jql: string): Promise<JiraIssue[]> {
  const { apiFetch } = await import('@/lib/apiFetch');
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee&maxResults=20`;
  const response = await apiFetch('jira', url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }, 'Search Issues');
  if (!response.ok) {
    throw new Error(`JQL query failed (${response.status})`);
  }
  const data = await response.json();
  return (data.issues ?? []) as JiraIssue[];
}

export default function CustomJqlWidget({ widgetId }: { widgetId: string }) {
  const { jiraBaseUrl } = useAuthStore();
  const layoutItem = useSettingsStore((s) => s.dashboardLayout.find((w) => w.i === widgetId));
  const updateWidgetConfig = useSettingsStore((s) => s.updateWidgetConfig);
  const jql = (layoutItem?.config?.jql as string) ?? '';
  const [draft, setDraft] = useState(jql);
  const [jiraToken, setJiraToken] = useState<string | null>(null);

  // Sync draft when external config changes (e.g. preset load)
  useEffect(() => {
    setDraft(jql);
  }, [jql]);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then(setJiraToken)
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const saveJql = () => {
    const trimmed = draft.trim();
    if (trimmed !== jql) {
      updateWidgetConfig(widgetId, { jql: trimmed });
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['custom-jql', widgetId, jql],
    queryFn: () => searchByJql(jiraBaseUrl!, jiraToken!, jql),
    enabled: !!jiraBaseUrl && !!jiraToken && jql.length > 0,
    staleTime: 30_000,
    retry: false,
  });

  return (
    <div className="flex flex-col gap-2 p-2 overflow-auto h-full">
      {/* JQL input */}
      <Input
        placeholder="Enter JQL query..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={saveJql}
        onKeyDown={(e) => {
          if (e.key === 'Enter') saveJql();
        }}
        className="text-xs"
      />

      {/* Empty query state */}
      {!jql && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Search className="size-5" />
            <span className="text-sm text-center">
              Enter a JQL query above to see matching issues.
            </span>
          </div>
        </div>
      )}

      {/* Loading */}
      {jql && isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {/* Error */}
      {jql && isError && (
        <div className="flex flex-1 items-center justify-center p-2">
          <span className="text-sm text-destructive text-center">
            Invalid JQL query. Check syntax and try again.
          </span>
        </div>
      )}

      {/* Results */}
      {jql && !isLoading && !isError && data && (
        <div className="flex flex-col gap-0.5">
          {data.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-4">
              <span className="text-sm text-muted-foreground">No matching issues</span>
            </div>
          ) : (
            data.map((issue) => (
              <div
                key={issue.key}
                className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-muted/50 text-sm"
              >
                <span className="shrink-0 font-mono text-xs text-primary">{issue.key}</span>
                <span className="flex-1 truncate">{issue.fields.summary}</span>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {issue.fields.status.name}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
