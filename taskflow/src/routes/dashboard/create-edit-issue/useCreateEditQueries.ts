import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import {
  type CreatemetaField,
  fetchCreatemeta,
  fetchIssueLinkTypes,
  type IssueLinkType,
  type JiraIssue,
  type JiraUser,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import type { IssueType } from './useCreateEditForm';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreatemtaIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

interface UseCreateEditQueriesOptions {
  open: boolean;
  projectKey: string;
  jiraBaseUrl: string | null;
  selectedIssueType: IssueType;
  epicLinkFieldKey: string | null;
  storyPointsFieldKey: string | null;
}

// Core field IDs to exclude from custom field rendering
const CORE_FIELD_IDS = new Set([
  'summary', 'description', 'assignee', 'priority', 'issuetype', 'project', 'reporter',
]);

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCreateEditQueries({
  open, projectKey, jiraBaseUrl, selectedIssueType, epicLinkFieldKey, storyPointsFieldKey,
}: UseCreateEditQueriesOptions) {
  const staleTime = 5 * 60 * 1000;

  const { data: issueTypes } = useQuery<CreatemtaIssueType[]>({
    queryKey: ['createmeta-issuetypes', projectKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      const base = jiraBaseUrl.replace(/\/$/, '');
      const resp = await apiFetch('jira', `${base}/rest/api/2/issue/createmeta/${projectKey}/issuetypes`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.values ?? []) as CreatemtaIssueType[];
    },
    enabled: open && !!projectKey && !!jiraBaseUrl,
    staleTime,
  });

  const selectedIssueTypeId = issueTypes?.find((t) => t.name === selectedIssueType)?.id ?? '';

  const { data: creatmetaFields, isLoading: creatmetaLoading } = useQuery<CreatemetaField[]>({
    queryKey: ['createmeta', projectKey, selectedIssueTypeId, selectedIssueType],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      return fetchCreatemeta(jiraBaseUrl, token, projectKey, selectedIssueTypeId, selectedIssueType);
    },
    enabled: open && !!projectKey && !!jiraBaseUrl && !!selectedIssueTypeId,
    staleTime,
  });

  const customRequiredFields = (creatmetaFields ?? []).filter((f) => {
    if (!f.required) return false;
    if (CORE_FIELD_IDS.has(f.fieldId)) return false;
    if (epicLinkFieldKey && f.fieldId === epicLinkFieldKey) return false;
    if (storyPointsFieldKey && f.fieldId === storyPointsFieldKey) return false;
    return true;
  });

  const { data: epics } = useQuery<JiraIssue[]>({
    queryKey: ['epics', projectKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      const base = jiraBaseUrl.replace(/\/$/, '');
      const jql = `project = ${projectKey} AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`;
      const resp = await apiFetch('jira', `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status&maxResults=50`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.issues ?? []) as JiraIssue[];
    },
    enabled: open && !!projectKey && !!jiraBaseUrl && selectedIssueType !== 'Subtask',
    staleTime,
  });

  const { data: linkTypes = [], isLoading: linkTypesLoading } = useQuery<IssueLinkType[]>({
    queryKey: ['jira-link-types', jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      return fetchIssueLinkTypes(jiraBaseUrl, token);
    },
    enabled: open && !!jiraBaseUrl,
    staleTime,
  });

  const { data: allAssignees = [], isLoading: assigneeLoading } = useQuery<JiraUser[]>({
    queryKey: ['assignable-users', projectKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      const base = jiraBaseUrl.replace(/\/$/, '');
      const resp = await apiFetch('jira', `${base}/rest/api/2/user/assignable/search?project=${projectKey}&maxResults=200`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) return [];
      return (await resp.json()) as JiraUser[];
    },
    enabled: open && !!projectKey && !!jiraBaseUrl,
    staleTime,
  });

  return {
    creatmetaFields,
    creatmetaLoading,
    customRequiredFields,
    epics,
    linkTypes,
    linkTypesLoading,
    allAssignees,
    assigneeLoading,
  };
}
