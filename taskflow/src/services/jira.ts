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
      const status = (err as { status: number; text?: () => Promise<string> }).status;
      if (status === 400) {
        const body = typeof (err as { text?: () => Promise<string> }).text === 'function'
          ? await (err as { text: () => Promise<string> }).text()
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
      const status = (err as { status: number; text?: () => Promise<string> }).status;
      if (status === 400) {
        const body = typeof (err as { text?: () => Promise<string> }).text === 'function'
          ? await (err as { text: () => Promise<string> }).text()
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

export async function discoverStoryPointsField(
  baseUrl: string,
  token: string,
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/field`;
  try {
    const response = await apiFetch('jira', url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) return 'customfield_10016';
    const fields: Array<{ id: string; name: string }> = await response.json();
    const match = fields.find(
      (f) =>
        f.name === 'Story Points' ||
        f.name === 'story_points' ||
        f.id === 'customfield_10028',
    );
    return match?.id ?? 'customfield_10016';
  } catch {
    return 'customfield_10016';
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

