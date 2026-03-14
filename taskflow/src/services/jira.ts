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
import { apiFetch } from '../lib/apiFetch';

export interface JiraUser {
  displayName: string;
  emailAddress: string;
  name: string;
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
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return { displayName: data.displayName, emailAddress: data.emailAddress, name: data.name ?? data.emailAddress };
  }

  if (response.status === 401) {
    throw new Error('Invalid token or token has expired');
  }

  if (response.status === 403) {
    throw new Error('Token valid but lacks required permissions');
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
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return data as JiraProject[];
  }

  if (response.status === 401) {
    throw new Error('Invalid token or token has expired');
  }

  if (response.status === 403) {
    throw new Error('Token valid but lacks required permissions');
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
      name: string;
      subtask: boolean; // Use this — NOT name comparison. Admins can rename issue types.
    };
    description?: string | null;
    // v1.1 additions (all optional — non-breaking for all four existing callers):
    parent?: { id: string; key: string; fields: { summary: string } };
    subtasks?: Array<{ id: string; key: string; fields: { summary: string; status: { name: string } } }>;
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
  to: { id: string; name: string };
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
    const response = await apiFetch('jira', url, { headers });

    if (!response.ok) {
      if (startAt === 0) {
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
      response = await apiFetch('jira', url, { headers });
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
 * @param assignedToMe - If true, adds `AND assignee = currentUser()` (my-tasks variant).
 *                       If false/omitted, returns all sprint issues (sprint-board variant).
 * @throws Error('Sprint filtering unavailable — ensure Jira Software is installed') on 400 with sprint errors
 */
export async function fetchSprintIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = true,
  storyPointsFieldKey = 'customfield_10016',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const assigneeClause = assignedToMe ? ' AND assignee = currentUser()' : '';
  // Include both common story-point field IDs plus the discovered key (deduplicated) so
  // the response contains whichever one this Jira instance uses.
  const spFields = [...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey])].join(',');
  const fields = `summary,status,assignee,issuetype,${spFields},parent,subtasks,timetracking`;
  const jql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints()${assigneeClause} AND issuetype not in subtaskIssueTypes() ORDER BY updated DESC`,
  );
  const baseSearchUrl = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`;

  let parentIssues: JiraIssue[];
  try {
    parentIssues = await fetchAllSearchPages(baseSearchUrl, headers);
  } catch (err) {
    // fetchAllSearchPages throws the raw Response on first-page failure
    // fetchAllSearchPages throws the raw Response (or a Response-like mock) on first-page
    // failure. Detect by checking for a numeric status property (duck-typing for both real
    // Response objects and plain-object mocks used in tests).
    if (err !== null && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
      const errObj = err as unknown as { status: number; text?: () => Promise<string> };
      const status = errObj.status;
      if (status === 400) {
        const body = typeof errObj.text === 'function'
          ? await errObj.text()
          : '';
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
  const subtaskFields = 'summary,status,assignee,issuetype,parent,timetracking';

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
): Promise<{ issues: JiraIssue[]; myIssueKeys: Set<string> }> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  // Include both common story-point field IDs plus the discovered key (deduplicated).
  const spFields = [...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey])].join(',');
  const fields = `summary,status,assignee,issuetype,${spFields},parent,subtasks,timetracking`;
  const subtaskFields = 'summary,status,assignee,issuetype,parent,timetracking';

  // Step 1: my stories + my subtasks in parallel — both fully paginated
  const myStoriesJql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints() AND issuetype not in subtaskIssueTypes() AND assignee = currentUser() ORDER BY updated DESC`,
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
      fetchAllSearchPages(`${base}/rest/api/2/search?jql=${myStoriesJql}&fields=${fields}`, headers),
      fetchAllSearchPages(`${base}/rest/api/2/search?jql=${mySubtasksJql}&fields=${subtaskFields}`, headers)
        .catch(() => [] as JiraIssue[]),
    ]);
  } catch (err) {
    // fetchAllSearchPages throws the raw Response (or a Response-like mock) on first-page
    // failure. Detect by checking for a numeric status property (duck-typing for both real
    // Response objects and plain-object mocks used in tests).
    if (err !== null && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
      const errObj = err as unknown as { status: number; text?: () => Promise<string> };
      const status = errObj.status;
      if (status === 400) {
        const body = typeof errObj.text === 'function'
          ? await errObj.text()
          : '';
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
    } catch { /* return partial results */ }
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
        const jql = encodeURIComponent(`issuetype in subtaskIssueTypes() AND parent in (${chunk.join(',')}) AND statusCategory != Done`);
        try {
          return await fetchAllSearchPages(`${base}/rest/api/2/search?jql=${jql}&fields=${subtaskFields}`, headers);
        } catch {
          return [];
        }
      }),
    );
    allSubtasks = chunkResults.flat();
  } catch { /* return parents without subtasks */ }

  return { issues: [...allParents, ...allSubtasks], myIssueKeys };
}

/**
 * Fetch available transitions for a Jira issue.
 *
 * @param baseUrl   - Jira base URL
 * @param token     - Personal Access Token
 * @param issueKey  - Issue key (e.g. "PROJ-1")
 * @returns Array of available transitions
 */
export async function fetchTransitions(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraTransition[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch transitions for ${issueKey}: status ${response.status}`);
  }

  const data = await response.json();
  return data.transitions as JiraTransition[];
}

/**
 * Transition a Jira issue to a new status.
 *
 * @param baseUrl      - Jira base URL
 * @param token        - Personal Access Token
 * @param issueKey     - Issue key (e.g. "PROJ-1")
 * @param transitionId - Transition ID from fetchTransitions
 */
export async function postTransition(
  baseUrl: string,
  token: string,
  issueKey: string,
  transitionId: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/transitions`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to transition ${issueKey}: status ${response.status}`);
  }
}

/**
 * Post a comment on a Jira issue.
 *
 * @param baseUrl  - Jira base URL
 * @param token    - Personal Access Token
 * @param issueKey - Issue key (e.g. "PROJ-1")
 * @param body     - Comment text
 */
export async function postComment(
  baseUrl: string,
  token: string,
  issueKey: string,
  body: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment`;

  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok && response.status !== 201) {
    throw new Error(`Failed to post comment on ${issueKey}: status ${response.status}`);
  }
}

export interface JiraComment {
  id: string;
  author: { displayName: string };
  body: string;
  created: string; // ISO 8601
  updated: string;
}

export async function fetchComments(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraComment[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment`;
  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch comments for ${issueKey}: status ${response.status}`);
  }
  const data = await response.json() as { comments: JiraComment[] };
  return data.comments ?? [];
}

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
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      (data as { errorMessages?: string[] }).errorMessages?.[0] ?? 'Failed to fetch fix versions',
    );
  }

  const data = await response.json();
  // GET /rest/api/2/project/{projectKey}/versions returns a bare array
  return (Array.isArray(data) ? data : []) as JiraFixVersion[];
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
    response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
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
): Promise<JiraActiveSprint | null> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  try {
    // Step 1: board discovery
    const boardRes = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board?projectKeyOrId=${projectKey}&type=scrum`,
      { headers },
    );
    if (!boardRes.ok) return null;
    const boardData = await boardRes.json();
    const boardId: number | undefined = boardData?.values?.[0]?.id;
    if (!boardId) return null;

    // Step 2: active sprint
    const sprintRes = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active`,
      { headers },
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
  id: string
  type: { id: string; name: string; inward: string; outward: string }
  inwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } }
  outwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } }
}

export interface JiraIssueDetail {
  id: string
  key: string
  fields: {
    summary: string
    description: string | null
    status: { id: string; name: string; statusCategory?: { key: string } }
    issuetype: { name: string; subtask: boolean }
    priority: { name: string; iconUrl?: string } | null
    assignee: { displayName: string; name: string; avatarUrls: { '48x48': string } } | null
    reporter: { displayName: string; avatarUrls: { '48x48': string } } | null
    subtasks: Array<{ id: string; key: string; fields: { summary: string; status: { name: string } } }>
    issuelinks: JiraIssueLink[]
    comment: { comments: JiraComment[] }
    labels: string[]
    fixVersions: Array<{ id: string; name: string }>
    parent?: { id: string; key: string; fields: { summary: string } }
    created: string
    updated: string
    duedate: string | null
    [key: string]: unknown
  }
}

export async function discoverCustomFields(
  baseUrl: string,
  token: string,
): Promise<{ storyPointsFieldKey: string; epicLinkFieldKey: string; epicNameFieldKey: string; sprintFieldKey: string }> {
  const defaults = {
    storyPointsFieldKey: 'customfield_10016',
    epicLinkFieldKey: 'customfield_10014',
    epicNameFieldKey: 'customfield_10015',
    sprintFieldKey: 'customfield_10020',
  }
  try {
    const response = await apiFetch('jira', `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return defaults
    const fields: Array<{ id: string; name: string; schema?: { custom?: string } }> = await response.json()
    const result = { ...defaults }
    for (const f of fields) {
      const custom = f.schema?.custom ?? ''
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-link') result.epicLinkFieldKey = f.id
      if (custom === 'com.pyxis.greenhopper.jira:gh-epic-label') result.epicNameFieldKey = f.id
      if (custom === 'com.pyxis.greenhopper.jira:gh-sprint') result.sprintFieldKey = f.id
      if (
        custom === 'com.atlassian.jira.plugin.system.customfieldtypes:float' &&
        (f.name === 'Story Points' || f.name === 'story_points')
      ) result.storyPointsFieldKey = f.id
      if (f.id === 'customfield_10028') result.storyPointsFieldKey = f.id
    }
    return result
  } catch {
    return defaults
  }
}

export async function fetchIssueDetail(
  baseUrl: string,
  token: string,
  issueKey: string,
  customFields: { epicLinkFieldKey: string; epicNameFieldKey: string; sprintFieldKey: string; storyPointsFieldKey: string },
): Promise<JiraIssueDetail> {
  const base = baseUrl.replace(/\/$/, '')
  const fields = [
    'summary', 'status', 'assignee', 'reporter', 'priority', 'issuetype',
    'description', 'comment', 'issuelinks', 'subtasks', 'labels',
    'fixVersions', 'parent', 'timetracking', 'created', 'updated', 'duedate',
    customFields.epicLinkFieldKey,
    customFields.epicNameFieldKey,
    customFields.sprintFieldKey,
    customFields.storyPointsFieldKey,
  ].join(',')
  const url = `${base}/rest/api/2/issue/${issueKey}?fields=${fields}`
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`Failed to fetch issue ${issueKey}: ${response.status}`)
  return response.json() as Promise<JiraIssueDetail>
}

export async function updateIssueField(
  baseUrl: string,
  token: string,
  issueKey: string,
  fieldName: string,
  value: unknown,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}`
  const response = await apiFetch('jira', url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [fieldName]: value } }),
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to update ${fieldName} on ${issueKey}: ${response.status}`)
  }
}

// ─── Phase 10: Sprint Board Redesign ─────────────────────────────────────────

export interface JiraProjectStatus {
  id: string
  name: string
  statusCategory: { key: 'new' | 'indeterminate' | 'done' | string }
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
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/project/${projectKey}/statuses`
  const response = await apiFetch('jira', url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch project statuses: ${response.status}`)
  }
  const data: Array<{ statuses: JiraProjectStatus[] }> = await response.json()
  const seen = new Set<string>()
  const result: JiraProjectStatus[] = []
  for (const issueType of data) {
    for (const status of issueType.statuses) {
      if (!seen.has(status.id)) {
        seen.add(status.id)
        result.push(status)
      }
    }
  }
  return result
}

// ─── Phase 11: Create/Edit Issue Form ─────────────────────────────────────────

/**
 * Field descriptor returned by the createmeta endpoints.
 * Returned by both the Jira 8.4+ paginated endpoint and the legacy flat endpoint.
 */
export interface CreatemetaField {
  fieldId: string
  name: string
  required: boolean
  autoCompleteUrl?: string
  schema: {
    type: string
    items?: string
    system?: string
    custom?: string
    allowedValues?: Array<{ id: string; value: string }>
  }
}

/**
 * Issue link type descriptor returned by GET /rest/api/2/issueLinkType.
 */
export interface IssueLinkType {
  id: string
  name: string
  inward: string
  outward: string
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
    issuetype?: string           // 'Story' | 'Subtask' | 'Bug' — defaults to 'Story' if omitted
    description?: string         // wiki markup string (DC always; never ADF)
    assignee?: { name: string }  // DC format — NOT { accountId }
    priority?: { name: string }
    parent?: { key: string }     // required for Subtasks
    [fieldKey: string]: unknown  // dynamic custom fields (storyPoints, epicLink, account, etc.)
  },
): Promise<{ id: string; key: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue`

  // Base required fields
  const baseFields: Record<string, unknown> = {
    project: { key: projectKey },
    summary,
    issuetype: { name: options?.issuetype ?? 'Story' },
  }

  // Merge in optional fields, filtering out undefined values
  if (options) {
    const { issuetype, ...rest } = options
    void issuetype // consumed above via options?.issuetype
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) {
        baseFields[k] = v
      }
    }
  }

  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: baseFields }),
  })
  if (!response.ok) {
    throw new Error(`Failed to create issue: ${response.status}`)
  }
  return response.json() as Promise<{ id: string; key: string }>
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
  if (field.schema.type === 'user' || field.schema.items === 'user') return { name: value }
  // autoCompleteUrl fields that return id-based items (accounts, versions, components…)
  if (field.autoCompleteUrl && field.schema.type !== 'string') return { id: value }
  return value
}

/**
 * Derive an autoCompleteUrl for fields that the API doesn't provide one for.
 * Maps known plugin schema.custom patterns to their REST search endpoints.
 * Extend this map as new field types are encountered.
 */
function deriveAutoCompleteUrl(field: CreatemetaField, base: string): string | undefined {
  if (field.autoCompleteUrl) return field.autoCompleteUrl
  const custom = field.schema.custom ?? ''
  if (custom.includes('tempo-accounts')) return `${base}/rest/tempo-accounts/1/account/search?query=`
  return undefined
}

export async function fetchCreatemeta(
  baseUrl: string,
  token: string,
  projectKey: string,
  issueTypeId: string,
  issueTypeName: string,
): Promise<CreatemetaField[]> {
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}` }

  const enrich = (fields: CreatemetaField[]) =>
    fields.map((f) => ({ ...f, autoCompleteUrl: deriveAutoCompleteUrl(f, base) }))

  // Strategy A: Jira 8.4+ paginated endpoint
  const newEndpoint = `${base}/rest/api/2/issue/createmeta/${projectKey}/issuetypes/${issueTypeId}?maxResults=50`
  const resp = await apiFetch('jira', newEndpoint, { headers })
  if (resp.ok) {
    const data = await resp.json()
    return enrich((data.values ?? []) as CreatemetaField[])
  }

  // Strategy B: Legacy flat endpoint (pre-8.4 or 9.0+ with re-enabled flag)
  const legacyUrl = `${base}/rest/api/2/issue/createmeta?projectKeys=${projectKey}&issuetypeNames=${encodeURIComponent(issueTypeName)}&expand=projects.issuetypes.fields`
  const legacyResp = await apiFetch('jira', legacyUrl, { headers })
  if (!legacyResp.ok) return []
  const legacyData = await legacyResp.json()
  const fields = legacyData.projects?.[0]?.issuetypes?.[0]?.fields
  if (!fields) return []
  return enrich(Object.values(fields) as CreatemetaField[])
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
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLinkType`
  const resp = await apiFetch('jira', url, { headers: { Authorization: `Bearer ${token}` } })
  if (!resp.ok) return []
  const data = await resp.json()
  return data.issueLinkTypes ?? []
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
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issueLink`
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: { id: linkTypeId },
      inwardIssue: { key: inwardKey },
      outwardIssue: { key: outwardKey },
    }),
  })
  if (!response.ok && response.status !== 201) {
    throw new Error(`Failed to create issue link: ${response.status}`)
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
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}`
  const response = await apiFetch('jira', url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({}))
    throw new Error(
      (body as { errorMessages?: string[] }).errorMessages?.[0]
        ?? `Failed to update ${issueKey}: ${response.status}`,
    )
  }
}

// ─── Phase 12: Backlog View ───────────────────────────────────────────────────

/**
 * Fetch all backlog issues for a Jira project.
 *
 * Uses compound JQL to retrieve issues that are not in any open or future sprint:
 *   project = {projectKey} AND (sprint is EMPTY OR sprint not in (openSprints(), futureSprints()))
 *   AND issuetype not in subtaskIssueTypes() ORDER BY created DESC
 *
 * Delegates pagination to the private fetchAllSearchPages helper.
 * On 400 response (e.g. Jira Software license not active), throws a user-friendly error.
 *
 * @param baseUrl             - Jira base URL (e.g. "https://jira.example.com")
 * @param token               - Personal Access Token
 * @param projectKey          - Jira project key (e.g. "PROJ")
 * @param storyPointsFieldKey - Custom field ID for story points (default: customfield_10016)
 * @param epicLinkFieldKey    - Custom field ID for epic link (default: customfield_10014)
 * @param epicNameFieldKey    - Custom field ID for epic name (default: customfield_10015)
 * @returns Array of JiraIssue (parent/story level only — no subtasks)
 * @throws Error('Backlog query unavailable — ensure Jira Software license is active for this project') on 400
 */
export async function fetchBacklogIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Deduplicate fields (custom keys may overlap with defaults)
  const fields = [
    ...new Set([
      'summary', 'status', 'assignee', 'issuetype', 'labels',
      'customfield_10016', 'customfield_10014', 'customfield_10015',
      storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey,
    ]),
  ].join(',')

  const jql = encodeURIComponent(
    `project = ${projectKey} AND (sprint is EMPTY OR sprint not in (openSprints(), futureSprints())) AND issuetype not in subtaskIssueTypes() ORDER BY created DESC`,
  )
  const baseSearchUrl = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`

  try {
    return await fetchAllSearchPages(baseSearchUrl, headers)
  } catch (err) {
    // fetchAllSearchPages throws the raw Response on first-page failure (duck-typed by status)
    if (err !== null && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
      const errObj = err as unknown as { status: number; text?: () => Promise<string> }
      const status = errObj.status
      if (status === 400) {
        throw new Error('Backlog query unavailable — ensure Jira Software license is active for this project')
      }
      throw new Error(`Jira search failed with status ${status}`)
    }
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`)
  }
}

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
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  try {
    const res = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`,
      { headers },
    )
    if (!res.ok) return []
    const data = await res.json()
    const sprints: JiraActiveSprint[] = data?.values ?? []
    // Sort: active first, then future by startDate ascending
    return sprints.sort((a, b) => {
      if (a.state === 'active' && b.state !== 'active') return -1
      if (b.state === 'active' && a.state !== 'active') return 1
      const aDate = a.startDate ?? ''
      const bDate = b.startDate ?? ''
      return aDate < bDate ? -1 : aDate > bDate ? 1 : 0
    })
  } catch {
    return []
  }
}

export interface BacklogViewData {
  sprints: Array<{ sprint: JiraActiveSprint; issues: JiraIssue[] }>
  backlog: JiraIssue[]
  epicNames: Map<string, string> // epicKey → epic summary (display name)
}

/**
 * Fetch the full backlog view: active sprint, future sprints, and unassigned backlog.
 *
 * Strategy:
 * 1. Discover the scrum board for the project.
 * 2. Fetch active + future sprints from that board.
 * 3. Fetch issues for each sprint in parallel (JQL: sprint = {id} AND issuetype != Sub-task).
 * 4. Fetch unassigned backlog issues (sprint is EMPTY AND issuetype != Sub-task).
 *
 * On board/sprint discovery failure the sprints array is empty and only the backlog
 * section is populated. On individual sprint issue fetch failure that sprint shows
 * zero issues (never throws).
 *
 * @param baseUrl             - Jira base URL
 * @param token               - Personal Access Token
 * @param projectKey          - Jira project key (e.g. "PROJ")
 * @param storyPointsFieldKey - Custom field ID for story points
 * @param epicLinkFieldKey    - Custom field ID for epic link
 * @param epicNameFieldKey    - Custom field ID for epic name
 * @returns BacklogViewData with sprints (ordered active-first, then future) and backlog
 */
export async function fetchBacklogView(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<BacklogViewData> {
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const issueFields = [
    ...new Set([
      'summary', 'status', 'assignee', 'issuetype', 'labels',
      'customfield_10016', 'customfield_10014', 'customfield_10015',
      storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey,
    ]),
  ].join(',')

  // The Agile board issue API returns fields.sprint as a proper object —
  // no custom field key guessing needed (customfield_10020 varies by instance).
  const agileFields = `${issueFields},sprint`

  // Parse fields.sprint from Agile API response (single object, not an array)
  function parseSprintFromIssue(issue: JiraIssue): JiraActiveSprint | null {
    const s = (issue.fields as Record<string, unknown>)['sprint']
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null
    const sprint = s as Record<string, unknown>
    if (typeof sprint.id !== 'number') return null
    return {
      id: sprint.id,
      name: String(sprint.name ?? ''),
      state: String(sprint.state ?? '').toLowerCase() as 'active' | 'future' | 'closed',
      startDate: typeof sprint.startDate === 'string' ? sprint.startDate : undefined,
      endDate: typeof sprint.endDate === 'string' ? sprint.endDate : undefined,
      originBoardId: typeof sprint.originBoardId === 'number' ? sprint.originBoardId : undefined,
    }
  }

  // Group issues by sprint, preserving rank order
  function groupBySprint(
    issues: JiraIssue[],
  ): Array<{ sprint: JiraActiveSprint; issues: JiraIssue[] }> {
    const map = new Map<number, { sprint: JiraActiveSprint; issues: JiraIssue[] }>()
    for (const issue of issues) {
      const sprint = parseSprintFromIssue(issue)
      if (!sprint) continue
      if (!map.has(sprint.id)) map.set(sprint.id, { sprint, issues: [] })
      map.get(sprint.id)!.issues.push(issue)
    }
    return Array.from(map.values())
  }

  // Step 1: Discover board (needed for Agile API endpoint)
  let boardId: number | null = null
  try {
    const boardRes = await apiFetch(
      'jira',
      `${base}/rest/agile/1.0/board?projectKeyOrId=${projectKey}&type=scrum`,
      { headers },
    )
    if (boardRes.ok) {
      const boardData = await boardRes.json()
      boardId = boardData?.values?.[0]?.id ?? null
    }
  } catch { /* boardId stays null */ }

  // Step 2: Fetch active + future sprint issues via Agile board endpoint.
  // /rest/agile/1.0/board/{id}/issue returns fields.sprint as a reliable object,
  // and openSprints()/futureSprints() JQL functions scope results to this project only.
  let sprints: Array<{ sprint: JiraActiveSprint; issues: JiraIssue[] }> = []
  if (boardId !== null) {
    const activeJql = encodeURIComponent(
      `project = ${projectKey} AND sprint in openSprints() AND issuetype != Sub-task ORDER BY rank ASC`,
    )
    const futureJql = encodeURIComponent(
      `project = ${projectKey} AND sprint in futureSprints() AND issuetype != Sub-task ORDER BY rank ASC`,
    )
    const agileBase = `${base}/rest/agile/1.0/board/${boardId}/issue`
    const [activeIssues, futureIssues] = await Promise.all([
      fetchAllSearchPages(`${agileBase}?jql=${activeJql}&fields=${agileFields}`, headers)
        .catch(() => [] as JiraIssue[]),
      fetchAllSearchPages(`${agileBase}?jql=${futureJql}&fields=${agileFields}`, headers)
        .catch(() => [] as JiraIssue[]),
    ])
    const activeSprints = groupBySprint(activeIssues)
    const futureSprints = groupBySprint(futureIssues)

    // Determine the project's canonical board from the active sprint's originBoardId.
    // The discovered boardId may be wrong (e.g. "Copy of X" instead of "X").
    // originBoardId on the active sprint reliably identifies which board owns these sprints.
    const projectBoardId = activeSprints[0]?.sprint.originBoardId
      ?? futureSprints[0]?.sprint.originBoardId

    const filterByBoard = (groups: typeof activeSprints) =>
      projectBoardId !== undefined
        ? groups.filter(g => g.sprint.originBoardId === projectBoardId)
        : groups

    sprints = [...filterByBoard(activeSprints), ...filterByBoard(futureSprints)]
  }

  // Step 3: Fetch backlog (unassigned to any sprint) via regular search API
  const backlogJql = encodeURIComponent(
    `project = ${projectKey} AND sprint is EMPTY AND issuetype != Sub-task ORDER BY rank ASC`,
  )
  const backlog = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${backlogJql}&fields=${issueFields}`,
    headers,
  ).catch(() => [] as JiraIssue[])

  // Step 4: Batch-fetch epic names from the epic issues themselves.
  // customfield_10015 (epic name) is often null on Jira Server — the epic's
  // own summary field is the authoritative display name.
  const allIssues = [...sprints.flatMap(s => s.issues), ...backlog]
  const epicKeys = new Set(
    allIssues
      .map(i => i.fields[epicLinkFieldKey] as string | null)
      .filter((k): k is string => !!k),
  )
  const epicNames = new Map<string, string>()
  if (epicKeys.size > 0) {
    const epicJql = encodeURIComponent(`issuekey in (${Array.from(epicKeys).join(',')})`)
    const epicIssues = await fetchAllSearchPages(
      `${base}/rest/api/2/search?jql=${epicJql}&fields=summary`,
      headers,
    ).catch(() => [] as JiraIssue[])
    for (const epic of epicIssues) {
      epicNames.set(epic.key, epic.fields.summary)
    }
  }

  return { sprints, backlog, epicNames }
}

/**
 * Move a set of issues into a sprint via the Jira Agile REST API.
 *
 * POSTs to POST /rest/agile/1.0/sprint/{sprintId}/issue with body { issues: issueKeys }.
 * Jira returns 204 No Content on success — treated as success.
 * Throws Error on any other non-ok response.
 *
 * @param baseUrl   - Jira base URL (e.g. "https://jira.example.com")
 * @param token     - Personal Access Token
 * @param sprintId  - Numeric sprint ID (JiraActiveSprint.id)
 * @param issueKeys - Array of issue keys to add (e.g. ["PROJ-1", "PROJ-2"])
 * @throws Error with status code on non-ok, non-204 response
 */
export async function addIssuesToSprint(
  baseUrl: string,
  token: string,
  sprintId: number,
  issueKeys: string[],
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/agile/1.0/sprint/${sprintId}/issue`
  const response = await apiFetch('jira', url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ issues: issueKeys }),
  })
  // 204 No Content is the expected success response for this endpoint
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to add issues to sprint: ${response.status}`)
  }
}

// ---------------------------------------------------------------------------
// Phase 13 — Epic Management
// ---------------------------------------------------------------------------

export interface EpicEnriched {
  key: string
  epicName: string
  summary: string
  status: JiraIssue['fields']['status']
  assignee: JiraIssue['fields']['assignee']
  totalStories: number
  doneStories: number
  totalPoints: number
}

/**
 * Fetch all epics in a project without story enrichment — fast first-load.
 */
export async function fetchEpicsBasic(
  baseUrl: string,
  token: string,
  projectKey: string,
  epicNameFieldKey = 'customfield_10015',
): Promise<EpicEnriched[]> {
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const epicFields = [...new Set(['summary', 'status', 'assignee', epicNameFieldKey])].join(',')
  const epicJql = encodeURIComponent(`project = ${projectKey} AND issuetype = Epic ORDER BY updated DESC`)
  const epicIssues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${epicJql}&fields=${epicFields}`, headers,
  )
  return epicIssues.map(epic => ({
    key: epic.key,
    epicName: (epic.fields[epicNameFieldKey] as string | null) ?? epic.fields.summary,
    summary: epic.fields.summary,
    status: epic.fields.status,
    assignee: epic.fields.assignee,
    totalStories: 0,
    doneStories: 0,
    totalPoints: 0,
  }))
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
  if (epicKeys.length === 0) return new Map()
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const storyFields = [...new Set(['status', storyPointsFieldKey, epicLinkFieldKey, 'customfield_10016'])].join(',')
  const storiesJql = encodeURIComponent(
    `"Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`,
  )
  const stories = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${storiesJql}&fields=${storyFields}`, headers,
  ).catch(() => [] as JiraIssue[])

  const countMap = new Map<string, { total: number; done: number; points: number }>()
  for (const story of stories) {
    const ek = story.fields[epicLinkFieldKey] as string | null
    if (!ek) continue
    const entry = countMap.get(ek) ?? { total: 0, done: 0, points: 0 }
    entry.total++
    if (story.fields.status.statusCategory?.key === 'done') entry.done++
    entry.points += (story.fields[storyPointsFieldKey] as number | null) ?? 0
    countMap.set(ek, entry)
  }
  return countMap
}

/**
 * Fetch all epics in a project and enrich them with child story counts and points.
 *
 * Two-query pattern (mirrors fetchBacklogView):
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
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Step 1: fetch epics
  const epicFields = [...new Set([
    'summary', 'status', 'assignee', 'priority', 'description', 'created', 'updated',
    epicNameFieldKey,
  ])].join(',')
  const epicJql = encodeURIComponent(`project = ${projectKey} AND issuetype = Epic ORDER BY updated DESC`)
  const epicIssues = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${epicJql}&fields=${epicFields}`, headers,
  )
  if (epicIssues.length === 0) return []

  // Step 2: batch-fetch child stories (exclude subtasks)
  const epicKeys = epicIssues.map(e => e.key)
  const storyFields = [...new Set(['status', storyPointsFieldKey, epicLinkFieldKey, 'customfield_10016'])].join(',')
  const storiesJql = encodeURIComponent(
    `"Epic Link" in (${epicKeys.join(',')}) AND issuetype != Sub-task`,
  )
  const stories = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${storiesJql}&fields=${storyFields}`, headers,
  ).catch(() => [] as JiraIssue[])

  // Step 3: aggregate per epic
  const countMap = new Map<string, { total: number; done: number; points: number }>()
  for (const story of stories) {
    const ek = story.fields[epicLinkFieldKey] as string | null
    if (!ek) continue
    const entry = countMap.get(ek) ?? { total: 0, done: 0, points: 0 }
    entry.total++
    if (story.fields.status.statusCategory?.key === 'done') entry.done++
    entry.points += (story.fields[storyPointsFieldKey] as number | null) ?? 0
    countMap.set(ek, entry)
  }

  return epicIssues.map(epic => {
    const counts = countMap.get(epic.key) ?? { total: 0, done: 0, points: 0 }
    return {
      key: epic.key,
      epicName: (epic.fields[epicNameFieldKey] as string | null) ?? epic.fields.summary,
      summary: epic.fields.summary,
      status: epic.fields.status,
      assignee: epic.fields.assignee,
      totalStories: counts.total,
      doneStories: counts.done,
      totalPoints: counts.points,
    }
  })
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
  const base = baseUrl.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const fields = [...new Set([
    'summary', 'status', 'assignee', 'issuetype', storyPointsFieldKey, 'customfield_10016',
  ])].join(',')
  const jql = encodeURIComponent(
    `"Epic Link" = ${epicKey} AND issuetype != Sub-task ORDER BY rank ASC`,
  )
  return fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`, headers,
  ).catch(() => [] as JiraIssue[])
}
