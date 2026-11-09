import { ApiError } from '@/lib/api-error';

export interface IssueUnavailableInfo {
  kind: 'unavailable' | 'error';
  status: number | null;
  jiraMessages: string[];
}

/**
 * Classify an issue-detail load failure. Jira answers 401/403/404 when an issue
 * is not visible to the user (404 is also used for non-existent keys), so those
 * map to 'unavailable'; everything else is a transient 'error'.
 */
export function getIssueUnavailableInfo(error: unknown): IssueUnavailableInfo {
  let status: number | null = null;
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status: unknown }).status;
    if (typeof s === 'number') status = s;
  }
  const jiraMessages = error instanceof ApiError ? error.jiraMessages : [];
  const kind = status === 401 || status === 403 || status === 404 ? 'unavailable' : 'error';
  return { kind, status, jiraMessages };
}
