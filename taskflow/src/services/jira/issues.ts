/**
 * Jira issue CRUD and search operations.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import { fetchAllSearchPages, isResponseLikeError, SUBTASK_CHUNK_SIZE } from './client';
import type { CreatemetaField, JiraIssue, JiraIssueDetail } from './types';

/**
 * Fetch only parent (non-subtask) issues in the active sprint for a project.
 *
 * Uses fetchAllSearchPages for full pagination safety (D-10). Returns stories,
 * tasks, bugs, and epics — never subtasks. The second half of the old
 * fetchSprintIssues two-query strategy is now a separate fetchSprintSubtasks call.
 *
 * @param baseUrl            - Jira base URL
 * @param token              - Personal Access Token
 * @param projectKey         - Jira project key (e.g. "PROJ")
 * @param assignedToMe       - If true, adds `AND assignee = currentUser()`
 * @param storyPointsFieldKey - Custom field key for story points
 * @param epicLinkFieldKey    - Custom field key for epic link
 * @throws Error('Sprint filtering unavailable -- ensure Jira Software is installed') on 400 with sprint errors
 */
export async function fetchSprintStories(
  baseUrl: string,
  token: string,
  projectKey: string,
  assignedToMe = false,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const assigneeClause = assignedToMe ? ' AND assignee = currentUser()' : '';
  const spFields = [
    ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  ].join(',');
  const fields = `summary,status,assignee,issuetype,labels,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking`;
  const jql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints()${assigneeClause} AND issuetype not in subtaskIssueTypes() ORDER BY rank ASC`,
  );
  const baseSearchUrl = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`;

  try {
    return await fetchAllSearchPages(baseSearchUrl, headers);
  } catch (err) {
    if (err instanceof ApiError) throw err;
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
}

/**
 * Fetch subtasks for a set of parent issue keys, chunked by SUBTASK_CHUNK_SIZE.
 *
 * Fires all chunk queries in parallel via Promise.all. Individual chunk failures
 * are caught silently (returns [] for that chunk) -- callers receive partial results
 * rather than an error. Returns empty array immediately when parentKeys is empty.
 *
 * @param baseUrl      - Jira base URL
 * @param token        - Personal Access Token
 * @param parentKeys   - Array of parent issue keys to fetch subtasks for
 * @param assignedToMe - If true, adds `AND assignee = currentUser()`
 */
export async function fetchSprintSubtasks(
  baseUrl: string,
  token: string,
  parentKeys: string[],
  assignedToMe = false,
): Promise<JiraIssue[]> {
  if (parentKeys.length === 0) return [];

  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const assigneeClause = assignedToMe ? ' AND assignee = currentUser()' : '';
  const subtaskFields = 'summary,status,assignee,issuetype,parent,timetracking';

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
  return chunkResults.flat();
}

/**
 * Fetch issues in the active sprint for a project.
 *
 * Uses a two-query strategy: first query fetches parent issues (Jira DC's
 * `sprint in openSprints()` intentionally excludes subtasks), second query
 * fetches subtasks for those parents in chunks of 50 keys.
 *
 * Both queries are fully paginated -- all pages are fetched until total is
 * exhausted, so sprints with >200 issues or chunks with >200 subtasks are
 * handled correctly.
 *
 * On any failure of the second (subtask) query, parent issues are returned
 * alone -- callers never observe an error from subtask fetching.
 *
 * @deprecated Use fetchSprintStories + fetchSprintSubtasks for independent parallel queries.
 * @param baseUrl      - Jira base URL
 * @param token        - Personal Access Token
 * @param projectKey   - Jira project key (e.g. "PROJ")
 * @param assignedToMe - If true, adds `AND assignee = currentUser()` (my-tasks variant).
 *                       If false/omitted, returns all sprint issues (sprint-board variant).
 * @throws Error('Sprint filtering unavailable -- ensure Jira Software is installed') on 400 with sprint errors
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
  const fields = `summary,status,assignee,issuetype,labels,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking`;
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
    // failure. Detect by checking for a numeric status property (duck-typing for both real
    // Response objects and plain-object mocks used in tests).
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
  const spFields = [
    ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  ].join(',');
  const fields = `summary,status,assignee,issuetype,${spFields},parent,subtasks,timetracking`;
  const subtaskFields = 'summary,status,assignee,issuetype,parent,timetracking';

  // Step 1: my stories + my subtasks in parallel -- both fully paginated
  const myStoriesJql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints() AND issuetype not in subtaskIssueTypes() AND assignee = currentUser() ORDER BY rank ASC`,
  );
  // Note: sprint in openSprints() does not work for subtasks on Jira DC -- use statusCategory filter instead.
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
    // failure. Detect by checking for a numeric status property (duck-typing for both real
    // Response objects and plain-object mocks used in tests).
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

  // Step 3: fetch additional parent stories (if any) -- sprint-scoped so old-sprint parents are excluded
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

  // Step 4: fetch ALL subtasks for every parent (no assignee filter) -- fully paginated per chunk
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
 * Fetch detailed information for a single Jira issue.
 */
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
    'issuetype',
    'description',
    'comment',
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
    customFields.epicLinkFieldKey,
    customFields.epicNameFieldKey,
    customFields.sprintFieldKey,
    customFields.storyPointsFieldKey,
    customFields.epicColorFieldKey,
  ]
    .filter(Boolean)
    .join(',');
  const url = `${base}/rest/api/2/issue/${issueKey}?fields=${fields}&expand=changelog`;
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
  return response.json() as Promise<JiraIssueDetail>;
}

/**
 * Lightweight issue fetch -- returns only summary + issuetype for pinned tab
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
 * Update a single field on a Jira issue.
 */
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

/**
 * Create a new Jira issue with optional full field set (Phase 11 extended version).
 *
 * Backward-compatible: existing callers that pass only (baseUrl, token, projectKey, summary)
 * continue to work -- the options parameter is optional and defaults to Story type.
 *
 * The submit body is filtered to only include fields that are explicitly defined
 * (i.e. not undefined) to avoid "field not on screen" 400 errors from Jira.
 *
 * CRITICAL: Never send ADF for description -- DC REST API accepts wiki markup strings only.
 * CRITICAL: Assignee uses DC format { name: username }, NOT { accountId } (Cloud-only).
 */
export async function createIssue(
  baseUrl: string,
  token: string,
  projectKey: string,
  summary: string,
  options?: {
    issuetype?: string; // 'Story' | 'Subtask' | 'Bug' -- defaults to 'Story' if omitted
    description?: string; // wiki markup string (DC always; never ADF)
    assignee?: { name: string }; // DC format -- NOT { accountId }
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
    issuetype: { name: options?.issuetype ?? 'Story' },
  };

  // Merge in optional fields, filtering out undefined values
  if (options) {
    const { issuetype, ...rest } = options;
    void issuetype; // consumed above via options?.issuetype
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
 * Update multiple fields on a Jira issue in a single PUT request.
 *
 * Prefer this over calling updateIssueField() multiple times for edit mode.
 * The fields object should only include fields confirmed present on screen
 * (via createmeta) to avoid "field not on screen" 400 errors.
 *
 * Jira DC returns 204 on success (not 200) -- both are treated as success.
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
  // autoCompleteUrl fields that return id-based items (accounts, versions, components...)
  if (field.autoCompleteUrl && field.schema.type !== 'string') return { id: value };
  return value;
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
  const jql = `project = ${projectKey} AND statusCategory = Done AND summary ~ "${query.replace(/"/g, '\\"')}" ORDER BY updated DESC`;
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
