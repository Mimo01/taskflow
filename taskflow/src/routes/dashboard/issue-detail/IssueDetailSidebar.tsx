import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssueDetail } from '@/services/jira';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { FieldsSection } from './FieldsSection';
import { LinkedIssuesSection } from './LinkedIssuesSection';
import { MergeRequestsSection } from './MergeRequestsSection';
import { useFieldMutation } from './useFieldMutation';

interface IssueDetailSidebarProps {
  issue: JiraIssueDetail;
  issueKey: string;
  jiraBaseUrl: string;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  sprintFieldKey: string;
  onOpenIssue?: (key: string) => void;
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
}: IssueDetailSidebarProps) {
  const f = issue.fields;
  const isEpic = f.issuetype.name === 'Epic';
  const isSubtask = f.issuetype.subtask;
  const isStory = !isEpic && !isSubtask;

  const {
    jiraBaseUrl: storeJiraBaseUrl,
    jiraConnected,
    gitlabBaseUrl,
    gitlabConnected,
    activeGitlabProject,
  } = useAuthStore();
  const { epicColorFieldKey } = useSettingsStore();
  const effectiveJiraBaseUrl = jiraBaseUrl || storeJiraBaseUrl || '';

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

  // Fetch GitLab MRs for the active project (all states, recent 20)
  const { data: projectMRs, isLoading: mrsLoading } = useQuery({
    queryKey: ['gitlab-project-mrs', gitlabBaseUrl, activeGitlabProject],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token || !gitlabBaseUrl || !activeGitlabProject) return [] as GitLabMR[];
      const base = gitlabBaseUrl.replace(/\/$/, '');
      const url = `${base}/api/v4/projects/${activeGitlabProject}/merge_requests?per_page=20&order_by=updated_at&sort=desc`;
      try {
        const resp = await apiFetch(
          'gitlab',
          url,
          {
            headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
          },
          'Load Issue Detail',
        );
        if (!resp.ok) return [] as GitLabMR[];
        return (await resp.json()) as GitLabMR[];
      } catch {
        return [] as GitLabMR[];
      }
    },
    staleTime: 60_000,
    enabled: !!gitlabBaseUrl && !!gitlabConnected && !!activeGitlabProject,
  });

  // Filter MRs linked to the current issue key
  const linkedMRs = useMemo(() => {
    if (!projectMRs) return [];
    return projectMRs.filter((mr) => {
      const titleKeys = extractTicketKeys(mr.title);
      const branchKeys = extractTicketKeys(mr.source_branch);
      return titleKeys.includes(issueKey) || branchKeys.includes(issueKey);
    });
  }, [projectMRs, issueKey]);

  const mutation = useFieldMutation(issueKey, effectiveJiraBaseUrl);

  return (
    <div className="space-y-4 text-sm">
      <FieldsSection
        issue={issue}
        issueKey={issueKey}
        jiraBaseUrl={effectiveJiraBaseUrl}
        storyPointsFieldKey={storyPointsFieldKey}
        epicLinkFieldKey={epicLinkFieldKey}
        epicNameFieldKey={epicNameFieldKey}
        sprintFieldKey={sprintFieldKey}
        epicColorFieldKey={epicColorFieldKey}
        mutation={mutation}
        epicIssue={epicIssue}
        onOpenIssue={onOpenIssue}
      />

      <LinkedIssuesSection issuelinks={f.issuelinks} onOpenIssue={onOpenIssue} />

      <MergeRequestsSection
        linkedMRs={linkedMRs}
        mrsLoading={mrsLoading}
        gitlabConnected={!!gitlabConnected}
        gitlabBaseUrl={gitlabBaseUrl || ''}
      />
    </div>
  );
}
