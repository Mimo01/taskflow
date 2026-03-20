/**
 * Shared Jira API client helpers -- fetch wrappers, pagination, error type guard.
 *
 * This module is imported by domain modules (issues, sprints, etc.) but is NOT
 * re-exported from the barrel index.ts. Its exports are internal to jira/.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import type { JiraIssue } from './types';

export const PAGE_SIZE = 200;
export const SUBTASK_CHUNK_SIZE = 50;

// ---- Error type guard (REFAC-05) ----

interface ResponseLikeError {
  status: number;
  text?: () => Promise<string>;
}

/**
 * Type guard to replace the 3 identical `as unknown as { status: number; text?: ... }`
 * double-casts throughout the Jira service. Duck-types for both real Response objects
 * and plain-object mocks used in tests.
 */
export function isResponseLikeError(err: unknown): err is ResponseLikeError {
  return (
    err !== null &&
    typeof err === 'object' &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

// ---- Paginated search helper ----

/**
 * Fetch all pages of a Jira /rest/api/2/search query.
 *
 * Jira paginates search results using startAt + maxResults + total fields.
 * This helper loops, incrementing startAt by PAGE_SIZE each iteration, until
 * startAt + PAGE_SIZE >= total (all items retrieved).
 *
 * The first page uses startAt=0 so the URL always contains `maxResults=200`,
 * preserving compatibility with any callers that inspect the URL.
 *
 * On first-page failure the raw Response object is thrown so the caller can
 * read its status and body for specific error messages (400, 401, etc.).
 * On subsequent-page failure, the already-fetched issues are returned as-is
 * (partial is better than nothing, and avoids surfacing transient errors).
 *
 * @param baseSearchUrl - Full search URL WITHOUT startAt or maxResults params.
 * @param headers       - Request headers (auth etc.)
 * @returns Flat array of all JiraIssue objects across all pages.
 */
export async function fetchAllSearchPages(
  baseSearchUrl: string,
  headers: Record<string, string>,
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${baseSearchUrl}&maxResults=${PAGE_SIZE}&startAt=${startAt}`;
    const response = await apiFetch('jira', url, { headers }, 'Search Issues');

    if (!response.ok) {
      if (startAt === 0) {
        // Throw ApiError for auth failures so downstream can detect them
        if (response.status === 401 || response.status === 403) {
          throw new ApiError(
            response.status === 401 ? 'Token expired' : 'Insufficient permissions',
            response.status,
            'jira',
          );
        }
        // Throw the raw Response so the caller can inspect status + body.
        throw response;
      }
      // Partial result -- stop paging but don't lose what we already have.
      break;
    }

    const data = await response.json();
    const issues: JiraIssue[] = data.issues ?? [];
    allIssues.push(...issues);

    const total: number = data.total ?? 0;
    startAt += PAGE_SIZE;
    if (startAt >= total || issues.length === 0) break;
  }

  return allIssues;
}

// ---- Paginated worklog helper ----

/**
 * Fetch all pages of a Jira /rest/api/2/issue/{key}/worklog endpoint.
 *
 * Jira worklog pagination uses the same startAt + maxResults + total pattern
 * as the search API. This helper loops until all worklogs are retrieved.
 *
 * On any failure, returns what has been collected so far (empty array on
 * first-page failure) -- callers treat worklogs as enrichment only.
 *
 * @param baseWorklogUrl - Full worklog URL WITHOUT startAt or maxResults params.
 * @param headers        - Request headers (auth etc.)
 * @returns Flat array of raw worklog objects across all pages.
 */
export async function fetchAllWorklogPages(
  baseWorklogUrl: string,
  headers: Record<string, string>,
): Promise<Array<{ author?: { displayName?: string } }>> {
  const allWorklogs: Array<{ author?: { displayName?: string } }> = [];
  let startAt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${baseWorklogUrl}?maxResults=${PAGE_SIZE}&startAt=${startAt}`;
    let response: Response;
    try {
      response = await apiFetch('jira', url, { headers }, 'Search Issues');
    } catch {
      break;
    }

    if (!response.ok) break;

    const data = await response.json();
    const worklogs: Array<{ author?: { displayName?: string } }> = data.worklogs ?? [];
    allWorklogs.push(...worklogs);

    const total: number = data.total ?? 0;
    startAt += PAGE_SIZE;
    if (startAt >= total || worklogs.length === 0) break;
  }

  return allWorklogs;
}
