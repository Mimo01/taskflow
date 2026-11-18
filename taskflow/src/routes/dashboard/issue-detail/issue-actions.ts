import type { JiraIssueDetail, JiraIssueLink } from '@/services/jira';
import type { EditInitialValues } from '../CreateEditIssueModal';

/** Initial values for the Edit modal. Collects raw customfield_* values so required custom
 *  fields (e.g. Account) pre-fill from the current issue. */
export function buildEditInitialValues(
  issue: JiraIssueDetail,
  storyPointsFieldKey: string,
  epicLinkFieldKey: string,
): EditInitialValues {
  const customFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(issue.fields as Record<string, unknown>)) {
    if (k.startsWith('customfield_') && v != null) customFields[k] = v;
  }
  return {
    issueKey: issue.key,
    summary: issue.fields.summary,
    description: issue.fields.description ?? '',
    assigneeName: issue.fields.assignee?.name ?? null,
    assigneeDisplayName: issue.fields.assignee?.displayName ?? null,
    assigneeAvatarUrl: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
    priority: issue.fields.priority?.name ?? null,
    storyPoints: (issue.fields[storyPointsFieldKey] as number) ?? null,
    epicLinkKey: (issue.fields[epicLinkFieldKey] as string) ?? null,
    customFields,
    attachments: issue.fields.attachment ?? [],
    issueTypeName: issue.fields.issuetype?.name,
    labels: issue.fields.labels ?? [],
    fixVersions: (issue.fields.fixVersions ?? []).map((v) => ({ id: v.id, name: v.name })),
  };
}

/** Initial values for the Clone modal (empty issueKey = create mode, links copied). */
export function buildCloneInitialValues(
  issue: JiraIssueDetail,
  storyPointsFieldKey: string,
  epicLinkFieldKey: string,
): EditInitialValues {
  return {
    issueKey: '',
    summary: `Clone - ${issue.fields.summary}`,
    description: issue.fields.description ?? '',
    assigneeName: issue.fields.assignee?.name ?? null,
    assigneeDisplayName: issue.fields.assignee?.displayName ?? null,
    assigneeAvatarUrl: issue.fields.assignee?.avatarUrls?.['48x48'] ?? null,
    priority: issue.fields.priority?.name ?? null,
    storyPoints: (issue.fields[storyPointsFieldKey] as number) ?? null,
    epicLinkKey: (issue.fields[epicLinkFieldKey] as string) ?? null,
    // Clone copies labels; fix versions are release-specific, so a clone starts with none (Phase 101 decision)
    labels: issue.fields.labels ?? [],
    fixVersions: [],
    linkRows: (issue.fields.issuelinks ?? []).map((link: JiraIssueLink) => ({
      id: crypto.randomUUID(),
      linkTypeId: link.type.id,
      issueKey: link.outwardIssue?.key ?? link.inwardIssue?.key ?? '',
    })),
  };
}
