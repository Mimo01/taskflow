/**
 * Jira REST API service — PAT validation and project listing.
 *
 * AUTH HEADER NOTE:
 * This implementation uses Bearer token authentication (Authorization: Bearer <token>).
 * Jira Server 8.14+ and Jira Cloud both support Bearer PAT auth natively.
 * Older Jira Server instances (pre-8.14) require Basic auth with base64(:token)
 * (i.e., an empty username prefix). We do NOT implement the Basic fallback here —
 * that is a Phase 2 concern once we have a real on-premise instance to validate against.
 * The function signatures are designed to allow adding an `authStrategy` parameter later
 * without changing callers (open/closed principle).
 *
 * All HTTP calls use `fetch` from `@tauri-apps/plugin-http` to bypass CORS
 * in the Tauri 2 webview (plain fetch triggers preflight failures on Jira Server).
 *
 * IMPORTANT: This module does NOT store secrets. Callers are responsible for
 * calling storeSecret('jira-pat', token) after successful validation.
 */

import { ApiError } from '../lib/api-error';
import { apiFetch } from '../lib/apiFetch';
import { getJiraLimit } from '../lib/concurrency';
import {
  fetchAllSearchPages as fetchAllSearchPagesClient,
  isResponseLikeError,
} from './jira/client';
import { fetchAllJiraStatuses } from './jira/statuses';
import type { JiraComment } from './jira/types';

export { rankIssueApi } from './jira/rank-api';
export { addIssuesToSprint } from './jira/sprints';
// Re-export changelog and watcher modules for barrel access via '@/services/jira'
export * from './jira-changelog';
export * from './jira-watchers';

import type { ChangelogHistory } from './jira-changelog';

export interface JiraUser {
  displayName: string;
  emailAddress: string;
  name: string;
  key?: string;
  /** Jira avatar image URLs from GET /rest/api/2/myself. */
  avatarUrls?: { '48x48'?: string };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

/**
 * Validate a Jira PAT by calling GET /rest/api/2/myself.
 *
 * @param baseUrl - Jira base URL (e.g. "https://jira.example.com")
 * @param token   - Personal Access Token
 * @returns Resolved user info on success
 * @throws Exact error strings per locked UX decisions in CONTEXT.md
 */
export async function validateJira(baseUrl: string, token: string): Promise<JiraUser> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/myself`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      'Validate Connection',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return {
      displayName: data.displayName,
      emailAddress: data.emailAddress,
      name: data.name ?? data.emailAddress,
      key: data.key,
      avatarUrls: data.avatarUrls,
    };
  }

  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }

  if (response.status === 403) {
    throw new ApiError('Token valid but lacks required permissions', 403, 'jira');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

/**
 * List all Jira projects visible to the authenticated user.
 *
 * @param baseUrl - Jira base URL
 * @param token   - Personal Access Token (already validated)
 * @returns Array of projects with id, key, and name
 */
export async function listJiraProjects(baseUrl: string, token: string): Promise<JiraProject[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/project`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      'Load Projects',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return data as JiraProject[];
  }

  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'jira');
  }

  if (response.status === 403) {
    throw new ApiError('Token valid but lacks required permissions', 403, 'jira');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

// ─── Phase 2: Developer Dashboard ────────────────────────────────────────────

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      id: string;
      name: string;
      statusCategory?: { key: 'new' | 'indeterminate' | 'done' };
    };
    assignee: { displayName: string; avatarUrls: { '48x48': string } } | null;
    customfield_10016: number | null; // story points (most common field key)
    issuetype: {
      /** Numeric id (Phase 72: needed for GH transitions cache lookup; optional
       *  in the type so legacy test fixtures keep compiling — runtime always
       *  returns it when `issuetype` is in the fields= list). */
      id?: string;
      name: string;
      subtask: boolean; // Use this — NOT name comparison. Admins can rename issue types.
    };
    /**
     * Project context — Phase 72: required for GH transitions cache lookup.
     * Optional in the type because legacy callers may not request the `project`
     * field; sprint board / transitions consumers MUST include it in fields=.
     */
    project?: { id: string; key: string };
    description?: string | null;
    // v1.1 additions (all optional — non-breaking for all four existing callers):
    parent?: { id: string; key: string; fields: { summary: string } };
    subtasks?: Array<{
      id: string;
      key: string;
      fields: { summary: string; status: { name: string; statusCategory?: { key: string } } };
    }>;
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    [key: string]: unknown; // Enables issue.fields[storyPointsFieldKey] without casting
  };
}

export interface JiraFixVersion {
  id: string;
  name: string;
  releaseDate?: string; // "YYYY-MM-DD" — absent when not set, never null in API response
  released: boolean;
  description?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
    statusCategory?: { id: number; key: string; name: string };
  };
  /**
   * Source status id this transition applies from. Undefined means the
   * transition is global (applies from any status). Use
   * `filterTransitionsForStatus` to narrow a workflow's full transition list
   * to those available from a specific issue's current status.
   */
  fromStatusId?: string;
  /**
   * Phase 79 (D-08): propagated from GhTransition. When true, the transition
   * requires a screen (form) that drag-to-transition cannot satisfy — filter
   * out of drop targets (D-07). Keep in sync with the mirror at
   * `services/jira.ts:195-210`.
   */
  hasScreen?: boolean;
  /**
   * Phase 79 (D-08): propagated from GhTransition. When true, the transition
   * has post-function validators — also filtered from drop targets (D-07).
   */
  hasValidators?: boolean;
}

/**
 * Returns true when a Jira issue is flagged (has a non-empty Flagged customfield array).
 *
 * Jira represents the Flagged field as an array of { value: string } objects.
 * An issue is flagged iff the array is non-empty. An unflagged issue has null or [].
 */
export function isIssueFlagged(issue: JiraIssue, fieldKey: string): boolean {
  const val = issue.fields[fieldKey];
  return Array.isArray(val) && val.length > 0;
}

/**
 * Toggle the Flagged state of a Jira issue.
 *
 * FLAG:   PUT /rest/api/2/issue/{key} with fields: { [fieldKey]: [{ value: "Impediment" }] }
 * UNFLAG: PUT /rest/api/2/issue/{key} with fields: { [fieldKey]: null }
 */
export async function setIssueFlagged(
  baseUrl: string,
  token: string,
  issueKey: string,
  flagged: boolean,
  fieldKey = 'customfield_10021',
): Promise<void> {
  return updateIssueField(
    baseUrl,
    token,
    issueKey,
    fieldKey,
    flagged ? [{ value: 'Impediment' }] : null,
  );
}

const SUBTASK_CHUNK_SIZE = 50;
const PAGE_SIZE = 200;

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
async function fetchAllSearchPages(
  baseSearchUrl: string,
  headers: Record<string, string>,
): Promise<JiraIssue[]> {
  const allIssues: JiraIssue[] = [];
  let startAt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${baseSearchUrl}&maxResults=${PAGE_SIZE}&startAt=${startAt}`;
    const response = await apiFetch('jira', url, { headers }, 'Load Issue Detail');

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
      // Partial result — stop paging but don't lose what we already have.
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

/**
 * Fetch all pages of a Jira /rest/api/2/issue/{key}/worklog endpoint.
 *
 * Jira worklog pagination uses the same startAt + maxResults + total pattern
 * as the search API. This helper loops until all worklogs are retrieved.
 *
 * On any failure, returns what has been collected so far (empty array on
 * first-page failure) — callers treat worklogs as enrichment only.
 *
 * @param baseWorklogUrl - Full worklog URL WITHOUT startAt or maxResults params.
 * @param headers        - Request headers (auth etc.)
 * @returns Flat array of raw worklog objects across all pages.
 */
async function fetchAllWorklogPages(
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
      response = await apiFetch('jira', url, { headers }, 'Load Issue Detail');
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

/**
 * Fetch issues in the active sprint for a project.
 *
 * Uses a two-query strategy: first query fetches parent issues (Jira DC's
 * `sprint in openSprints()` intentionally excludes subtasks), second query
 * fetches subtasks for those parents in chunks of 50 keys.
 *
 * Both queries are fully paginated — all pages are fetched until total is
 * exhausted, so sprints with >200 issues or chunks with >200 subtasks are
 * handled correctly.
 *
 * On any failure of the second (subtask) query, parent issues are returned
 * alone — callers never observe an error from subtask fetching.
 *
 * @param baseUrl      - Jira base URL
 * @param token        - Personal Access Token
 * @param projectKey   - Jira project key (e.g. "PROJ")
 * @param assignedToMe - If true, adds `AND assignee = currentUser()`.
 *                       If false/omitted, returns all sprint issues.
 * @throws Error('Sprint filtering unavailable — ensure Jira Software is installed') on 400 with sprint errors
 */
export async function fetchSprintIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = true,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const assigneeClause = assignedToMe ? ' AND assignee = currentUser()' : '';
  // Include both common story-point field IDs plus the discovered key (deduplicated) so
  // the response contains whichever one this Jira instance uses.
  const spFields = [
    ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  ].join(',');
  const fields = `summary,status,assignee,issuetype,project,labels,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking,duedate`;
  const jql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints()${assigneeClause} AND issuetype not in subtaskIssueTypes() ORDER BY rank ASC`,
  );
  const baseSearchUrl = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`;

  let parentIssues: JiraIssue[];
  try {
    parentIssues = await fetchAllSearchPages(baseSearchUrl, headers);
  } catch (err) {
    // Re-throw ApiError directly (auth failures from fetchAllSearchPages)
    if (err instanceof ApiError) throw err;
    // fetchAllSearchPages throws the raw Response (or a Response-like mock) on first-page
    // failure. Detect by checking for a numeric status property.
    if (isResponseLikeError(err)) {
      const status = err.status;
      if (status === 400) {
        const body = typeof err.text === 'function' ? await err.text() : '';
        if (body.includes('function') || body.includes('not recognized')) {
          throw new Error('Sprint filtering unavailable — ensure Jira Software is installed');
        }
        throw new Error(`Jira search failed with status 400`);
      }
      throw new Error(`Jira search failed with status ${status}`);
    }
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  // Second query: fetch subtasks for all parent issues
  // Note: sprint in openSprints() excludes subtasks on Jira DC by design
  const parentKeys = parentIssues.map((i) => i.key);
  if (parentKeys.length === 0) return parentIssues;

  // Subtask fields: same as parent query EXCEPT description is omitted (fetched on-demand)
  const subtaskFields = 'summary,status,assignee,issuetype,project,parent,timetracking';

  try {
    // Chunk to stay within Jira DC URL length limits (~6000 chars JQL max)
    const chunks: string[][] = [];
    for (let i = 0; i < parentKeys.length; i += SUBTASK_CHUNK_SIZE) {
      chunks.push(parentKeys.slice(i, i + SUBTASK_CHUNK_SIZE));
    }

    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        const subtaskJql = encodeURIComponent(
          `issuetype in subtaskIssueTypes() AND parent in (${chunk.join(',')})${assigneeClause}`,
        );
        const subtaskBaseUrl = `${base}/rest/api/2/search?jql=${subtaskJql}&fields=${subtaskFields}`;
        try {
          return await fetchAllSearchPages(subtaskBaseUrl, headers);
        } catch {
          return [];
        }
      }),
    );

    const subtasks = chunkResults.flat();
    return [...parentIssues, ...subtasks];
  } catch {
    // Subtask query failed: return parent issues only, silently
    return parentIssues;
  }
}

/**
 * Fetch all sprint issues relevant to the current user with full team hierarchy.
 *
 * Returns every story where the user is assigned OR where at least one subtask is
 * assigned to them, together with ALL subtasks of those stories (not just the user's).
 * Callers can use `myIssueKeys` to visually distinguish issues not assigned to the user.
 *
 * Strategy:
 *  1. Parallel: fetch my stories + fetch my subtasks
 *  2. Find parents of my subtasks not already covered by step 1
 *  3. Fetch those additional parent stories
 *  4. Fetch ALL subtasks for every parent (no assignee filter)
 */
export async function fetchMyTasksHierarchy(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  flaggedFieldKey = 'customfield_10021',
): Promise<{ issues: JiraIssue[]; myIssueKeys: Set<string> }> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  // Include both common story-point field IDs plus the discovered key (deduplicated).
  const spFields = [
    ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  ].join(',');
  const fields = `summary,status,assignee,issuetype,project,${spFields},parent,subtasks,timetracking,duedate,${flaggedFieldKey}`;
  const subtaskFields = `summary,status,assignee,issuetype,project,parent,timetracking,duedate,${flaggedFieldKey}`;

  // Step 1: my stories + my subtasks in parallel — both fully paginated
  const myStoriesJql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints() AND issuetype not in subtaskIssueTypes() AND assignee = currentUser() ORDER BY rank ASC`,
  );
  // Note: sprint in openSprints() does not work for subtasks on Jira DC — use statusCategory filter instead.
  // Sprint membership is validated downstream by checking parent key against sprintKeySet.
  const mySubtasksJql = encodeURIComponent(
    `project = ${projectKey} AND issuetype in subtaskIssueTypes() AND assignee = currentUser() AND statusCategory != Done`,
  );

  let myStories: JiraIssue[];
  let mySubtasks: JiraIssue[];
  try {
    [myStories, mySubtasks] = await Promise.all([
      fetchAllSearchPages(
        `${base}/rest/api/2/search?jql=${myStoriesJql}&fields=${fields}`,
        headers,
      ),
      fetchAllSearchPages(
        `${base}/rest/api/2/search?jql=${mySubtasksJql}&fields=${subtaskFields}`,
        headers,
      ).catch(() => [] as JiraIssue[]),
    ]);
  } catch (err) {
    // Re-throw ApiError directly (auth failures from fetchAllSearchPages)
    if (err instanceof ApiError) throw err;
    // fetchAllSearchPages throws the raw Response (or a Response-like mock) on first-page
    // failure. Detect by checking for a numeric status property.
    if (isResponseLikeError(err)) {
      const status = err.status;
      if (status === 400) {
        const body = typeof err.text === 'function' ? await err.text() : '';
        if (body.includes('function') || body.includes('not recognized')) {
          throw new Error('Sprint filtering unavailable — ensure Jira Software is installed');
        }
        throw new Error('Jira search failed with status 400');
      }
      throw new Error(`Jira search failed with status ${status}`);
    }
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  const myIssueKeys = new Set([...myStories.map((s) => s.key), ...mySubtasks.map((s) => s.key)]);
  const myStoryKeys = new Set(myStories.map((s) => s.key));

  // Step 2: parent keys of my subtasks not already covered by myStories
  const extraParentKeys = [
    ...new Set(
      mySubtasks
        .map((s) => s.fields.parent?.key)
        .filter((k): k is string => !!k && !myStoryKeys.has(k)),
    ),
  ];

  // Step 3: fetch additional parent stories (if any) — sprint-scoped so old-sprint parents are excluded
  let extraParents: JiraIssue[] = [];
  if (extraParentKeys.length > 0) {
    try {
      const extraJql = encodeURIComponent(
        `key in (${extraParentKeys.join(',')}) AND sprint in openSprints()`,
      );
      extraParents = await fetchAllSearchPages(
        `${base}/rest/api/2/search?jql=${extraJql}&fields=${fields}`,
        headers,
      );
    } catch {
      /* return partial results */
    }
  }

  const allParents = [...myStories, ...extraParents];
  if (allParents.length === 0) return { issues: [], myIssueKeys };

  // Step 4: fetch ALL subtasks for every parent (no assignee filter) — fully paginated per chunk
  const allParentKeys = allParents.map((p) => p.key);
  const chunks: string[][] = [];
  for (let i = 0; i < allParentKeys.length; i += SUBTASK_CHUNK_SIZE) {
    chunks.push(allParentKeys.slice(i, i + SUBTASK_CHUNK_SIZE));
  }

  let allSubtasks: JiraIssue[] = [];
  try {
    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        // Parents are already sprint-scoped; sprint in openSprints() is not supported for subtasks on Jira DC.
        const jql = encodeURIComponent(
          `issuetype in subtaskIssueTypes() AND parent in (${chunk.join(',')}) AND statusCategory != Done`,
        );
        try {
          return await fetchAllSearchPages(
            `${base}/rest/api/2/search?jql=${jql}&fields=${subtaskFields}`,
            headers,
          );
        } catch {
          return [];
        }
      }),
    );
    allSubtasks = chunkResults.flat();
  } catch {
    /* return parents without subtasks */
  }

  return { issues: [...allParents, ...allSubtasks], myIssueKeys };
}

/**
 * Fetch ALL issues assigned to the current user in the given project (All-Assigned scope).
 *
 * Returns every non-subtask issue assigned to the authenticated user, fully paginated
 * via `fetchAllSearchPages` from jira/client — no page cap, no hand-rolled loop.
 *
 * The JQL hard-codes `assignee = currentUser()` so the scope can only ever return the
 * authenticated user's own issues (T-82-04 threat mitigation).
 *
 * The fields list includes `customfield_10020` (sprint field) for By Sprint & Parent
 * ordering (D-05), story-point fields, duedate, and the flagged field so My Day band
 * classification can detect flagged items.
 *
 * @param baseUrl             - Jira base URL (trailing slash stripped internally)
 * @param token               - Bearer PAT for Authorization header
 * @param projectKey          - Jira project key (e.g. "PROJ")
 * @param flaggedFieldKey     - Custom field key for the Flagged field (default: customfield_10021)
 * @param storyPointsFieldKey - Custom field key for story points (default: customfield_10016)
 * @returns { issues, myIssueKeys } — all issues + a Set of issue keys for identity checks
 */
export async function fetchAllAssignedHierarchy(
  baseUrl: string,
  token: string,
  projectKey: string,
  flaggedFieldKey = 'customfield_10021',
  storyPointsFieldKey = 'customfield_10016',
): Promise<{ issues: JiraIssue[]; myIssueKeys: Set<string> }> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Deduplicate story-point field IDs (customfield_10016 is the default but may equal storyPointsFieldKey).
  const spFields = [
    ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  ].join(',');

  // customfield_10020 = sprint field (required for By Sprint & Parent ordering D-05).
  const fields = [
    'summary',
    'status',
    'assignee',
    'issuetype',
    'project',
    spFields,
    'customfield_10020',
    'parent',
    'subtasks',
    'timetracking',
    'duedate',
    flaggedFieldKey,
  ].join(',');

  // assignee = currentUser() scopes to the authenticated user only (T-82-04).
  // Sprint clause excludes past/closed sprints — only open, future, or backlog (E1).
  const jql = encodeURIComponent(
    `project = ${projectKey} AND issuetype not in subtaskIssueTypes() AND assignee = currentUser() AND (sprint in openSprints() OR sprint in futureSprints() OR sprint is EMPTY) ORDER BY rank ASC`,
  );

  // fetchAllSearchPagesClient is the exported fetchAllSearchPages from jira/client.ts.
  // It loops until startAt >= total — no maxResults cap is passed here (D-06).
  const issues = await fetchAllSearchPagesClient(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`,
    headers,
  );

  const myIssueKeys = new Set(issues.map((i) => i.key));
  return { issues, myIssueKeys };
}

/**
 * Fetch ALL issues reported by the current user in the given project (All-Reported scope).
 *
 * Returns every non-subtask issue reported by the authenticated user, fully paginated
 * via `fetchAllSearchPages` from jira/client — no page cap, no hand-rolled loop.
 *
 * Sprint scoping mirrors fetchAllAssignedHierarchy (E1/E2): restricts to open sprints,
 * future sprints, or backlog — closed/past sprints are excluded.
 *
 * @param baseUrl             - Jira base URL (trailing slash stripped internally)
 * @param token               - Bearer PAT for Authorization header
 * @param projectKey          - Jira project key (e.g. "PROJ")
 * @param flaggedFieldKey     - Custom field key for the Flagged field (default: customfield_10021)
 * @param storyPointsFieldKey - Custom field key for story points (default: customfield_10016)
 * @returns { issues, myIssueKeys } — all issues + a Set of issue keys for identity checks
 */
export async function fetchAllReportedHierarchy(
  baseUrl: string,
  token: string,
  projectKey: string,
  flaggedFieldKey = 'customfield_10021',
  storyPointsFieldKey = 'customfield_10016',
): Promise<{ issues: JiraIssue[]; myIssueKeys: Set<string> }> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Deduplicate story-point field IDs.
  const spFields = [
    ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  ].join(',');

  // customfield_10020 = sprint field (required for By Sprint & Parent ordering D-05).
  const fields = [
    'summary',
    'status',
    'assignee',
    'issuetype',
    'project',
    spFields,
    'customfield_10020',
    'parent',
    'subtasks',
    'timetracking',
    'duedate',
    flaggedFieldKey,
  ].join(',');

  // reporter = currentUser() scopes to issues the authenticated user created (E2).
  // Sprint clause excludes past/closed sprints — only open, future, or backlog (E1/E2).
  const jql = encodeURIComponent(
    `project = ${projectKey} AND issuetype not in subtaskIssueTypes() AND reporter = currentUser() AND (sprint in openSprints() OR sprint in futureSprints() OR sprint is EMPTY) ORDER BY rank ASC`,
  );

  const issues = await fetchAllSearchPagesClient(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`,
    headers,
  );

  const myIssueKeys = new Set(issues.map((i) => i.key));
  return { issues, myIssueKeys };
}

export { fetchIssueChangelog } from './jira/changelog';
export { fetchComments, postComment } from './jira/comments';
export type { DropResolutionDecision } from './jira/transitions';
/**
 * Phase 72 (WR-01): postTransition was duplicated between this file and
 * `services/jira/transitions.ts`. The modular implementation is canonical
 * (per Phase 72 GH-CUT-01); this re-export preserves the legacy
 * `@/services/jira` import path while ensuring there is only one source of
 * truth for the transition POST logic. New code should import from
 * `@/services/jira/transitions` directly.
 */
export {
  fetchIssueTransitionsWithFields,
  postTransition,
  resolveDropResolution,
  transitionsWithFieldsKey,
} from './jira/transitions';
export type { JiraComment, JiraTransitionFieldMeta, JiraTransitionWithFields } from './jira/types';

// ─── Standup Activity ──────────────────────────────────────────────────────────

/**
 * A single Jira issue's activity summary for the yesterday standup recap.
 *
 * Contains status transitions and comments authored by the current user on
 * the target date, grouped per issue.
 */
export interface JiraActivityItem {
  issueKey: string;
  summary: string;
  /** Jira issue type name (e.g. "Story", "Bug", "Sub-task", "Epic") for icon display. */
  issueType?: string;
  transitions: Array<{
    fromStatus: string;
    toStatus: string;
    at: string;
    /** Jira statusCategory.key ('new' | 'indeterminate' | 'done') for the from-status,
     *  resolved from the global status list by name. Undefined when unmapped or when the
     *  status-list fetch failed (consumer falls back to the 'new' gray pill). */
    fromCategory?: string;
    /** statusCategory.key for the to-status; see fromCategory. */
    toCategory?: string;
  }>;
  comments: Array<{ body: string; at: string }>;
}

/**
 * Fetch Jira activity I authored on `date`: status transitions + comments,
 * filtered client-side to entries matching `jiraUsername` and the exact date.
 *
 * Strategy (D-01, D-02, D-03 from CONTEXT.md):
 * 1. JQL search: `project = {projectKey} AND status CHANGED BY "{jiraUsername}"
 *    DURING ("{date}", "{nextDay}")` with `expand=changelog` and `maxResults=50`
 *    so the user's own status transitions are returned inline. Scoping the JQL
 *    to the user (rather than the whole project's daily churn) keeps the result
 *    set — and the expand=changelog payload — small enough to stay well under
 *    the 15s fetch timeout. NOTE: issues the user only commented on (no status
 *    transition) are therefore out of scope; comments are reported only for
 *    issues that also have a transition by the user that day.
 * 2. For each issue, filter changelog.histories to entries where
 *    `author.name === jiraUsername` AND `created.slice(0,10) === date`
 *    AND at least one item has `field === 'status'`.
 * 3. For each issue, fetch `/rest/api/2/issue/{key}/comment` inside a
 *    try/catch (graceful per-issue degradation), filtering to comments
 *    matching `author.name === jiraUsername` AND `created.slice(0,10) === date`.
 * 4. Only push to the result when transitions.length > 0 || comments.length > 0.
 *
 * Date comparisons always use `.slice(0, 10)` on ISO strings — never toLocaleDateString().
 *
 * @param baseUrl       Jira base URL
 * @param token         Personal Access Token (Bearer)
 * @param projectKey    Jira project key (e.g. "PROJ")
 * @param date          Target date YYYY-MM-DD (last working day)
 * @param jiraUsername  Username to filter by (matches changelog/comment author.name)
 * @returns Array of issues with at least one matching transition or comment
 */
export async function fetchYesterdayJiraActivity(
  baseUrl: string,
  token: string,
  projectKey: string,
  date: string,
  jiraUsername: string,
): Promise<JiraActivityItem[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Step 1: JQL search with changelog expansion (D-01, D-03), scoped to the
  // issues THIS user transitioned during the target day. A broad
  // `project = X AND updated >= date` filter matched the whole project's daily
  // churn and expand=changelog then serialized each issue's entire lifetime
  // history — a payload large enough to blow the 15s fetch timeout on a busy
  // project. `status CHANGED BY <user> DURING (date, nextDay)` returns only the
  // user's own transitions, so the result set stays tiny. nextDay is date + 1
  // day, computed TZ-safe from local date components (never toLocaleDateString()
  // — Phase 62 rule).
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const nextDay = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;

  const jql = encodeURIComponent(
    `project = ${projectKey} AND status CHANGED BY "${jiraUsername}" DURING ("${date}", "${nextDay}") ORDER BY updated DESC`,
  );
  const url = `${base}/rest/api/2/search?jql=${jql}&maxResults=50&expand=changelog&fields=summary,issuetype`;

  const response = await apiFetch('jira', url, { headers }, 'Load Standup Jira Activity');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch Jira activity', response.status, 'jira');
    }
    throw new Error(`Jira activity fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    issues?: Array<{
      key: string;
      fields: { summary: string; issuetype?: { name: string } };
      changelog?: { histories: ChangelogHistory[] };
    }>;
  };

  const issues = data.issues ?? [];

  // Build a name → statusCategory.key map from the global Jira status list so each
  // transition's display names (the changelog only carries names, never ids/categories)
  // can be enriched with a category key for pill coloring. Fetched ONCE per activity
  // load and wrapped in try/catch: a failure must NOT abort the standup load — the
  // categories simply stay undefined and the consumer falls back to the 'new' gray pill.
  const statusMap = new Map<string, string>();
  try {
    const statuses = await fetchAllJiraStatuses(base, token);
    for (const s of statuses) {
      statusMap.set(s.name, s.statusCategory.key);
    }
  } catch {
    // Graceful degradation: leave statusMap empty → undefined categories.
  }

  // Steps 2+3 run per-issue. The comment fetch is one HTTP round-trip per issue,
  // so we fan out through the global Jira limiter (bounded concurrency) rather
  // than awaiting sequentially — a sequential loop over up to 50 issues stacked
  // each round-trip's latency and left the section on a skeleton for far too long.
  const limit = getJiraLimit();
  const perIssue = await Promise.all(
    issues.map((issue) =>
      limit(async (): Promise<JiraActivityItem> => {
        // Step 2: filter transitions by author + date (D-02)
        const transitions = (issue.changelog?.histories ?? [])
          .filter(
            (h) =>
              h.author.name === jiraUsername &&
              h.created.slice(0, 10) === date &&
              h.items.some((i) => i.field === 'status'),
          )
          .map((h) => {
            const statusItem = h.items.find((i) => i.field === 'status') as NonNullable<
              (typeof h.items)[number]
            >;
            return {
              fromStatus: statusItem.fromString ?? '',
              toStatus: statusItem.toString ?? '',
              at: h.created,
              fromCategory: statusMap.get(statusItem.fromString ?? ''),
              toCategory: statusMap.get(statusItem.toString ?? ''),
            };
          });

        // Step 3: fetch + filter comments (D-02) — graceful per-issue degradation
        let comments: Array<{ body: string; at: string }> = [];
        try {
          const commentsUrl = `${base}/rest/api/2/issue/${issue.key}/comment`;
          const commentsRes = await apiFetch(
            'jira',
            commentsUrl,
            { headers },
            'Load Standup Jira Comments',
          );
          if (commentsRes.ok) {
            const commentsData = (await commentsRes.json()) as { comments: JiraComment[] };
            comments = (commentsData.comments ?? [])
              .filter((c) => c.author.name === jiraUsername && c.created.slice(0, 10) === date)
              .map((c) => ({ body: c.body, at: c.created }));
          }
        } catch {
          // Graceful degradation: a failing comment fetch for one issue
          // must not abort the entire standup activity load.
        }

        return {
          issueKey: issue.key,
          summary: issue.fields.summary,
          issueType: issue.fields.issuetype?.name,
          transitions,
          comments,
        };
      }),
    ),
  );

  // Step 4: only include issues with at least one matched activity entry
  return perIssue.filter((r) => r.transitions.length > 0 || r.comments.length > 0);
}

/** A Jira issue created by the active user on the standup date. */
export interface JiraCreatedIssue {
  issueKey: string;
  summary: string;
  issueType?: string;
}

/**
 * Fetch issues created by `jiraUsername` in `projectKey` on `date`.
 *
 * Uses `reporter =` JQL (the standard Jira DC field for issue creator).
 * nextDay is computed TZ-safe from local date components — never
 * toLocaleDateString() (Phase 62 standing rule).
 */
export async function fetchYesterdayCreatedIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  date: string,
  jiraUsername: string,
): Promise<JiraCreatedIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const nextDay = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;

  const escapedUser = jiraUsername.replace(/"/g, '\\"');
  const jql = encodeURIComponent(
    `project = ${projectKey} AND reporter = "${escapedUser}" AND created >= "${date}" AND created < "${nextDay}" ORDER BY created ASC`,
  );
  const url = `${base}/rest/api/2/search?jql=${jql}&maxResults=50&fields=summary,issuetype`;

  const response = await apiFetch('jira', url, { headers }, 'Load Standup Created Issues');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch created issues', response.status, 'jira');
    }
    throw new Error(`Jira created issues fetch failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    issues?: Array<{
      key: string;
      fields: { summary: string; issuetype?: { name: string } };
    }>;
  };

  return (data.issues ?? []).map((issue) => ({
    issueKey: issue.key,
    summary: issue.fields.summary,
    issueType: issue.fields.issuetype?.name,
  }));
}

/** Per-issue metadata the Standup recap needs for icons + parent-story grouping. */
export interface StandupIssueMeta {
  /** Issue type name (e.g. "Story", "Bug", "Sub-task"). */
  type?: string;
  /** True when this issue's type is a sub-task type (drives parent rollup). */
  isSubtask?: boolean;
  summary?: string;
  /** Parent issue key (present for sub-tasks). */
  parentKey?: string;
  parentSummary?: string;
  parentType?: string;
}

/**
 * Resolve issue metadata (type, sub-task flag, summary, parent) for a set of
 * issue keys in a single JQL batch.
 *
 * Used by the Standup Notes recap to (a) render the correct type icon for
 * issues that surface only via commits or MR activity, and (b) roll a sub-task's
 * activity up to its parent story so related work groups together. Failures
 * degrade gracefully to an empty map (no icons, no rollup — per-issue grouping).
 *
 * @returns Map of issue key → metadata.
 */
export async function fetchIssueMeta(
  baseUrl: string,
  token: string,
  keys: string[],
): Promise<Record<string, StandupIssueMeta>> {
  if (keys.length === 0) return {};
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const jql = encodeURIComponent(`key in (${keys.join(',')})`);
  const url = `${base}/rest/api/2/search?jql=${jql}&maxResults=${keys.length}&fields=issuetype,summary,parent`;

  const response = await apiFetch('jira', url, { headers }, 'Load Standup Issue Meta');
  if (!response.ok) return {};

  const data = (await response.json()) as {
    issues?: Array<{
      key: string;
      fields: {
        summary?: string;
        issuetype?: { name: string; subtask?: boolean };
        parent?: { key: string; fields?: { summary?: string; issuetype?: { name: string } } };
      };
    }>;
  };

  const map: Record<string, StandupIssueMeta> = {};
  for (const issue of data.issues ?? []) {
    map[issue.key] = {
      type: issue.fields.issuetype?.name,
      isSubtask: issue.fields.issuetype?.subtask,
      summary: issue.fields.summary,
      parentKey: issue.fields.parent?.key,
      parentSummary: issue.fields.parent?.fields?.summary,
      parentType: issue.fields.parent?.fields?.issuetype?.name,
    };
  }
  return map;
}

export { deleteComment, updateComment } from './jira/comments';

// ─── Phase 4: PM Dashboard & Search ──────────────────────────────────────────

/**
 * Fetch all fix versions (releases) for a Jira project.
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @returns Array of fix versions ordered by release date
 */
export async function fetchFixVersions(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraFixVersion[]> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/api/2/project/${projectKey}/versions`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      'Load Releases',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (data as { errorMessages?: string[] }).errorMessages?.[0] ?? 'Failed to fetch fix versions';
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(msg, response.status, 'jira');
    }
    throw new Error(msg);
  }

  const data = await response.json();
  // GET /rest/api/2/project/{projectKey}/versions returns a bare array
  return (Array.isArray(data) ? data : []) as JiraFixVersion[];
}

/**
 * Update a Jira fix version (release) via PUT /rest/api/2/version/{versionId}.
 *
 * @param baseUrl   - Jira base URL
 * @param token     - Personal Access Token
 * @param versionId - Jira version ID
 * @param fields    - Fields to update (only non-undefined are sent)
 * @returns Updated JiraFixVersion
 */
export async function updateFixVersion(
  baseUrl: string,
  token: string,
  versionId: string,
  fields: { name?: string; releaseDate?: string | null; description?: string; released?: boolean },
): Promise<JiraFixVersion> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/api/2/version/${versionId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fields),
      },
      'Update Release',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (data as { errorMessages?: string[] }).errorMessages?.[0] ?? 'Failed to update fix version';
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(msg, response.status, 'jira');
    }
    throw new Error(msg);
  }

  return (await response.json()) as JiraFixVersion;
}

/**
 * Fetch all issues with a given Jira fix version using JQL.
 *
 * Returns status fields only (fields=status) — sufficient for done% computation and
 * keeps the response payload minimal. Returns an empty array on any network error or
 * non-ok response so it never blocks dashboard rendering.
 *
 * @param baseUrl     - Jira base URL
 * @param token       - Personal Access Token
 * @param projectKey  - Jira project key (e.g. "PROJ")
 * @param versionName - Fix version name to query (e.g. "v1.0")
 * @returns Array of issues tagged with the given fix version; empty array on error
 */
export async function fetchReleaseIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  versionName: string,
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const jql = `project=${projectKey} AND fixVersion="${versionName.replace(/"/g, '\\"')}"`;
  const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=status&maxResults=500`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      'Load Release Issues',
    );
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.issues ?? []) as JiraIssue[];
}

/**
 * Search Jira issues by text query using JQL.
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @param query      - Free-text search query
 * @returns Array of matching issues (up to 20); returns empty array on error to not block parallel search
 */
export async function searchJira(
  baseUrl: string,
  token: string,
  projectKey: string,
  query: string,
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const jql = `project = ${projectKey} AND text ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
  const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,customfield_10016,description&maxResults=20`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      'Search Issues',
    );
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.issues ?? []) as JiraIssue[];
}

/**
 * Search for closed (Done) Jira issues matching a free-text query.
 *
 * Uses statusCategory = Done to explicitly target completed issues, which Jira's
 * text index may deprioritise or exclude in certain configurations.
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @param query      - Free-text search query
 * @returns Array of matching closed issues (up to 20); returns empty array on error
 */
export async function searchJiraClosed(
  baseUrl: string,
  token: string,
  projectKey: string,
  query: string,
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const jql = `project = ${projectKey} AND statusCategory = Done AND text ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
  const url = `${base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,customfield_10016,description&maxResults=20`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      'Search Closed Issues',
    );
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return (data.issues ?? []) as JiraIssue[];
}

// ─── Phase 8: Dashboard Enrichment ───────────────────────────────────────────

export interface JiraActiveSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
  startDate?: string;
  endDate?: string;
  goal?: string;
  originBoardId?: number;
}

/**
 * Fetch the active sprint for a Jira project using the Agile REST API.
 *
 * Step 1: Discover the scrum board for the project via GET /rest/agile/1.0/board.
 * Step 2: Fetch the active sprint from that board via GET /rest/agile/1.0/board/{boardId}/sprint?state=active.
 *
 * Returns null on any failure (board not found, sprint not found, network error).
 * Never throws — all errors are caught and null is returned (graceful-hide).
 *
 * NOTE: apiFetch already adds a 15-second AbortController timeout (Quick-9).
 *
 * @param baseUrl    - Jira base URL (e.g. "https://jira.example.com")
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @returns Active sprint or null
 */
export async function fetchActiveSprint(
  baseUrl: string,
  token: string,
  projectKey: string,
  boardId?: number,
): Promise<JiraActiveSprint | null> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    // Step 1: board discovery (skipped when a board id is provided)
    let resolvedBoardId: number | undefined = boardId;
    if (resolvedBoardId === undefined) {
      const boardRes = await apiFetch(
        'jira',
        `${base}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&type=scrum`,
        { headers },
        'Discover Board',
      );
      if (!boardRes.ok) return null;
      const boardData = await boardRes.json();
      resolvedBoardId = boardData?.values?.[0]?.id;
    }
    if (!resolvedBoardId) return null;

    // Step 2: active sprint
    const sprintRes = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board/${resolvedBoardId}/sprint?state=active`,
      { headers },
      'Load Active Sprint',
    );
    if (!sprintRes.ok) return null;
    const sprintData = await sprintRes.json();
    const values: JiraActiveSprint[] = sprintData?.values ?? [];
    if (values.length === 0) return null;

    return values[0];
  } catch {
    return null;
  }
}

// ─── Phase 5: API Foundation ──────────────────────────────────────────────────

/**
 * Discover the story points custom field ID for this Jira instance.
 *
 * Calls GET /rest/api/2/field to get all field descriptors, then matches by name.
 * Falls back to 'customfield_10016' silently on any failure.
 *
 * Cache the result in settings store (storyPointsFieldKey) at app startup.
 */
/**
 * Returns the unique displayNames of all authors who logged work on an issue.
 *
 * Paginates through all worklog pages so issues with many worklogs do not
 * silently lose authors beyond the first page.
 *
 * Silently returns [] on any error — callers use this for attribution enrichment only.
 */
export async function fetchIssueWorklogs(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<string[]> {
  try {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const worklogUrl = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/worklog`;
    const worklogs = await fetchAllWorklogPages(worklogUrl, headers);
    const names = new Set<string>();
    for (const wl of worklogs) {
      const name = wl.author?.displayName;
      if (name) names.add(name);
    }
    return Array.from(names);
  } catch {
    return [];
  }
}

export interface JiraIssueLink {
  id: string;
  type: { id: string; name: string; inward: string; outward: string };
  inwardIssue?: {
    id: string;
    key: string;
    fields: { summary: string; status: { name: string; statusCategory?: { key: string } } };
  };
  outwardIssue?: {
    id: string;
    key: string;
    fields: { summary: string; status: { name: string; statusCategory?: { key: string } } };
  };
}

export interface JiraAttachment {
  id: string;
  filename: string;
  content: string;
  thumbnail?: string;
  mimeType: string;
  size?: number;
}

export interface JiraIssueDetail {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string | null;
    status: { id: string; name: string; statusCategory?: { key: string } };
    issuetype: { id?: string; name: string; subtask: boolean };
    project?: { id: string; key: string };
    priority: { name: string; iconUrl?: string } | null;
    resolution: { id: string; name: string; description?: string } | null;
    assignee: { displayName: string; name: string; avatarUrls: { '48x48': string } } | null;
    reporter: { displayName: string; name?: string; avatarUrls: { '48x48': string } } | null;
    subtasks: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        status: { name: string; statusCategory?: { key: string } };
        assignee?: { displayName: string; name: string; avatarUrls: { '48x48': string } } | null;
      };
    }>;
    issuelinks: JiraIssueLink[];
    comment: { comments: JiraComment[] };
    attachment?: JiraAttachment[];
    labels: string[];
    fixVersions: Array<{ id: string; name: string }>;
    parent?: {
      id: string;
      key: string;
      fields: {
        summary: string;
        issuetype?: { name: string; iconUrl?: string };
        status?: { name: string; statusCategory?: { key: string } };
      };
    };
    created: string;
    updated: string;
    timetracking?: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    duedate: string | null;
    components?: Array<{ id: string; name: string }>;
    customfield_13415?: { value?: string; name?: string } | null;
    [key: string]: unknown;
  };
  changelog?: {
    histories: ChangelogHistory[];
  };
}

export async function discoverCustomFields(
  baseUrl: string,
  token: string,
): Promise<{
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  sprintFieldKey: string;
  epicColorFieldKey: string;
  flaggedFieldKey: string;
}> {
  const defaults = {
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
    epicColorFieldKey: 'customfield_10013',
    flaggedFieldKey: 'customfield_10021',
  };
  try {
    const response = await apiFetch(
      'jira',
      `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
      'Load Fields',
    );
    if (!response.ok) return defaults;
    const fields: Array<{ id: string; name: string; schema?: { custom?: string } }> =
      await response.json();
    const result = { ...defaults };
    for (const f of fields) {
      const custom = f.schema?.custom ?? '';
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-link') result.epicLinkFieldKey = f.id;
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-label') result.epicNameFieldKey = f.id;
      if (custom === 'com.pyxis.greenhopper.jira:gh-sprint') result.sprintFieldKey = f.id;
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-color') result.epicColorFieldKey = f.id;
      if (
        custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float' &&
        (f.name === 'Story Points' || f.name === 'story_points')
      )
        result.storyPointsFieldKey = f.id;
      if (f.id === 'customfield_10028') result.storyPointsFieldKey = f.id;
      if (f.name === 'Flagged') result.flaggedFieldKey = f.id;
    }
    return result;
  } catch {
    return defaults;
  }
}

/**
 * Enrich subtasks with fresh assignee and status data via a JQL search query.
 * Fetches both assignee and status so the enrichment is authoritative for
 * status — the caller's input subtasks array may carry stale status from a
 * cached parent issue-detail response (see debug session
 * issue-status-cache-stale-drawer).
 * Non-critical: returns the original subtasks unenriched on failure.
 */
export async function fetchEnrichedSubtasks(
  baseUrl: string,
  token: string,
  subtasks: Array<{
    key: string;
    fields: {
      summary: string;
      status: { name: string; statusCategory: unknown };
      assignee: JiraIssueDetail['fields']['assignee'];
    };
  }>,
): Promise<typeof subtasks> {
  const base = baseUrl.replace(/\/$/, '');
  const subtaskKeys = subtasks.map((s) => s.key).join(',');
  const enrichJql = encodeURIComponent(`key in (${subtaskKeys})`);
  const enrichUrl = `${base}/rest/api/2/search?jql=${enrichJql}&fields=assignee,status&maxResults=${subtasks.length}`;
  const enrichRes = await apiFetch(
    'jira',
    enrichUrl,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Issue Detail',
  );
  if (!enrichRes.ok) return subtasks;
  const enrichData = (await enrichRes.json()) as {
    issues: Array<{
      key: string;
      fields: {
        assignee: JiraIssueDetail['fields']['assignee'];
        status: { name: string; statusCategory: unknown };
      };
    }>;
  };
  const enrichMap = new Map(enrichData.issues.map((i) => [i.key, i.fields]));
  return subtasks.map((sub) => {
    const fresh = enrichMap.get(sub.key);
    return {
      ...sub,
      fields: {
        ...sub.fields,
        assignee: fresh?.assignee ?? sub.fields.assignee,
        // Use fresh status from server so status pills reflect the latest
        // transition even when the parent's issue-detail cache is stale.
        status: fresh?.status ?? sub.fields.status,
      },
    };
  });
}

export async function fetchIssueDetail(
  baseUrl: string,
  token: string,
  issueKey: string,
  customFields: {
    epicLinkFieldKey: string;
    epicNameFieldKey: string;
    sprintFieldKey: string;
    storyPointsFieldKey: string;
    epicColorFieldKey?: string;
  },
): Promise<JiraIssueDetail> {
  const base = baseUrl.replace(/\/$/, '');
  const fields = [
    'summary',
    'status',
    'assignee',
    'reporter',
    'priority',
    'resolution',
    'customfield_13415',
    'issuetype',
    'project',
    'description',
    'attachment',
    'issuelinks',
    'subtasks',
    'labels',
    'fixVersions',
    'parent',
    'timetracking',
    'created',
    'updated',
    'duedate',
    'components',
    customFields.epicLinkFieldKey,
    customFields.epicNameFieldKey,
    customFields.sprintFieldKey,
    customFields.storyPointsFieldKey,
    customFields.epicColorFieldKey,
  ]
    .filter(Boolean)
    .join(',');
  const url = `${base}/rest/api/2/issue/${issueKey}?fields=${fields}`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Issue Detail',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch issue ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch issue ${issueKey}: ${response.status}`);
  }
  const issue = (await response.json()) as JiraIssueDetail;

  return issue;
}

/**
 * Lightweight issue fetch — returns only summary + issuetype for pinned tab
 * display. Much cheaper than fetchIssueDetail (2 fields vs 18+).
 */
export async function fetchIssueSummary(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<{ key: string; fields: { summary: string; issuetype: { name: string } } }> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/api/2/issue/${issueKey}?fields=summary,issuetype`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Issue Detail',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch issue ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to fetch issue ${issueKey}: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch a single Jira issue by its key, regardless of status (open or closed).
 *
 * Silent-failure contract: returns null on any error (404, auth, network).
 * Callers should show nothing when null is returned.
 *
 * @param baseUrl  - Jira base URL
 * @param token    - Personal Access Token
 * @param issueKey - Jira issue key, e.g. "PROJ-123"
 */
export async function fetchJiraIssueByKey(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraIssue | null> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/rest/api/2/issue/${issueKey}?fields=summary,status,assignee,reporter,priority,customfield_13415,customfield_10016,issuetype`;

  let response: Response;
  try {
    response = await apiFetch(
      'jira',
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      'Load Issue Detail',
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<JiraIssue>;
}

export async function updateIssueField(
  baseUrl: string,
  token: string,
  issueKey: string,
  fieldName: string,
  value: unknown,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { [fieldName]: value } }),
    },
    'Create/Edit Issue',
  );
  if (!response.ok && response.status !== 204) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to update ${fieldName} on ${issueKey}`, response.status, 'jira');
    }
    throw new Error(`Failed to update ${fieldName} on ${issueKey}: ${response.status}`);
  }
}

// ─── Phase 10: Sprint Board Redesign ─────────────────────────────────────────

export interface JiraProjectStatus {
  id: string;
  name: string;
  statusCategory: { key: 'new' | 'indeterminate' | 'done' | string };
}

/**
 * Fetch all statuses for a Jira project, flattened across issue types.
 *
 * Calls GET /rest/api/2/project/{projectKey}/statuses which returns one object
 * per issue type, each with a `statuses` array. This function flattens them
 * and deduplicates by status id (first occurrence wins).
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @returns Deduplicated array of JiraProjectStatus across all issue types
 * @throws Error with message "Failed to fetch project statuses: {status}" on non-ok response
 */
export async function fetchProjectStatuses(
  baseUrl: string,
  token: string,
  projectKey: string,
): Promise<JiraProjectStatus[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/project/${projectKey}/statuses`;
  const response = await apiFetch(
    'jira',
    url,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    'Load Board',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch project statuses', response.status, 'jira');
    }
    throw new Error(`Failed to fetch project statuses: ${response.status}`);
  }
  const data: Array<{ statuses: JiraProjectStatus[] }> = await response.json();
  const seen = new Set<string>();
  const result: JiraProjectStatus[] = [];
  for (const issueType of data) {
    for (const status of issueType.statuses) {
      if (!seen.has(status.id)) {
        seen.add(status.id);
        result.push(status);
      }
    }
  }
  return result;
}

// ─── Phase 11: Create/Edit Issue Form ─────────────────────────────────────────

/**
 * Field descriptor returned by the createmeta endpoints.
 * Returned by both the Jira 8.4+ paginated endpoint and the legacy flat endpoint.
 */
export interface CreatemetaField {
  fieldId: string;
  name: string;
  required: boolean;
  autoCompleteUrl?: string;
  schema: {
    type: string;
    items?: string;
    system?: string;
    custom?: string;
    allowedValues?: Array<{ id: string; value: string }>;
  };
}

/**
 * Issue link type descriptor returned by GET /rest/api/2/issueLinkType.
 */
export interface IssueLinkType {
  id: string;
  name: string;
  inward: string;
  outward: string;
}

/**
 * Create a new Jira issue with optional full field set (Phase 11 extended version).
 *
 * Backward-compatible: existing callers that pass only (baseUrl, token, projectKey, summary)
 * continue to work — the options parameter is optional and defaults to Story type.
 *
 * The submit body is filtered to only include fields that are explicitly defined
 * (i.e. not undefined) to avoid "field not on screen" 400 errors from Jira.
 *
 * CRITICAL: Never send ADF for description — DC REST API accepts wiki markup strings only.
 * CRITICAL: Assignee uses DC format { name: username }, NOT { accountId } (Cloud-only).
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param projectKey - Jira project key (e.g. "PROJ")
 * @param summary    - Issue summary text
 * @param options    - Optional extra fields (all optional, filtered to defined values)
 * @returns Created issue id and key
 * @throws Error with message "Failed to create issue: {status}" on non-ok response
 */
export async function createIssue(
  baseUrl: string,
  token: string,
  projectKey: string,
  summary: string,
  options?: {
    issuetype?: string; // 'Story' | 'Subtask' | 'Bug' — defaults to 'Story' if omitted
    issueTypeId?: string; // numeric id string; when set, sent as { id } instead of { name }
    description?: string; // wiki markup string (DC always; never ADF)
    assignee?: { name: string }; // DC format — NOT { accountId }
    priority?: { name: string };
    parent?: { key: string }; // required for Subtasks
    [fieldKey: string]: unknown; // dynamic custom fields (storyPoints, epicLink, account, etc.)
  },
): Promise<{ id: string; key: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue`;

  // Base required fields
  const baseFields: Record<string, unknown> = {
    project: { key: projectKey },
    summary,
    issuetype: options?.issueTypeId
      ? { id: options.issueTypeId }
      : { name: options?.issuetype ?? 'Story' },
  };

  // Merge in optional fields, filtering out undefined values
  if (options) {
    const { issuetype, issueTypeId, ...rest } = options;
    void issuetype; // consumed above via options?.issuetype
    void issueTypeId; // consumed above — sent as { id } when present
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) {
        baseFields[k] = v;
      }
    }
  }

  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: baseFields }),
    },
    'Create/Edit Issue',
  );
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to create issue', response.status, 'jira');
    }
    throw new Error(`Failed to create issue: ${response.status}`);
  }
  return response.json() as Promise<{ id: string; key: string }>;
}

/**
 * Discover required fields for a given issue type via the createmeta endpoint.
 *
 * Strategy (Jira version adaptive):
 * 1. Try new paginated endpoint (Jira 8.4+): GET /rest/api/2/issue/createmeta/{project}/issuetypes/{id}
 * 2. On non-ok (including 404 on pre-8.4 instances), fall back to legacy flat endpoint:
 *    GET /rest/api/2/issue/createmeta?projectKeys={key}&issuetypeNames={name}&expand=projects.issuetypes.fields
 *
 * @param baseUrl       - Jira base URL
 * @param token         - Personal Access Token
 * @param projectKey    - Jira project key (e.g. "PROJ")
 * @param issueTypeId   - Numeric issue type ID (required for new paginated endpoint)
 * @param issueTypeName - Issue type display name (required for legacy fallback)
 * @returns Array of CreatemetaField descriptors
 */
/**
 * Wrap a raw string value into the shape Jira DC expects for a given custom field.
 * - user fields: { name: value }
 * - id-keyed fields (option lists, accounts, etc.): { id: value }
 * - everything else: raw string
 */
export function wrapCustomFieldValue(
  field: CreatemetaField,
  value: string,
): string | { name: string } | { id: string } {
  if (field.schema.type === 'user' || field.schema.items === 'user') return { name: value };
  // autoCompleteUrl fields that return id-based items (accounts, versions, components…)
  if (field.autoCompleteUrl && field.schema.type !== 'string') return { id: value };
  return value;
}

/**
 * Derive an autoCompleteUrl for fields that the API doesn't provide one for.
 * Maps known plugin schema.custom patterns to their REST search endpoints.
 * Extend this map as new field types are encountered.
 */
function deriveAutoCompleteUrl(field: CreatemetaField, base: string): string | undefined {
  if (field.autoCompleteUrl) return field.autoCompleteUrl;
  const custom = field.schema.custom ?? '';
  if (custom.includes('tempo-accounts'))
    return `${base}/rest/tempo-accounts/1/account/search?query=`;
  return undefined;
}

export async function fetchCreatemeta(
  baseUrl: string,
  token: string,
  projectKey: string,
  issueTypeId: string,
  issueTypeName: string,
): Promise<CreatemetaField[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}` };

  const enrich = (fields: CreatemetaField[]) =>
    fields.map((f) => ({ ...f, autoCompleteUrl: deriveAutoCompleteUrl(f, base) }));

  // Strategy A: Jira 8.4+ paginated endpoint
  const newEndpoint = `${base}/rest/api/2/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}?maxResults=50`;
  const resp = await apiFetch('jira', newEndpoint, { headers }, 'Load Fields');
  if (resp.ok) {
    const data = await resp.json();
    return enrich((data.values ?? []) as CreatemetaField[]);
  }

  // Strategy B: Legacy flat endpoint (pre-8.4 or 9.0+ with re-enabled flag)
  const legacyUrl = `${base}/rest/api/2/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=${encodeURIComponent(issueTypeName)}&expand=projects.issuetypes.fields`;
  const legacyResp = await apiFetch('jira', legacyUrl, { headers }, 'Load Fields');
  if (!legacyResp.ok) return [];
  const legacyData = await legacyResp.json();
  const fields = legacyData.projects?.[0]?.issuetypes?.[0]?.fields;
  if (!fields) return [];
  return enrich(Object.values(fields) as CreatemetaField[]);
}

/**
 * Priority descriptor returned by GET /rest/api/2/priority.
 * The instance's configured scheme determines which priorities are present.
 * Never hardcode standard-Jira names like "Highest" — always use fetched names.
 */
export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
  self: string;
}

/**
 * Fetch all priorities configured on this Jira instance from GET /rest/api/2/priority.
 *
 * Priority names are scheme-configurable — never hardcode "Highest", "High", etc.
 * Returns empty array on any non-ok response (graceful degradation).
 *
 * @param baseUrl - Jira base URL
 * @param token   - Personal Access Token
 * @returns Array of JiraPriority descriptors ordered as the instance returns them
 */
export async function fetchPriorities(baseUrl: string, token: string): Promise<JiraPriority[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/priority`;
  const resp = await apiFetch(
    'jira',
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'Load Priorities',
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch the priorities that are actually valid for a SPECIFIC issue, scoped to its
 * project/issue-type priority scheme, from GET /rest/api/2/issue/{key}/editmeta.
 *
 * The global GET /rest/api/2/priority returns every priority defined on the instance —
 * far more than any single project's scheme uses. The editmeta `fields.priority.allowedValues`
 * is the authoritative per-issue set (same mechanism we use for resolution allowedValues).
 *
 * Returns an empty array when priority is not on the edit screen or on any non-ok
 * response — callers should fall back to fetchPriorities for graceful degradation.
 *
 * @param baseUrl  - Jira base URL
 * @param token    - Personal Access Token
 * @param issueKey - Issue key (e.g. "ESHOP-20523")
 * @returns Array of JiraPriority descriptors valid for this issue
 */
export async function fetchIssuePriorityOptions(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraPriority[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/editmeta`;
  const resp = await apiFetch(
    'jira',
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'Load Priorities',
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  const allowed = data?.fields?.priority?.allowedValues;
  return Array.isArray(allowed) ? allowed : [];
}

/**
 * Fetch available issue link types from GET /rest/api/2/issueLinkType.
 *
 * Link type names are admin-configurable — never hardcode "Blocks", "Relates To", etc.
 * Returns empty array on any non-ok response (graceful degradation).
 *
 * @param baseUrl - Jira base URL
 * @param token   - Personal Access Token
 * @returns Array of IssueLinkType descriptors
 */
export async function fetchIssueLinkTypes(
  baseUrl: string,
  token: string,
): Promise<IssueLinkType[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLinkType`;
  const resp = await apiFetch(
    'jira',
    url,
    { headers: { Authorization: `Bearer ${token}` } },
    'Validate Connection',
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.issueLinkTypes ?? [];
}

/**
 * Create an issue link between two issues.
 *
 * Issue links CANNOT be sent in the create body — they must be posted separately
 * after the issue is created. POST /rest/api/2/issueLink returns 201 on success.
 *
 * CRITICAL: Use linkTypeId (not name) to avoid brittleness from admin renames.
 *
 * @param baseUrl    - Jira base URL
 * @param token      - Personal Access Token
 * @param linkTypeId - ID from GET /rest/api/2/issueLinkType (not the name)
 * @param inwardKey  - The issue being created/edited (inward side of the link)
 * @param outwardKey - The linked issue (outward side of the link)
 * @throws Error with "Failed to create issue link: {status}" on non-201/200 response
 */
export async function createIssueLink(
  baseUrl: string,
  token: string,
  linkTypeId: string,
  inwardKey: string,
  outwardKey: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLink`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: { id: linkTypeId },
        inwardIssue: { key: inwardKey },
        outwardIssue: { key: outwardKey },
      }),
    },
    'Manage Links',
  );
  if (!response.ok && response.status !== 201) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to create issue link', response.status, 'jira');
    }
    throw new Error(`Failed to create issue link: ${response.status}`);
  }
}

/**
 * Update multiple fields on a Jira issue in a single PUT request.
 *
 * Prefer this over calling updateIssueField() multiple times for edit mode.
 * The fields object should only include fields confirmed present on screen
 * (via createmeta) to avoid "field not on screen" 400 errors.
 *
 * Jira DC returns 204 on success (not 200) — both are treated as success.
 *
 * @param baseUrl  - Jira base URL
 * @param token    - Personal Access Token
 * @param issueKey - Issue key (e.g. "PROJ-1")
 * @param fields   - Map of field keys to values (only confirmed-present fields)
 * @throws Error with Jira's errorMessages[0] on non-ok, non-204 response
 */
export async function bulkUpdateIssue(
  baseUrl: string,
  token: string,
  issueKey: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    },
    'Create/Edit Issue',
  );
  if (!response.ok && response.status !== 204) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to update ${issueKey}`, response.status, 'jira');
    }
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { errorMessages?: string[] }).errorMessages?.[0] ??
        `Failed to update ${issueKey}: ${response.status}`,
    );
  }
}

// ─── Phase 12: Backlog View ───────────────────────────────────────────────────
// The legacy backlog REST fetchers and their return type were removed in
// Phase 74 Plan 06 (GH-CUT-01, D-09). Backlog data flows through
// services/jira/greenhopper/useGhBacklogData (xboard data.json) instead.
// fetchSprintsForBoard and moveIssuesToBacklog remain in this dual-file
// surface for their non-backlog consumers.

/**
 * Fetch a sprint board's active and future sprints.
 *
 * Calls GET /rest/agile/1.0/board/{boardId}/sprint?state=active,future.
 * Returns an empty array on any failure (graceful degradation — callers render
 * just the backlog section when no sprints are found).
 *
 * @param baseUrl - Jira base URL (e.g. "https://jira.example.com")
 * @param token   - Personal Access Token
 * @param boardId - Numeric board ID (discover via fetchActiveSprint or similar)
 * @returns Array of JiraActiveSprint with state 'active' or 'future', ordered by start date
 */
export async function fetchSprintsForBoard(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraActiveSprint[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  try {
    const res = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`,
      { headers },
      'Load Sprint Board',
    );
    if (!res.ok) return [];
    const data = await res.json();
    const sprints: JiraActiveSprint[] = data?.values ?? [];
    // Sort: active first, then future by startDate ascending
    return sprints.sort((a, b) => {
      if (a.state === 'active' && b.state !== 'active') return -1;
      if (b.state === 'active' && a.state !== 'active') return 1;
      const aDate = a.startDate ?? '';
      const bDate = b.startDate ?? '';
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
    });
  } catch {
    return [];
  }
}

/**
 * Move a set of issues to the backlog (remove from their current sprint).
 *
 * POSTs to POST /rest/agile/1.0/backlog/issue with body { issues: issueKeys }.
 * Jira returns 204 No Content on success -- treated as success.
 * Throws Error on any other non-ok response.
 *
 * @param baseUrl   - Jira base URL (e.g. "https://jira.example.com")
 * @param token     - Personal Access Token
 * @param issueKeys - Array of issue keys to move to backlog (e.g. ["PROJ-1"])
 * @throws Error with status code on non-ok, non-204 response
 */
export async function moveIssuesToBacklog(
  baseUrl: string,
  token: string,
  issueKeys: string[],
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/agile/1.0/backlog/issue`;
  const response = await apiFetch(
    'jira',
    url,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ issues: issueKeys }),
    },
    'Move to Backlog',
  );
  if (!response.ok && response.status !== 204) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to move issues to backlog', response.status, 'jira');
    }
    throw new Error(`Failed to move issues to backlog: ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// Phase 13 — Epic Management
// ---------------------------------------------------------------------------

export interface EpicEnriched {
  key: string;
  epicName: string;
  summary: string;
  status: JiraIssue['fields']['status'];
  assignee: JiraIssue['fields']['assignee'];
  totalStories: number;
  doneStories: number;
  totalPoints: number;
  color?: string | null;
}

/**
 * Fetch all epics in a project without story enrichment — fast first-load.
 */
export async function fetchEpicsBasic(
  baseUrl: string,
  token: string,
  projectKey: string,
  epicNameFieldKey = 'customfield_10015',
  epicColorFieldKey = 'customfield_10013',
): Promise<EpicEnriched[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const epicFields = [
    ...new Set(['summary', 'status', 'assignee', epicNameFieldKey, epicColorFieldKey]),
  ].join(',');
  const epicJql = encodeURIComponent(
    `project = ${projectKey} AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`,
  );
  const epicIssues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${epicJql}&fields=${epicFields}`,
    headers,
  );
  return epicIssues.map((epic) => ({
    key: epic.key,
    epicName: (epic.fields[epicNameFieldKey] as string | null) ?? epic.fields.summary,
    summary: epic.fields.summary,
    status: epic.fields.status,
    assignee: epic.fields.assignee,
    totalStories: 0,
    doneStories: 0,
    totalPoints: 0,
    color: (epic.fields[epicColorFieldKey] as string | null) ?? null,
  }));
}

/**
 * Fetch story counts and points for a set of epic keys and return a map.
 * Used to progressively enrich an already-displayed epic list.
 */
export async function fetchEpicEnrichmentMap(
  baseUrl: string,
  token: string,
  epicKeys: string[],
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<Map<string, { total: number; done: number; points: number }>> {
  if (epicKeys.length === 0) return new Map();
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const storyFields = [
    ...new Set(['status', storyPointsFieldKey, epicLinkFieldKey, 'customfield_10016']),
  ].join(',');
  const storiesJql = encodeURIComponent(
    `"Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`,
  );
  const stories = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${storiesJql}&fields=${storyFields}`,
    headers,
  ).catch(() => [] as JiraIssue[]);

  const countMap = new Map<string, { total: number; done: number; points: number }>();
  for (const story of stories) {
    const ek = story.fields[epicLinkFieldKey] as string | null;
    if (!ek) continue;
    const entry = countMap.get(ek) ?? { total: 0, done: 0, points: 0 };
    entry.total++;
    if (story.fields.status.statusCategory?.key === 'done') entry.done++;
    entry.points += (story.fields[storyPointsFieldKey] as number | null) ?? 0;
    countMap.set(ek, entry);
  }
  return countMap;
}

/**
 * Fetch all epics in a project and enrich them with child story counts and points.
 *
 * Two-query pattern:
 * 1. JQL `issuetype = Epic` returns epic issues.
 * 2. JQL `"Epic Link" in (...)` batches child stories for aggregation.
 *
 * On stories fetch failure the function returns epics with zero counts (no throw).
 */
export async function fetchEpicsWithEnrichment(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<EpicEnriched[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Step 1: fetch epics
  const epicFields = [
    ...new Set([
      'summary',
      'status',
      'assignee',
      'priority',
      'description',
      'created',
      'updated',
      epicNameFieldKey,
    ]),
  ].join(',');
  const epicJql = encodeURIComponent(
    `project = ${projectKey} AND issuetype = Epic AND statusCategory != Done ORDER BY updated DESC`,
  );
  const epicIssues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${epicJql}&fields=${epicFields}`,
    headers,
  );
  if (epicIssues.length === 0) return [];

  // Step 2: batch-fetch child stories (exclude subtasks)
  const epicKeys = epicIssues.map((e) => e.key);
  const storyFields = [
    ...new Set(['status', storyPointsFieldKey, epicLinkFieldKey, 'customfield_10016']),
  ].join(',');
  const storiesJql = encodeURIComponent(
    `"Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`,
  );
  const stories = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${storiesJql}&fields=${storyFields}`,
    headers,
  ).catch(() => [] as JiraIssue[]);

  // Step 3: aggregate per epic
  const countMap = new Map<string, { total: number; done: number; points: number }>();
  for (const story of stories) {
    const ek = story.fields[epicLinkFieldKey] as string | null;
    if (!ek) continue;
    const entry = countMap.get(ek) ?? { total: 0, done: 0, points: 0 };
    entry.total++;
    if (story.fields.status.statusCategory?.key === 'done') entry.done++;
    entry.points += (story.fields[storyPointsFieldKey] as number | null) ?? 0;
    countMap.set(ek, entry);
  }

  return epicIssues.map((epic) => {
    const counts = countMap.get(epic.key) ?? { total: 0, done: 0, points: 0 };
    return {
      key: epic.key,
      epicName: (epic.fields[epicNameFieldKey] as string | null) ?? epic.fields.summary,
      summary: epic.fields.summary,
      status: epic.fields.status,
      assignee: epic.fields.assignee,
      totalStories: counts.total,
      doneStories: counts.done,
      totalPoints: counts.points,
    };
  });
}

/**
 * Fetch all stories linked to a given epic key, excluding subtasks.
 *
 * Used by EpicDetailSheet to display the stories list for an epic.
 * Returns empty array on fetch failure (no throw).
 */
export async function fetchEpicStories(
  baseUrl: string,
  token: string,
  epicKey: string,
  _projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const fields = [
    ...new Set([
      'summary',
      'status',
      'assignee',
      'issuetype',
      storyPointsFieldKey,
      'customfield_10016',
    ]),
  ].join(',');
  const jql = encodeURIComponent(
    `"Epic Link" = ${epicKey} AND issuetype != Sub-task ORDER BY rank ASC`,
  );
  return fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`,
    headers,
  ).catch(() => [] as JiraIssue[]);
}

export type {
  EntityMaps,
  GhAllDataResponse,
  GhBacklogResponse,
  GhBoardIssue,
  GhDetailsResponse,
  GhEpicEntity,
  GhIssue,
  GhPriorityEntity,
  GhStatusEntity,
  GhTransition,
  GhTransitionsResponse,
  GhTypeEntity,
} from './jira/greenhopper';
// GreenHopper (Phase 71 + Phase 72) — re-exported here per D-05 (legacy dual-file convention; consumers import from 'services/jira').
export {
  adaptIssue,
  buildEntityMaps,
  createAdapter,
  fetchAllData,
  fetchBacklogData,
  fetchGhTransitions,
  filterTransitionsForStatus,
  getGhAllData,
  getGhBacklogData,
  getGhTransitions,
  invalidateGhAllData,
  invalidateGhBacklogData,
  invalidateGhTransitions,
  peekGhTransitions,
  resolveEpic,
  resolveParent,
  resolvePriority,
  resolveStatus,
  resolveType,
  useGhAllData,
  useGhBacklogData,
  useGhTransitions,
} from './jira/greenhopper';
// Jira resolutions — re-exported per dual-file convention.
export { fetchResolutions, type JiraResolution } from './jira/resolutions';
// Jira statuses (Phase 72) — re-exported per dual-file convention.
export { fetchAllJiraStatuses, type JiraStatus } from './jira/statuses';
