/**
 * Parent-story completion check (quick 261014-m6e).
 *
 * When the user moves a subtask to a done-category status, decide whether it was
 * the LAST open subtask of its parent, i.e. whether to offer moving the parent
 * story to done too. Reads the parent + siblings FRESH from the server (never the
 * React Query cache). Kept in its own module (not transitions.ts) so suites that
 * fully mock transitions.ts are unaffected.
 */

import type { QueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/apiFetch';
import { invalidateGhAllData } from './greenhopper/useGhAllData';
import { invalidateGhBacklogData } from './greenhopper/useGhBacklogData';

export type ParentCompletionResult =
  | { shouldPrompt: false }
  | {
      shouldPrompt: true;
      parentKey: string;
      parentSummary: string;
      parentStatusId: string;
      parentStatusName: string;
      parentStatusCategory: string;
      parentIssueType: string;
      parentPriority: string;
      parentAssignee: string;
      subtaskCount: number;
    };

interface ParentResponse {
  fields?: {
    summary?: string;
    issuetype?: { name?: string };
    priority?: { name?: string };
    assignee?: { displayName?: string } | null;
    status?: { id?: string; name?: string; statusCategory?: { key?: string } };
    subtasks?: Array<{
      key: string;
      fields?: { status?: { statusCategory?: { key?: string } } };
    }>;
  };
}

const NO_PROMPT: ParentCompletionResult = { shouldPrompt: false };

export async function checkParentCompletion(
  baseUrl: string,
  token: string,
  subtaskKey: string,
  parentKey: string,
): Promise<ParentCompletionResult> {
  try {
    const base = baseUrl.replace(/\/$/, '');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const response = await apiFetch(
      'jira',
      `${base}/rest/api/2/issue/${parentKey}?fields=status,summary,subtasks,issuetype,priority,assignee`,
      { headers },
      'Check Parent Completion',
    );
    if (!response.ok) return NO_PROMPT;
    const data = (await response.json()) as ParentResponse;
    const fields = data.fields;
    if (!fields?.status) return NO_PROMPT;
    if (fields.status.statusCategory?.key === 'done') return NO_PROMPT;

    // The transitioned subtask's own echoed status is ignored (may still be stale).
    const others = (fields.subtasks ?? []).filter((s) => s.key !== subtaskKey);
    const categories = new Map<string, string | undefined>();
    for (const s of others) categories.set(s.key, s.fields?.status?.statusCategory?.key);

    const missing = others.filter((s) => !categories.get(s.key)).map((s) => s.key);
    if (missing.length > 0) {
      const jql = encodeURIComponent(`key in (${missing.join(',')})`);
      const res = await apiFetch(
        'jira',
        `${base}/rest/api/2/search?jql=${jql}&fields=status&maxResults=${missing.length}`,
        { headers },
        'Check Parent Completion Siblings',
      );
      if (!res.ok) return NO_PROMPT;
      const search = (await res.json()) as {
        issues?: Array<{
          key: string;
          fields?: { status?: { statusCategory?: { key?: string } } };
        }>;
      };
      for (const i of search.issues ?? []) {
        categories.set(i.key, i.fields?.status?.statusCategory?.key);
      }
    }

    for (const s of others) {
      if (categories.get(s.key) !== 'done') return NO_PROMPT;
    }

    return {
      shouldPrompt: true,
      parentKey,
      parentSummary: fields.summary ?? '',
      parentStatusId: fields.status.id ?? '',
      parentStatusName: fields.status.name ?? '',
      parentStatusCategory: fields.status.statusCategory?.key ?? '',
      parentIssueType: fields.issuetype?.name ?? '',
      parentPriority: fields.priority?.name ?? '',
      parentAssignee: fields.assignee?.displayName ?? '',
      subtaskCount: (fields.subtasks ?? []).length,
    };
  } catch {
    return NO_PROMPT;
  }
}

/** Refresh every cache surface that shows an issue's status after a transition. */
export function invalidateAfterTransition(
  qc: QueryClient,
  issueKey: string,
  baseUrl: string,
  boardId?: number | null,
): void {
  qc.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, baseUrl] });
  qc.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, baseUrl] });
  qc.invalidateQueries({ queryKey: ['jira-issue-transitions-fields', issueKey] });
  qc.invalidateQueries({ queryKey: ['jira-parent-detail', issueKey] });
  qc.invalidateQueries({ queryKey: ['jira-subtask-enrichment'] });
  qc.invalidateQueries({ queryKey: ['jira-epic-stories'] });
  if (boardId) invalidateGhAllData(qc, boardId);
  else invalidateGhAllData(qc);
  if (boardId) invalidateGhBacklogData(qc, boardId);
  else invalidateGhBacklogData(qc);
  qc.invalidateQueries({ queryKey: ['jira-epics-basic'] });
  qc.invalidateQueries({ queryKey: ['jira-fixversion-issues'] });
  qc.invalidateQueries({ queryKey: ['jira-version-counts'] });
  qc.invalidateQueries({ queryKey: ['jira-issues'] });
}
