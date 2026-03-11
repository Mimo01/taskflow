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
import { fetch } from '@tauri-apps/plugin-http';

export interface JiraUser {
  displayName: string;
  emailAddress: string;
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
    response = await fetch(url, {
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
    return { displayName: data.displayName, emailAddress: data.emailAddress };
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
    response = await fetch(url, {
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
    issuetype: { name: string };
    description?: string | null;
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

/**
 * Fetch issues in the active sprint for a project.
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
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const assigneeClause = assignedToMe ? ' AND assignee = currentUser()' : '';
  const jql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints()${assigneeClause} AND resolution = Unresolved ORDER BY updated DESC`,
  );
  const fields = 'summary,status,assignee,issuetype,customfield_10016,story_points';
  const url = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.status === 400) {
    const body = await response.text();
    if (body.includes('function') || body.includes('not recognized')) {
      throw new Error('Sprint filtering unavailable — ensure Jira Software is installed');
    }
    throw new Error(`Jira search failed with status 400`);
  }

  if (!response.ok) {
    throw new Error(`Jira search failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.issues as JiraIssue[];
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
    response = await fetch(url, {
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
    response = await fetch(url, {
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
    response = await fetch(url, {
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
  const url = `${base}/rest/api/2/version?projectKey=${projectKey}&maxResults=50`;

  let response: Response;
  try {
    response = await fetch(url, {
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
  // GET /rest/api/2/version returns a paginated envelope { values: [...], total, ... }
  // not a bare array — extract the inner array defensively
  return (data.values ?? []) as JiraFixVersion[];
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
    response = await fetch(url, {
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
