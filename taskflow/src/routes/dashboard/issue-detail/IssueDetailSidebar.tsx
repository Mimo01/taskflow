import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { useBoardId } from '@/hooks/useBoardId';
import { apiFetch } from '@/lib/apiFetch';
import { statusPillClass } from '@/lib/statusStyles';
import { cn } from '@/lib/utils';
import type { JiraIssueDetail } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { FieldsSection } from './FieldsSection';
import { LinkedIssuesSection } from './LinkedIssuesSection';
import { MergeRequestsSection } from './MergeRequestsSection';
import { useFieldMutation } from './useFieldMutation';
import { useLinkedMRs } from './useLinkedMRs';

interface IssueDetailSidebarProps {
  issue: JiraIssueDetail;
  issueKey: string;
  jiraBaseUrl: string;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  sprintFieldKey: string;
  onOpenIssue?: (key: string) => void;
  /** When true, the Linked Issues section is omitted (single-column peek renders it at the bottom instead) */
  omitLinkedIssues?: boolean;
  /** When true, the Merge Requests section is omitted (single-column peek renders it at the bottom instead) */
  omitMergeRequests?: boolean;
}

export function IssueDetailSidebar({
  issue,
  issueKey,
  jiraBaseUrl,
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  sprintFieldKey,
  onOpenIssue,
  omitLinkedIssues,
  omitMergeRequests,
}: IssueDetailSidebarProps) {
  const f = issue.fields;
  const isEpic = f.issuetype.name === 'Epic';
  const isSubtask = f.issuetype.subtask;
  const isStory = !isEpic && !isSubtask;

  const { jiraBaseUrl: storeJiraBaseUrl, jiraConnected, activeJiraProject } = useAuthStore();
  const { epicColorFieldKey, flaggedFieldKey } = useSettingsStore();
  const effectiveJiraBaseUrl = jiraBaseUrl || storeJiraBaseUrl || '';

  const mr = useLinkedMRs(issueKey);

  const epicLink = isStory ? (f[epicLinkFieldKey] as string | null) : null;

  // Fetch epic name for stories -- lightweight single-issue fetch
  const { data: epicIssue } = useQuery({
    queryKey: ['jira-issue-name', epicLink, effectiveJiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token) return null;
      const url = `${effectiveJiraBaseUrl.replace(/\/$/, '')}/rest/api/2/issue/${epicLink}?fields=summary,${epicNameFieldKey},${epicColorFieldKey}`;
      const resp = await apiFetch(
        'jira',
        url,
        { headers: { Authorization: `Bearer ${token}` } },
        'Load Issue Detail',
      );
      if (!resp.ok) return null;
      return resp.json() as Promise<{ fields: { summary: string; [k: string]: unknown } }>;
    },
    enabled: isStory && !!epicLink && !!effectiveJiraBaseUrl && !!jiraConnected,
    staleTime: 60_000,
  });

  // WR-06: resolve the active project's boardId so the field-mutation hook
  // can scope its gh-backlog invalidation to one board rather than every
  // cached board. Same resolution pattern used by FieldsSection
  // (FieldsSection.tsx:149). `jiraTokenForBoard` only feeds the boardId
  // lookup query — the mutation itself reads the PAT inside its mutationFn.
  const { data: jiraTokenForBoard } = useQuery({
    queryKey: ['jira-pat'],
    queryFn: () => readSecret('jira-pat'),
    staleTime: Infinity,
  });
  const { boardId: sidebarBoardId } = useBoardId(
    effectiveJiraBaseUrl,
    jiraTokenForBoard ?? null,
    activeJiraProject,
  );
  const mutation = useFieldMutation(issueKey, effectiveJiraBaseUrl, sidebarBoardId);

  const parent = f.parent;

  return (
    <div className="space-y-4 text-sm">
      {/* Subtask parent link — leads the Fields block so the parent reads as a field */}
      {isSubtask && parent && (
        <button
          type="button"
          aria-label={`Open parent issue ${parent.key}`}
          className={cn(
            'flex w-full items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-left transition-colors',
            'cursor-pointer hover:bg-muted',
          )}
          onClick={() => onOpenIssue?.(parent.key)}
        >
          {parent.fields.issuetype?.name && (
            <IssueTypeIcon typeName={parent.fields.issuetype.name} />
          )}
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Parent
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{parent.key}</span>
          <span className="min-w-0 flex-1 truncate pr-0.5 text-sm font-medium text-foreground">
            {parent.fields.summary}
          </span>
          {parent.fields.status?.name && (
            <div className="flex shrink-0">
              <span className={statusPillClass(parent.fields.status?.statusCategory?.key)}>
                {parent.fields.status?.name}
              </span>
            </div>
          )}
          <ArrowUpRight className="size-4 text-muted-foreground shrink-0 ml-auto" />
        </button>
      )}

      <FieldsSection
        issue={issue}
        issueKey={issueKey}
        jiraBaseUrl={effectiveJiraBaseUrl}
        storyPointsFieldKey={storyPointsFieldKey}
        epicLinkFieldKey={epicLinkFieldKey}
        epicNameFieldKey={epicNameFieldKey}
        sprintFieldKey={sprintFieldKey}
        epicColorFieldKey={epicColorFieldKey}
        flaggedFieldKey={flaggedFieldKey}
        mutation={mutation}
        epicIssue={epicIssue}
        onOpenIssue={onOpenIssue}
      />

      {!omitLinkedIssues && (
        <LinkedIssuesSection issuelinks={f.issuelinks} onOpenIssue={onOpenIssue} />
      )}

      {!omitMergeRequests && (
        <MergeRequestsSection
          linkedMRs={mr.linkedMRs}
          mrsLoading={mr.mrsLoading}
          gitlabConnected={mr.gitlabConnected}
          gitlabBaseUrl={mr.gitlabBaseUrl}
        />
      )}
    </div>
  );
}
