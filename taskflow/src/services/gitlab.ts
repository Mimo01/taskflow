/**
 * GitLab REST API service — PAT validation and group listing.
 *
 * AUTH HEADER:
 * GitLab uses the PRIVATE-TOKEN header for PAT authentication (not Authorization: Bearer).
 * This is GitLab's standard across all editions (CE, EE, SaaS, self-hosted).
 * Ref: https://docs.gitlab.com/ee/api/rest/authentication.html
 *
 * All HTTP calls use `fetch` from `@tauri-apps/plugin-http` to bypass CORS
 * in the Tauri 2 webview (plain fetch triggers preflight failures on GitLab).
 *
 * IMPORTANT: This module does NOT store secrets. Callers are responsible for
 * calling storeSecret('gitlab-pat', token) after successful validation.
 */

import { ApiError } from '../lib/api-error';
import { apiFetch } from '../lib/apiFetch';

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  /** Account primary email from GET /api/v4/user; null when scope/visibility hides it. */
  email: string | null;
}

export interface GitLabGroup {
  id: number;
  name: string;
  full_path: string;
}

export interface GitLabProject {
  id: number;
  name: string;
  name_with_namespace: string;
  path_with_namespace: string;
  default_branch: string;
}

/**
 * Validate a GitLab PAT by calling GET /api/v4/user.
 *
 * @param baseUrl - GitLab base URL (e.g. "https://gitlab.example.com")
 * @param token   - Personal Access Token
 * @returns Resolved user info on success
 * @throws Exact error strings per locked UX decisions in CONTEXT.md
 */
export async function validateGitLab(baseUrl: string, token: string): Promise<GitLabUser> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/user`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Validate Connection',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (
      msg.includes('certificate') ||
      msg.includes('ssl') ||
      msg.includes('tls') ||
      msg.includes('cert')
    ) {
      throw new Error(
        `SSL certificate error connecting to ${baseUrl} — the server's CA certificate may not be trusted on this machine. Install the server CA certificate in System Keychain and relaunch the app.`,
      );
    }
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return { id: data.id, name: data.name, username: data.username, email: data.email ?? null };
  }

  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'gitlab');
  }

  if (response.status === 403) {
    throw new ApiError('Token valid but lacks required permissions', 403, 'gitlab');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

/**
 * Search GitLab users by name/username — used to resolve a watched person's
 * full GitLab identity (id, username, email) from their Jira display name.
 * Returns up to 100 candidates (GitLab's max per_page); callers are responsible
 * for filtering to exact-name matches so common names don't pull in unrelated people.
 */
export async function fetchGitLabUsers(
  baseUrl: string,
  token: string,
  search: string,
): Promise<GitLabUser[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/users?search=${encodeURIComponent(search)}&per_page=100`;
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
      'Search GitLab Users',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to search users', response.status, 'gitlab');
    }
    throw new Error(`Failed to search users: status ${response.status}`);
  }
  const data = (await response.json()) as Array<{
    id: number;
    name: string;
    username: string;
    email?: string | null;
  }>;
  return data.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email ?? null,
  }));
}

/**
 * List all GitLab groups visible to the authenticated user.
 *
 * @param baseUrl - GitLab base URL
 * @param token   - Personal Access Token (already validated)
 * @returns Array of groups with id, name, and full_path
 */
export async function listGitLabGroups(baseUrl: string, token: string): Promise<GitLabGroup[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/groups`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Groups',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return data as GitLabGroup[];
  }

  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'gitlab');
  }

  if (response.status === 403) {
    throw new ApiError('Token valid but lacks required permissions', 403, 'gitlab');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

/**
 * List all GitLab projects accessible to the authenticated user.
 *
 * @param baseUrl - GitLab base URL
 * @param token   - Personal Access Token (already validated)
 * @returns Array of projects sorted by last activity (most recent first)
 */
export async function listGitLabProjects(baseUrl: string, token: string): Promise<GitLabProject[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at&sort=desc`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
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
    return data as GitLabProject[];
  }

  if (response.status === 401) {
    throw new ApiError('Invalid token or token has expired', 401, 'gitlab');
  }

  if (response.status === 403) {
    throw new ApiError('Token valid but lacks required permissions', 403, 'gitlab');
  }

  throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
}

/**
 * Fetch a single GitLab project, including its `default_branch` (D-14).
 * Used to resolve the project's actual default branch instead of hardcoding
 * `main` — release branches are created off whatever the project's default is.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @returns The project, including `default_branch`
 */
export async function fetchProject(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabProject> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Project',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new ApiError('Failed to fetch project', response.status, 'gitlab');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch project: status ${response.status}`);
  }

  const data = await response.json();
  return data as GitLabProject;
}

/**
 * Fetch all branches for a project matching `search`, fully paginated (D-18).
 * Used to discover the full `release/`-prefixed branch set — no page cap, since
 * a single capped page plus client-side filtering has already bitten this
 * codebase twice (the fetch-once page-cap trap).
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @param search    - Branch name search term (GitLab substring match)
 * @returns All matching branches across every page
 */
export async function fetchProjectBranches(
  baseUrl: string,
  token: string,
  projectId: number,
  search: string,
): Promise<GitLabBranch[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allBranches: GitLabBranch[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/repository/branches?per_page=${perPage}&page=${page}&search=${encodeURIComponent(search)}`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        {
          headers: {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json',
          },
        },
        'Load Release Branches',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch release branches', response.status, 'gitlab');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch release branches: status ${response.status}`);
    }

    const data = (await response.json()) as GitLabBranch[];
    allBranches.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return allBranches;
}

/**
 * Fetch a project's tags matching `search`, following pagination.
 *
 * Used to surface the artifact of a released version whose release branch has
 * already been merged and deleted. Tags are an INCOMPLETE record — some
 * shipped releases carry no tag — so a caller must treat a miss as "no tag
 * found", never as "not released".
 *
 * Unlike the branch and milestone fetchers this resolves to an empty list on
 * failure instead of throwing: the tag is supplementary evidence decorating an
 * already-known released state, so a tag outage must not escalate into a
 * branch-row error.
 *
 * @param baseUrl - GitLab base URL
 * @param token - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @param search - substring filter passed to GitLab's `search` param
 * @returns matching tags, or an empty list if the lookup fails
 */
export async function searchProjectTags(
  baseUrl: string,
  token: string,
  projectId: number,
  search: string,
): Promise<GitLabTag[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  // Bounded so a paginating server that never shrinks a page cannot spin
  // forever; 20 pages covers 2000 tags, well past any realistic search hit.
  const maxPages = 20;
  const allTags: GitLabTag[] = [];

  try {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${base}/api/v4/projects/${projectId}/repository/tags?per_page=${perPage}&page=${page}&search=${encodeURIComponent(search)}`;
      const response = await apiFetch(
        'gitlab',
        url,
        { headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' } },
        'Load Release Tags',
      );
      if (!response.ok) return allTags;

      const data = (await response.json()) as GitLabTag[];
      allTags.push(...data);
      if (data.length < perPage) break;
    }
  } catch {
    return allTags;
  }

  return allTags;
}

// ─── Phase 2: Developer Dashboard ────────────────────────────────────────────

export interface GitLabMilestone {
  id: number;
  iid: number;
  title: string;
  description: string | null;
  start_date: string | null; // "YYYY-MM-DD" or null
  due_date: string | null; // "YYYY-MM-DD" or null
  state: 'active' | 'closed';
  web_url: string;
  /**
   * Present on ancestor (group-inherited) milestones so callers can filter
   * to own-project milestones locally without a second request (D-07).
   * RESEARCH assumption A3 (their presence) is unverified against the team's
   * live instance, so both are optional — degrade safely when absent.
   */
  project_id?: number | null;
  group_id?: number | null;
}

/**
 * A GitLab repository branch (D-13/D-18 — release branch existence + discovery).
 */
export interface GitLabBranch {
  name: string;
  web_url: string;
  merged: boolean;
  protected: boolean;
  commit: { id: string; short_id: string };
}

export interface GitLabTag {
  name: string;
  commit: { created_at: string }; // ISO 8601 with timezone
  release: { tag_name: string; description: string } | null;
}

export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  source_branch: string;
  /**
   * D-10 / Phase 89 probe (89-PROBE-RESULTS.md): confirmed PRESENT on the
   * GitLab MR *list* endpoint (Assumption A2), not just the detail endpoint.
   * Every drift predicate reads this field from list-endpoint data.
   */
  target_branch: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  /**
   * D-10 / Phase 89 probe (89-PROBE-RESULTS.md): confirmed PRESENT on the
   * list endpoint. Declared for completeness only — must NOT be used to
   * gate drift evaluation. A draft MR's `state` is still `'opened'` and it
   * is fully evaluated by the drift predicates (per D-10).
   */
  draft: boolean;
  author: { id: number; name: string; username: string; avatar_url: string };
  reviewers: Array<{ id: number; name: string; username: string }>;
  updated_at: string; // ISO 8601 UTC
  web_url: string;
  labels: GitLabLabel[]; // label objects with colors
  milestone: { id: number; title: string } | null;
}

export interface GitLabLabel {
  name: string;
  color: string; // hex like "#428BCA"
  text_color: string; // hex like "#FFFFFF"
}

export interface GitLabMRDetail extends Omit<GitLabMR, 'labels' | 'milestone'> {
  description: string | null;
  created_at: string;
  labels: GitLabLabel[]; // normalized from string[] or object[] by fetchMRDetail
  merge_status: string;
  has_conflicts: boolean;
  changes_count: string;
  merged_at: string | null;
  closed_at: string | null;
  pipeline: { id: number; status: string; web_url: string } | null;
  assignee: { id: number; name: string; username: string; avatar_url: string } | null;
  milestone: GitLabMilestone | null;
}

export interface MRCommit {
  id: string;
  title: string;
  message: string;
}

export interface MRApprovals {
  approved_by: Array<{ user: { id: number; name: string } }>;
  approved: boolean;
}

export interface DiscussionNoteAuthor {
  id: number;
  name: string;
  username: string;
  avatar_url: string;
  web_url?: string;
}

export interface DiffPosition {
  old_path: string;
  new_path: string;
  old_line: number | null;
  new_line: number | null;
  position_type: string;
}

export interface DiscussionNote {
  id: number;
  type: 'DiffNote' | 'DiscussionNote' | null;
  body: string;
  author: DiscussionNoteAuthor;
  created_at: string;
  updated_at: string;
  system: boolean;
  resolvable: boolean;
  resolved: boolean;
  resolved_by: DiscussionNoteAuthor | null;
  resolved_at: string | null;
  position: DiffPosition | null;
  confidential: boolean;
  internal: boolean;
}

export interface Discussion {
  id: string;
  individual_note: boolean;
  notes: DiscussionNote[];
}

/**
 * Fetch merge requests assigned to the authenticated user.
 *
 * @param baseUrl - GitLab base URL
 * @param token   - Personal Access Token
 * @returns Array of open MRs assigned to the current user
 */
export async function fetchAssignedMRs(baseUrl: string, token: string): Promise<GitLabMR[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/merge_requests?scope=assigned_to_me&state=opened&per_page=100`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Merge Requests',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch assigned MRs', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch assigned MRs: status ${response.status}`);
  }

  const data = await response.json();
  return data as GitLabMR[];
}

/**
 * Fetch merge requests authored by the given user.
 *
 * @param baseUrl  - GitLab base URL
 * @param token    - Personal Access Token
 * @param userId   - GitLab user ID of the author
 * @returns Array of open MRs authored by the user
 */
export async function fetchAuthoredMRs(
  baseUrl: string,
  token: string,
  userId: number,
): Promise<GitLabMR[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/merge_requests?author_id=${userId}&state=opened&per_page=100`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Merge Requests',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch authored MRs', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch authored MRs: status ${response.status}`);
  }

  const data = await response.json();
  return data as GitLabMR[];
}

/**
 * Fetch merge requests where the given user is a reviewer.
 *
 * @param baseUrl  - GitLab base URL
 * @param token    - Personal Access Token
 * @param userId   - GitLab user ID of the reviewer
 * @returns Array of open MRs where the user is a reviewer
 */
export async function fetchReviewerMRs(
  baseUrl: string,
  token: string,
  userId: number,
): Promise<GitLabMR[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/merge_requests?reviewer_id=${userId}&state=opened&per_page=100`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Merge Requests',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch reviewer MRs', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch reviewer MRs: status ${response.status}`);
  }

  const data = await response.json();
  return data as GitLabMR[];
}

/**
 * Fetch commits for a merge request.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab project ID
 * @param mrIid     - MR internal IID within the project
 * @returns Array of commits in the MR
 */
export async function fetchMRCommits(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
): Promise<MRCommit[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests/${mrIid}/commits`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load MR Detail',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch MR commits', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch MR commits: status ${response.status}`);
  }

  const data = await response.json();
  return data as MRCommit[];
}

/**
 * Fetch approval state for a merge request.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab project ID
 * @param mrIid     - MR internal IID within the project
 * @returns Approval state including who approved
 */
export async function fetchMRApprovals(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
): Promise<MRApprovals> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests/${mrIid}/approvals`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load MR Detail',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch MR approvals', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch MR approvals: status ${response.status}`);
  }

  const data = await response.json();
  return data as MRApprovals;
}

/**
 * Fetch discussions (comments, threads) for a merge request.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab project ID
 * @param mrIid     - MR internal IID within the project
 * @returns Array of discussion threads
 */
export async function fetchMRDiscussions(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
): Promise<Discussion[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allDiscussions: Discussion[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions?per_page=${perPage}&page=${page}`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        {
          headers: {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json',
          },
        },
        'Load MR Detail',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch MR discussions', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch MR discussions: status ${response.status}`);
    }

    const data = (await response.json()) as Discussion[];
    allDiscussions.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return allDiscussions;
}

export interface MRDiffFile {
  old_path: string;
  new_path: string;
  diff: string;
}

/**
 * Fetch MR changes (diffs) for showing code context on discussion diff notes.
 */
export async function fetchMRChanges(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
): Promise<MRDiffFile[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests/${mrIid}/changes`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load MR Changes',
    );
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = await response.json();
  return (data.changes ?? []) as MRDiffFile[];
}

// ─── Phase 4: PM Dashboard & Search ──────────────────────────────────────────

/**
 * Fetch all milestones for a GitLab group.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param groupPath - Group full_path (e.g. "my-org/my-group"), URL-encoded internally
 * @returns Array of group milestones
 */
export async function fetchGroupMilestones(
  baseUrl: string,
  token: string,
  groupPath: string,
): Promise<GitLabMilestone[]> {
  const base = baseUrl.replace(/\/$/, '');
  // include_subgroups=true: also return milestones defined on subgroups within this group
  const url = `${base}/api/v4/groups/${encodeURIComponent(groupPath)}/milestones?per_page=100&include_subgroups=true`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Releases',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch milestones', response.status, 'gitlab');
    }
    throw new Error('Failed to fetch milestones');
  }

  const data = await response.json();
  return data as GitLabMilestone[];
}

/**
 * Fetch all milestones for a GitLab project.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @returns Array of project milestones
 */
export async function fetchProjectMilestones(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabMilestone[]> {
  const base = baseUrl.replace(/\/$/, '');
  // include_ancestors=true: also return milestones inherited from parent groups
  const perPage = 100;
  let page = 1;
  const allMilestones: GitLabMilestone[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/milestones?per_page=${perPage}&page=${page}&include_ancestors=true`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        {
          headers: {
            'PRIVATE-TOKEN': token,
            'Content-Type': 'application/json',
          },
        },
        'Load Releases',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch milestones', response.status, 'gitlab');
      }
      throw new Error('Failed to fetch milestones');
    }

    const data = (await response.json()) as GitLabMilestone[];
    allMilestones.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  return allMilestones;
}

/**
 * Fetch project milestones whose due_date (or start_date) falls within a date range.
 * Fetches all milestones and filters client-side since the GitLab API doesn't support
 * direct date-range filtering on milestones.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @param from      - Start of range, inclusive (YYYY-MM-DD)
 * @param to        - End of range, inclusive (YYYY-MM-DD)
 * @returns Array of milestones with due_date or start_date within the range
 */
/**
 * Filter milestones to an inclusive `from`..`to` date range, keyed on
 * `due_date` with a `start_date` fallback. Undated milestones are excluded.
 *
 * Exported so callers that already hold the full milestone list can apply the
 * same windowing client-side instead of re-running the paginated fetch.
 *
 * @param milestones - candidate milestones
 * @param from - inclusive lower bound, ISO `YYYY-MM-DD`
 * @param to - inclusive upper bound, ISO `YYYY-MM-DD`
 * @returns milestones whose date falls within the range
 */
export function filterMilestonesToRange<
  T extends { due_date?: string | null; start_date?: string | null },
>(milestones: readonly T[], from: string, to: string): T[] {
  return milestones.filter((m) => {
    const date = m.due_date ?? m.start_date;
    if (!date) return false;
    return date >= from && date <= to;
  });
}

export async function fetchProjectMilestonesInRange(
  baseUrl: string,
  token: string,
  projectId: number,
  from: string,
  to: string,
): Promise<GitLabMilestone[]> {
  const all = await fetchProjectMilestones(baseUrl, token, projectId);
  return filterMilestonesToRange(all, from, to);
}

/**
 * Update a GitLab project milestone's title and/or description.
 *
 * Sends `PUT /api/v4/projects/:id/milestones/:milestone_id`. The path param is the
 * milestone's numeric `id` (GitLabMilestone.id), NOT the project-scoped `iid`.
 * Only the provided fields are sent — an empty `description: ''` clears the field,
 * while omitting a field leaves it untouched.
 *
 * @param baseUrl     - GitLab base URL
 * @param token       - Personal Access Token
 * @param projectId   - GitLab numeric project ID
 * @param milestoneId - Milestone numeric `id` (NOT `iid`)
 * @param fields      - Subset of { title, description } to update
 * @returns The updated milestone
 */
export async function updateMilestone(
  baseUrl: string,
  token: string,
  projectId: number,
  milestoneId: number,
  fields: { title?: string; description?: string },
): Promise<GitLabMilestone> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/milestones/${milestoneId}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'PUT',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fields),
      },
      'Update Milestone',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to update milestone', response.status, 'gitlab');
    }
    // Surface GitLab's error body (e.g. {"message":"title is missing"}) instead
    // of an opaque status code; fall back to the status when no message exists.
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Failed to update milestone: ${body?.message ?? `status ${response.status}`}`);
  }

  return (await response.json()) as GitLabMilestone;
}

/**
 * Normalise a GitLab API error body into a single readable string (D-10,
 * closes 88-REVIEW WR-01 for this phase).
 *
 * `updateMilestone`, `createBranch`, and `createMilestone` each independently
 * reinvented a narrower widening of GitLab's error-body shape (see the
 * `body?.message ?? status` line above, and `createBranch`'s array-only
 * widening). GitLab's Rails-standard validation-error convention can also
 * return a field-keyed object (e.g. `{"message":{"target_branch":["can't be
 * blank"]}}`), which neither existing analog handles — that shape falls
 * through to `[object Object]` if passed to `String()` directly. This helper
 * is the single place all three shapes (string, string[], field-keyed
 * object) are normalised; do not reinvent a fourth narrower widening.
 *
 * @param body - The parsed JSON error body (or `null`/non-object)
 * @returns A readable message, or `undefined` when no `message` key exists OR
 *          the message is present but flattens to an empty string
 */
export function flattenGitLabError(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined;
  const message = (body as { message?: unknown }).message;
  if (message === undefined || message === null) return undefined;

  let flat: string | undefined;
  if (typeof message === 'string') {
    flat = message;
  } else if (Array.isArray(message)) {
    flat = message.join(', ');
  } else if (typeof message === 'object') {
    flat = Object.entries(message as Record<string, unknown>)
      .map(([field, errs]) => {
        // A field's value is `string[]` in GitLab's Rails-standard shape, but
        // a nested object shows up too (`{target_branch:{base:['x']}}`) — and
        // `String({})` is exactly the `[object Object]` this helper exists to
        // prevent, so serialise it instead of stringifying it (WR-02).
        const detail = Array.isArray(errs)
          ? errs.join(', ')
          : typeof errs === 'string'
            ? errs
            : JSON.stringify(errs);
        return `${field} ${detail}`;
      })
      .join('; ');
  }

  // An empty result must be `undefined`, not `''` (WR-01): `{message:[]}` and
  // `{message:{}}` both flatten to `''`, which is not nullish and so sails
  // through every caller's `?? \`status ${response.status}\`` fallback —
  // producing "Failed to update merge request: " with nothing after the colon,
  // or an ApiError with an empty message that the UI renders as a tooltip.
  return flat !== undefined && flat.length > 0 ? flat : undefined;
}

/**
 * Update a merge request's target branch and/or milestone (D-10/MRFIX-01/02,
 * the phase's only new write endpoint).
 *
 * `milestone_id` is the milestone's GLOBAL `id` (matching `GitLabMR.milestone.id`
 * and `GitLabMilestone.id`), NOT the project-scoped `iid` — mirroring the
 * `id`-vs-`iid` note `updateMilestone` already carries. Passing `0` or an
 * empty value unassigns the milestone.
 *
 * T-90-01: the request body is assembled by explicitly picking only
 * `fields.target_branch` and `fields.milestone_id` into a fresh object —
 * never `JSON.stringify(fields)` and never a spread of the argument — so no
 * caller-supplied key (e.g. `state_event`, `assignee_id`) can ever reach
 * GitLab. Throws before any request when both fields are undefined (GitLab's
 * own "must include at least one non-required attribute" rule).
 *
 * T-90-02: error messages compose only from `flattenGitLabError(body)` or a
 * fixed literal — carrying `createBranch`'s WR-11 rule forward — never the
 * token, `PRIVATE-TOKEN` header, or request URL.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @param mrIid     - Merge request project-scoped `iid`
 * @param fields    - Subset of { target_branch, milestone_id } to update
 * @returns The updated merge request
 */
export async function updateMergeRequest(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
  fields: { target_branch?: string; milestone_id?: number },
): Promise<GitLabMR> {
  if (fields.target_branch === undefined && fields.milestone_id === undefined) {
    throw new Error('updateMergeRequest requires target_branch or milestone_id');
  }

  // T-90-01: explicit pick only — never spread `fields` or JSON.stringify it,
  // so an unknown/extra key passed at runtime is always dropped.
  const body: { target_branch?: string; milestone_id?: number } = {};
  if (fields.target_branch !== undefined) body.target_branch = fields.target_branch;
  if (fields.milestone_id !== undefined) body.milestone_id = fields.milestone_id;

  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/merge_requests/${mrIid}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'PUT',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      'Update Merge Request',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const msg = flattenGitLabError(errorBody);
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(msg ?? 'Failed to update merge request', response.status, 'gitlab');
    }
    throw new Error(`Failed to update merge request: ${msg ?? `status ${response.status}`}`);
  }

  return (await response.json()) as GitLabMR;
}

/**
 * Check whether a branch exists on a GitLab project (D-13).
 *
 * DELIBERATE EXCEPTION to this file's universal throw-on-!ok convention: a 404
 * here means "branch missing", a normal and expected result the release-branch
 * feature needs to render, not an error. Do NOT "normalize" this to throw on
 * 404 in a future refactor — that would make the missing-branch state
 * unreachable app-wide.
 *
 * @param baseUrl    - GitLab base URL
 * @param token      - Personal Access Token
 * @param projectId  - GitLab numeric project ID
 * @param branchName - Branch name (e.g. "release/33.5.0"); URL-encoded internally
 * @returns `{ exists: boolean }` — never throws on a plain 404
 */
export async function fetchBranch(
  baseUrl: string,
  token: string,
  projectId: number,
  branchName: string,
): Promise<{ exists: boolean }> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/repository/branches/${encodeURIComponent(branchName)}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Release Branch',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  // D-13: 404 means the branch doesn't exist yet — not an error condition.
  if (response.status === 404) return { exists: false };

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to check release branch', response.status, 'gitlab');
    }
    throw new Error(`Failed to check release branch: status ${response.status}`);
  }

  return { exists: true };
}

/**
 * Create a new branch on a GitLab project (D-22, the app's second write operation).
 *
 * Pitfall 4: GitLab returns 400 (not 409) for "branch already exists" — there is
 * deliberately no 409 branch here; the distinguishing signal is the message text,
 * surfaced verbatim to the dialog (D-16).
 *
 * @param baseUrl    - GitLab base URL
 * @param token      - Personal Access Token
 * @param projectId  - GitLab numeric project ID
 * @param branchName - New branch name (e.g. "release/33.5.0")
 * @param ref        - Ref to branch from (typically the project's default branch)
 * @returns The created branch's name and web_url
 */
export async function createBranch(
  baseUrl: string,
  token: string,
  projectId: number,
  branchName: string,
  ref: string,
): Promise<{ name: string; web_url: string }> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/repository/branches`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ branch: branchName, ref }),
      },
      'Create Release Branch',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    // Widened vs. updateMilestone's narrower typing (Pitfall 3): GitLab's
    // validation errors commonly arrive as message: string[] (e.g. duplicate
    // branch), which would render as [object Object] if left un-joined.
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    if (response.status === 401 || response.status === 403) {
      // WR-11: 403 is the single most likely failure mode for this write op
      // (protected-branch rules, missing `api` scope, role restrictions), and
      // GitLab's body carries the only actionable text the user will ever see —
      // D-15 forbids toasts, so the dialog is the sole error surface. Keep
      // ApiError (not plain Error) so apiFetch's markDisconnected behaviour on
      // 401 is preserved. Message is composed ONLY from body.message or the
      // fixed fallback literal — never the token, header, or request URL.
      throw new ApiError(msg ?? 'Failed to create branch', response.status, 'gitlab');
    }
    throw new Error(`Failed to create branch: ${msg ?? `status ${response.status}`}`);
  }

  return (await response.json()) as { name: string; web_url: string };
}

/**
 * Create a new milestone on a GitLab project (D-22, the app's third write operation).
 *
 * D-04: both `title` and `due_date` are always sent — no description field.
 * Pitfall 4: no 409 branch — GitLab returns 400 for "title already taken".
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @param fields    - `{ title, due_date }` to create the milestone with
 * @returns The created milestone
 */
export async function createMilestone(
  baseUrl: string,
  token: string,
  projectId: number,
  fields: { title: string; due_date: string },
): Promise<GitLabMilestone> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/milestones`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        method: 'POST',
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fields),
      },
      'Create Milestone',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    // Widened vs. updateMilestone's narrower typing (Pitfall 3): a duplicate-title
    // rejection commonly arrives as message: string[], not a bare string.
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    if (response.status === 401 || response.status === 403) {
      // WR-11: 403 is the single most likely failure mode for this write op
      // (protected-branch rules, missing `api` scope, role restrictions), and
      // GitLab's body carries the only actionable text the user will ever see —
      // D-15 forbids toasts, so the dialog is the sole error surface. Keep
      // ApiError (not plain Error) so apiFetch's markDisconnected behaviour on
      // 401 is preserved. Message is composed ONLY from body.message or the
      // fixed fallback literal — never the token, header, or request URL.
      throw new ApiError(msg ?? 'Failed to create milestone', response.status, 'gitlab');
    }
    throw new Error(`Failed to create milestone: ${msg ?? `status ${response.status}`}`);
  }

  return (await response.json()) as GitLabMilestone;
}

/**
 * Fetch repository tags for a GitLab project.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @returns Array of tags (most recent first)
 */
export async function fetchProjectTags(
  baseUrl: string,
  token: string,
  projectId: number,
): Promise<GitLabTag[]> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/projects/${projectId}/repository/tags?per_page=100`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Releases',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch tags', response.status, 'gitlab');
    }
    throw new Error('Failed to fetch tags');
  }

  const data = await response.json();
  return data as GitLabTag[];
}

/**
 * Fetch all open merge requests for a GitLab project.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @returns Array of open MRs for the project (up to 100)
 */
export async function fetchMRDetail(
  baseUrl: string,
  token: string,
  projectId: number,
  mrIid: number,
): Promise<GitLabMRDetail> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests/${mrIid}`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
      },
      'Load MR Detail',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch MR detail', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch MR detail: status ${response.status}`);
  }

  const data = await response.json();

  // Fetch project labels to get colors (MR endpoint only returns label names as strings)
  const labelColorMap: Record<string, { color: string; text_color: string }> = {};
  if (Array.isArray(data.labels) && data.labels.length > 0) {
    try {
      const labelsUrl = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/labels?per_page=100`;
      const labelsResp = await apiFetch(
        'gitlab',
        labelsUrl,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Load MR Detail',
      );
      if (labelsResp.ok) {
        const projectLabels = (await labelsResp.json()) as Array<{
          name: string;
          color: string;
          text_color: string;
        }>;
        for (const pl of projectLabels) {
          labelColorMap[pl.name] = { color: pl.color, text_color: pl.text_color };
        }
      }
    } catch {
      // If labels fetch fails, fall back to default colors
    }

    // Normalize labels: if they're strings, convert to GitLabLabel objects
    data.labels = data.labels.map((l: string | GitLabLabel) => {
      if (typeof l === 'string') {
        const colors = labelColorMap[l];
        return {
          name: l,
          color: colors?.color ?? '#6b7280',
          text_color: colors?.text_color ?? '#FFFFFF',
        };
      }
      return l;
    });
  }

  return data as GitLabMRDetail;
}

export async function fetchProjectMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  state: 'opened' | 'merged' | 'closed' | 'all' = 'opened',
): Promise<GitLabMR[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests?state=${state}&per_page=100`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
      },
      'Load Merge Requests',
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Failed to fetch project MRs', response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch project MRs: status ${response.status}`);
  }

  const data = (await response.json()) as GitLabMR[];

  // Enrich labels with colors (same pattern as fetchMRDetail)
  const allLabelNames = new Set<string>();
  for (const mr of data) {
    if (Array.isArray(mr.labels)) {
      for (const l of mr.labels) {
        if (typeof l === 'string') allLabelNames.add(l);
      }
    }
  }

  const labelColorMap: Record<string, { color: string; text_color: string }> = {};
  if (allLabelNames.size > 0) {
    try {
      const labelsUrl = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/labels?per_page=100`;
      const labelsResp = await apiFetch(
        'gitlab',
        labelsUrl,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Load MR Detail',
      );
      if (labelsResp.ok) {
        const projectLabels = (await labelsResp.json()) as Array<{
          name: string;
          color: string;
          text_color: string;
        }>;
        for (const pl of projectLabels) {
          labelColorMap[pl.name] = { color: pl.color, text_color: pl.text_color };
        }
      }
    } catch {
      // If labels fetch fails, fall back to default colors
    }
  }

  for (const mr of data) {
    if (Array.isArray(mr.labels)) {
      mr.labels = mr.labels.map((l: string | GitLabLabel) => {
        if (typeof l === 'string') {
          const colors = labelColorMap[l];
          return {
            name: l,
            color: colors?.color ?? '#6b7280',
            text_color: colors?.text_color ?? '#FFFFFF',
          };
        }
        return l;
      });
    }
  }

  return data;
}

/**
 * Fetch merge requests for a specific milestone by title.
 *
 * @param baseUrl        - GitLab base URL
 * @param token          - Personal Access Token
 * @param projectId      - GitLab numeric project ID
 * @param milestoneTitle - Milestone title string (GitLab API accepts title directly)
 * @returns Array of MRs in the milestone (all states)
 */
export async function fetchMilestoneMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  milestoneTitle: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?milestone=${encodeURIComponent(milestoneTitle)}&state=all&per_page=${perPage}&page=${page}`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Load Milestone MRs',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch milestone MRs', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch milestone MRs: status ${response.status}`);
    }

    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  // Enrich labels with colors (same pattern as fetchProjectMRs)
  const allLabelNames = new Set<string>();
  for (const mr of allMRs) {
    if (Array.isArray(mr.labels)) {
      for (const l of mr.labels) {
        if (typeof l === 'string') allLabelNames.add(l);
      }
    }
  }

  const labelColorMap: Record<string, { color: string; text_color: string }> = {};
  if (allLabelNames.size > 0) {
    try {
      const labelsUrl = `${base}/api/v4/projects/${projectId}/labels?per_page=100`;
      const labelsResp = await apiFetch(
        'gitlab',
        labelsUrl,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Load Milestone MRs',
      );
      if (labelsResp.ok) {
        const projectLabels = (await labelsResp.json()) as Array<{
          name: string;
          color: string;
          text_color: string;
        }>;
        for (const pl of projectLabels) {
          labelColorMap[pl.name] = { color: pl.color, text_color: pl.text_color };
        }
      }
    } catch {
      // If labels fetch fails, fall back to default colors
    }
  }

  for (const mr of allMRs) {
    if (Array.isArray(mr.labels)) {
      mr.labels = mr.labels.map((l: string | GitLabLabel) => {
        if (typeof l === 'string') {
          const colors = labelColorMap[l];
          return {
            name: l,
            color: colors?.color ?? '#6b7280',
            text_color: colors?.text_color ?? '#FFFFFF',
          };
        }
        return l;
      });
    }
  }

  return allMRs;
}

/**
 * Fetch merge requests targeting a specific branch (Channel C — DRIFT-03).
 *
 * Fully paginated with no page cap — see D-17. Do not replace with a single
 * capped page; that is the GGX-WARN-01 bug class this phase deletes.
 *
 * @param baseUrl      - GitLab base URL
 * @param token        - Personal Access Token
 * @param projectId    - GitLab numeric project ID
 * @param targetBranch - Branch name the MRs must target (e.g. `release/33.5.0`);
 *                       percent-encoded so `/` in release branch names can't inject
 *                       additional query params or path segments (T-89-01)
 * @returns Array of MRs targeting `targetBranch` (all states)
 */
export async function fetchBranchTargetedMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  targetBranch: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?target_branch=${encodeURIComponent(targetBranch)}&state=all&per_page=${perPage}&page=${page}`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Load Branch-Targeted MRs',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch branch-targeted MRs', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch branch-targeted MRs: status ${response.status}`);
    }

    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);

    if (data.length < perPage) break;
    page++;
  }

  // Enrich labels with colors (same pattern as fetchMilestoneMRs)
  const allLabelNames = new Set<string>();
  for (const mr of allMRs) {
    if (Array.isArray(mr.labels)) {
      for (const l of mr.labels) {
        if (typeof l === 'string') allLabelNames.add(l);
      }
    }
  }

  const labelColorMap: Record<string, { color: string; text_color: string }> = {};
  if (allLabelNames.size > 0) {
    try {
      const labelsUrl = `${base}/api/v4/projects/${projectId}/labels?per_page=100`;
      const labelsResp = await apiFetch(
        'gitlab',
        labelsUrl,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Load Branch-Targeted MRs',
      );
      if (labelsResp.ok) {
        const projectLabels = (await labelsResp.json()) as Array<{
          name: string;
          color: string;
          text_color: string;
        }>;
        for (const pl of projectLabels) {
          labelColorMap[pl.name] = { color: pl.color, text_color: pl.text_color };
        }
      }
    } catch {
      // If labels fetch fails, fall back to default colors
    }
  }

  for (const mr of allMRs) {
    if (Array.isArray(mr.labels)) {
      mr.labels = mr.labels.map((l: string | GitLabLabel) => {
        if (typeof l === 'string') {
          const colors = labelColorMap[l];
          return {
            name: l,
            color: colors?.color ?? '#6b7280',
            text_color: colors?.text_color ?? '#FFFFFF',
          };
        }
        return l;
      });
    }
  }

  return allMRs;
}

/**
 * Page size and parallel-fetch width shared by the project-wide MR fetchers.
 *
 * Project-wide fetches (Channel A, and the Releases-list open-MR fetch) are
 * unbounded — they grow with project history forever. Paging them one request
 * at a time makes the release detail page wait on N serial round-trips. GitLab
 * returns `x-total-pages` on page 1, so pages 2..N can be fetched concurrently.
 * The cap keeps us from opening an unbounded number of sockets against the
 * GitLab instance on a large project.
 */
const MR_PAGE_SIZE = 100;
const MR_PAGE_CONCURRENCY = 5;
/**
 * Safety cap on pages walked in one fetch (= 50k MRs). Guards against a corrupt
 * `x-total-pages` allocating an unbounded page list, and against an unbounded
 * sequential walk if the API never returns a short page. Sibling fetchers in
 * this file cap similarly (`searchProjectTags` 20, `fetchUserCommits` 50).
 */
const MR_MAX_PAGES = 500;

/**
 * Fetch one page of merge requests, applying the shared error contract.
 *
 * Callers own pagination; this only normalises transport and status errors so
 * every project-wide fetcher rejects identically regardless of which page failed.
 */
async function fetchMRPage(
  url: string,
  baseUrl: string,
  token: string,
  context: string,
  errorLabel: string,
): Promise<{ data: GitLabMR[]; response: Response }> {
  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
      },
      context,
    );
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(`Failed to fetch ${errorLabel}`, response.status, 'gitlab');
    }
    throw new Error(`Failed to fetch ${errorLabel}: status ${response.status}`);
  }

  return { data: (await response.json()) as GitLabMR[], response };
}

/**
 * Fully paginate a project-wide MR endpoint with no page cap (D-17).
 *
 * Fetches page 1, then reads `x-total-pages` to fetch the remainder in
 * concurrency-capped batches. When that header is absent (older GitLab, or a
 * test double that does not model headers) this falls back to the original
 * sequential walk, so completeness never depends on the header being present.
 *
 * @param buildUrl - Builds the request URL for a given 1-based page number
 */
async function fetchAllMRPages(
  buildUrl: (page: number) => string,
  baseUrl: string,
  token: string,
  context: string,
  errorLabel: string,
): Promise<GitLabMR[]> {
  const first = await fetchMRPage(buildUrl(1), baseUrl, token, context, errorLabel);
  const allMRs: GitLabMR[] = [...first.data];

  if (first.data.length < MR_PAGE_SIZE) return allMRs;

  const totalPages = Number(first.response.headers?.get?.('x-total-pages') ?? Number.NaN);

  // `page` is where the sequential tail resumes. The parallel phase (when the
  // header is usable) advances it; otherwise the tail starts at page 2.
  let page = 2;

  // The header is a HINT, not a contract. Trusting it blindly is worse than the
  // sequential walk it replaces: a stale or under-reporting `x-total-pages` would
  // silently truncate the result set, and a corrupt large one would allocate an
  // unbounded page list. Bound it, then verify with the sequential tail below.
  if (Number.isFinite(totalPages) && totalPages > 1) {
    const boundedTotal = Math.min(totalPages, MR_MAX_PAGES);
    const remaining = Array.from({ length: boundedTotal - 1 }, (_, i) => i + 2);
    for (let i = 0; i < remaining.length; i += MR_PAGE_CONCURRENCY) {
      const batch = remaining.slice(i, i + MR_PAGE_CONCURRENCY);
      const results = await Promise.all(
        batch.map((p) => fetchMRPage(buildUrl(p), baseUrl, token, context, errorLabel)),
      );
      // Concat in page order — Promise.all preserves input order, so MR
      // ordering stays identical to the sequential walk it replaces.
      for (const r of results) allMRs.push(...r.data);
    }
    page = boundedTotal + 1;

    // If the final advertised page came back FULL, the header under-reported
    // (new MRs landed mid-fetch, or it was stale). Fall through to the tail
    // rather than returning a short list that looks complete.
    const lastPageWasFull = allMRs.length >= boundedTotal * MR_PAGE_SIZE;
    if (!lastPageWasFull) return allMRs;
  }

  // Sequential tail: walk until a short page or the safety cap. Also the sole
  // path when `x-total-pages` is absent (older GitLab, or a test double that
  // does not model headers), so completeness never depends on the header.
  while (page <= MR_MAX_PAGES) {
    const { data } = await fetchMRPage(buildUrl(page), baseUrl, token, context, errorLabel);
    allMRs.push(...data);
    if (data.length < MR_PAGE_SIZE) break;
    page++;
  }

  return allMRs;
}

/**
 * Fetch every merge request in a project across ALL states — Channel A's
 * local-match universe (DRIFT-01).
 *
 * Fully paginated with no page cap — see D-17. Do not replace with a single
 * capped page; that is the GGX-WARN-01 bug class this phase deletes.
 *
 * `updatedAfter` bounds how far back the local-match universe reaches. It is a
 * performance bound, not a correctness one: an unbounded fetch on a mature
 * project is ~4200 MRs / 42 pages / ~15MB, and the GitLab instance is
 * throughput-limited, so no amount of parallelism makes it fast. Channels B
 * (milestone) and C (target branch) remain unbounded, so an MR attached to the
 * release's milestone or targeting its release branch is still discovered at
 * any age. Only an MR that is simultaneously old, off-milestone, off-branch and
 * key-referencing can fall outside the window. Callers derive the value from
 * real release dates rather than hardcoding it — see `useReleaseDetail`.
 *
 * @param baseUrl      - GitLab base URL
 * @param token        - Personal Access Token
 * @param projectId    - GitLab numeric project ID
 * @param updatedAfter - Optional ISO-8601 lower bound on `updated_at`; omitted means all history
 * @returns Array of every MR in the project (all states) within the window
 */
export async function fetchAllProjectMRs(
  baseUrl: string,
  token: string,
  projectId: number,
  updatedAfter?: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const windowParam = updatedAfter ? `&updated_after=${encodeURIComponent(updatedAfter)}` : '';
  const allMRs = await fetchAllMRPages(
    (page) =>
      `${base}/api/v4/projects/${projectId}/merge_requests?state=all&per_page=${MR_PAGE_SIZE}&page=${page}${windowParam}`,
    baseUrl,
    token,
    'Load All Project MRs',
    'project MRs',
  );

  // Enrich labels with colors (same pattern as fetchMilestoneMRs)
  const allLabelNames = new Set<string>();
  for (const mr of allMRs) {
    if (Array.isArray(mr.labels)) {
      for (const l of mr.labels) {
        if (typeof l === 'string') allLabelNames.add(l);
      }
    }
  }

  const labelColorMap: Record<string, { color: string; text_color: string }> = {};
  if (allLabelNames.size > 0) {
    try {
      const labelsUrl = `${base}/api/v4/projects/${projectId}/labels?per_page=100`;
      const labelsResp = await apiFetch(
        'gitlab',
        labelsUrl,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Load All Project MRs',
      );
      if (labelsResp.ok) {
        const projectLabels = (await labelsResp.json()) as Array<{
          name: string;
          color: string;
          text_color: string;
        }>;
        for (const pl of projectLabels) {
          labelColorMap[pl.name] = { color: pl.color, text_color: pl.text_color };
        }
      }
    } catch {
      // If labels fetch fails, fall back to default colors
    }
  }

  for (const mr of allMRs) {
    if (Array.isArray(mr.labels)) {
      mr.labels = mr.labels.map((l: string | GitLabLabel) => {
        if (typeof l === 'string') {
          const colors = labelColorMap[l];
          return {
            name: l,
            color: colors?.color ?? '#6b7280',
            text_color: colors?.text_color ?? '#FFFFFF',
          };
        }
        return l;
      });
    }
  }

  return allMRs;
}

/**
 * Search GitLab merge requests by text query.
 *
 * @param baseUrl - GitLab base URL
 * @param token   - Personal Access Token
 * @param query   - Free-text search query
 * @returns Array of matching MRs (up to 20); returns empty array on error to not block parallel Jira search
 */
export async function searchGitLabMRs(
  baseUrl: string,
  token: string,
  query: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/api/v4/search?scope=merge_requests&search=${encodeURIComponent(query)}&state=opened&per_page=20`;

  let response: Response;
  try {
    response = await apiFetch(
      'gitlab',
      url,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
      'Load Merge Requests',
    );
  } catch {
    return [];
  }

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as GitLabMR[];

  // Convert string labels to GitLabLabel with default gray (search spans multiple projects)
  for (const mr of data) {
    if (Array.isArray(mr.labels)) {
      mr.labels = mr.labels.map((l: string | GitLabLabel) => {
        if (typeof l === 'string') {
          return { name: l, color: '#6b7280', text_color: '#FFFFFF' };
        }
        return l;
      });
    }
  }

  return data;
}

/**
 * Shape of a Git commit returned by GitLab's repository commits endpoint.
 * Used for the Standup Notes Yesterday recap (STAND-05).
 */
export interface GitLabCommit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string; // ISO 8601
  web_url: string;
}

/**
 * Fetch commits authored by a specific user on the given project for a date.
 *
 * STAND-05: Used by the Standup Notes page to show Git commits in the Yesterday recap.
 *
 * Strategy (D-14 resolution: activeGitlabProject only):
 * - GET /api/v4/projects/:projectId/repository/commits with since/until covering
 *   the user's LOCAL calendar day (converted to UTC), so the window matches the
 *   local `date` that resolveYesterdayDate() produces.
 * - all=true: includes commits on EVERY branch/tag (not just the default branch), so
 *   unmerged feature-branch work shows up. Commits reachable from multiple refs are
 *   deduped by id.
 * - Pages through the whole window (per_page=100): the endpoint has no author filter,
 *   so filtering is client-side and the user's commits may sit beyond page 1.
 * - Client-side author filter (case-insensitive), a commit is kept when ANY match:
 *   - git author_name equals the GitLab display name or login username
 *   - git author_email contains the display name or login username
 *   - git author_email's "name" equals the user's GitLab email "name" — the local
 *     part before @, domain-ignored and with trailing digits stripped, so numbered
 *     aliases across domains match (e.g. john.doe@example.com ↔ john.doe@company.com
 *     ↔ john.doe1@example.com all normalize to "john.doe"). See {@link emailLocalName}.
 *   The login username alone is unreliable — git author_name is usually the display
 *   name (e.g. "Milan Mozolak"), not the login handle.
 *
 * @param baseUrl         - GitLab base URL (e.g. "https://gitlab.example.com")
 * @param token           - Personal Access Token (PRIVATE-TOKEN header)
 * @param projectId       - GitLab project ID (activeGitlabProject from auth store)
 * @param date            - Target LOCAL date as YYYY-MM-DD
 * @param authorUsername  - GitLab login username to filter by (gitlabUsername from auth store)
 * @param authorName      - GitLab display name to filter by (gitlabName from auth store);
 *                          matches git author_name where the login does not
 * @param authorEmail     - GitLab account email to filter by (gitlabEmail from auth store);
 *                          matched by local-part name, domain-ignored, trailing digits stripped
 * @returns Array of commits authored by the user on the given date
 */
export async function fetchUserCommits(
  baseUrl: string,
  token: string,
  projectId: number,
  date: string,
  authorUsername: string | readonly string[],
  authorName?: string | readonly (string | null | undefined)[] | null,
  authorEmail?: string | readonly (string | null | undefined)[] | null,
): Promise<GitLabCommit[]> {
  const base = baseUrl.replace(/\/$/, '');
  // Cover the user's LOCAL day: parse local midnight boundaries, then convert to
  // UTC for the API (GitLab since/until are UTC). Without this, a UTC+N user loses
  // commits made in the first N hours of their local day.
  const since = new Date(`${date}T00:00:00.000`).toISOString();
  const until = new Date(`${date}T23:59:59.999`).toISOString();
  const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };

  // all=true: traverse EVERY branch/tag, not just the default branch — standup work
  // often lives on unmerged feature branches. The endpoint also has no author filter,
  // so it returns commits by ALL authors in the window and we filter client-side below.
  // Both reasons force a full paged walk of the window — the user's commits can sit
  // past page 1 and would otherwise be dropped. Stop on a short page; the page cap is
  // a runaway guard (50 * 100 = 5000 commits/day is far beyond any real standup day).
  const perPage = 100;
  const data: GitLabCommit[] = [];

  for (let page = 1; page <= 50; page++) {
    const url = `${base}/api/v4/projects/${projectId}/repository/commits?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&all=true&per_page=${perPage}&page=${page}&with_stats=false`;

    let response: Response;
    try {
      response = await apiFetch('gitlab', url, { headers }, 'Load Standup Commits');
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to fetch commits', response.status, 'gitlab');
      }
      throw new Error(`Failed to fetch commits: status ${response.status}`);
    }

    const pageData = (await response.json()) as GitLabCommit[];
    data.push(...pageData);
    if (pageData.length < perPage) break;
  }

  // all=true can surface the same commit from multiple branch tips — dedupe by id.
  const seen = new Set<string>();
  const unique = data.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Pitfall 5: GitLab author_name is from git config (usually the display name),
  // not the login username. Match against BOTH the display name and the login,
  // case-insensitively: author_name equals either identity, or author_email
  // contains either. Empty/absent identities are skipped so they never match all.
  // Accepts arrays to cover users with multiple GitLab accounts across companies.
  const usernames = Array.isArray(authorUsername) ? authorUsername : [authorUsername];
  const names = Array.isArray(authorName) ? authorName : [authorName];
  const emails = Array.isArray(authorEmail) ? authorEmail : [authorEmail];

  const identities = [...names, ...usernames]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => v.toLowerCase());

  // Email-name match across all accounts: compare local-part of each email against commits.
  const userEmailNames = emails
    .filter((e): e is string => !!e)
    .map(emailLocalName)
    .filter((n) => n.length > 0);

  // Extract significant name words: split on all punctuation/brackets/spaces,
  // strip trailing digits from each token (e.g. "slavka1" → "slavka"), keep only
  // all-letter tokens of length ≥ 4. This discards dept suffixes like "osk"/"ext"
  // that appear in Jira/LDAP display names but never in git author names.
  const significantWordSets = names
    .filter((n): n is string => !!n && n.trim().length > 0)
    .map((n) =>
      n
        .toLowerCase()
        .split(/[\s,._\-()[\]{}+]+/)
        .map((w) => w.replace(/\d+$/, ''))
        .filter((w) => /^[a-z]+$/.test(w) && w.length >= 4),
    )
    .filter((words) => words.length >= 2);

  return unique.filter((c) => {
    const name = c.author_name.toLowerCase();
    const email = c.author_email.toLowerCase();
    if (identities.some((id) => name === id || email.includes(id))) return true;
    if (userEmailNames.length > 0) {
      const commitEmailName = emailLocalName(email);
      if (commitEmailName && userEmailNames.includes(commitEmailName)) return true;
    }
    // Word-based fallback: at least 2 significant name words match between the identity
    // and the commit author name. Handles surname-first display names ("Dobrotova Slavka
    // OSK (ext.)") matching git names in firstname-surname order ("Slavka Dobrotova"),
    // different capitalisation, and department suffixes being absent from git names.
    const authorWords = name.split(/[\s,._\-()[\]{}+]+/).map((w) => w.replace(/\d+$/, ''));
    if (
      significantWordSets.some((words) => words.filter((w) => authorWords.includes(w)).length >= 2)
    )
      return true;
    return false;
  });
}

/**
 * Normalize an email to a comparable "name" for commit-author matching. Strips
 * trailing digits from each dot-separated segment so numbered aliases collapse:
 * "john.doe@example.com", "john1.doe@example.com", "john.doe1@company.com" all
 * yield "john.doe". All-digit segments (e.g. the "2" in "john.2.doe") are dropped.
 * Domain is ignored. Returns '' when no usable segments remain.
 */
function emailLocalName(email: string): string {
  const local = email.toLowerCase().split('@')[0] ?? '';
  return local
    .split('.')
    .map((seg) => seg.replace(/\d+$/, ''))
    .filter((seg) => seg.length > 0)
    .join('.');
}

/**
 * Shape of a GitLab User Event for MR activity.
 * Used for the Standup Notes Yesterday recap (STAND-06).
 */
export interface GitLabUserMREvent {
  id: number;
  action_name: 'commented' | 'approved';
  target_type: string | null;
  target_id: number;
  /**
   * For `approved` events this is the merge-request iid. For `commented` events
   * this is the individual NOTE's iid (unique per comment) — the merge request
   * is identified by `note.noteable_iid`, not this field.
   */
  target_iid: number;
  target_title: string;
  created_at: string; // ISO 8601
  project_id: number;
  /** The user who performed the event (the comment/approval author). */
  author?: { id: number };
  note?: { noteable_type: string; noteable_iid?: number; author?: { id: number } };
}

/**
 * Fetch MR activity events (commented + approved) for a user on a given date.
 *
 * STAND-06: Used by the Standup Notes page to show MR activity in the Yesterday recap.
 *
 * Strategy (D-04, D-05):
 * - Fires two requests in parallel via Promise.allSettled:
 *   action=commented and action=approved, both for MergeRequest target_type
 * - Pitfall 4: GitLab `after` param is exclusive — pass dayBefore to include yesterday's events
 * - Client-side filter: keep only events where created_at.slice(0,10) === date AND target_type === 'MergeRequest'
 * - If one request fails, the other's events are still returned (allSettled isolation)
 *
 * @param baseUrl  - GitLab base URL (e.g. "https://gitlab.example.com")
 * @param token    - Personal Access Token (PRIVATE-TOKEN header)
 * @param userId   - GitLab user ID (gitlabUserId from auth store)
 * @param date     - Target date as YYYY-MM-DD
 * @returns Array of MR events (commented + approved) for the user on the given date
 */
export async function fetchUserMREvents(
  baseUrl: string,
  token: string,
  userId: number,
  date: string,
): Promise<GitLabUserMREvent[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };

  // Pitfall 4: GitLab `after` param is exclusive — compute day before to include yesterday's events
  const dayBeforeDate = new Date(date);
  dayBeforeDate.setDate(dayBeforeDate.getDate() - 1);
  const dayBefore = dayBeforeDate.toISOString().slice(0, 10);

  const [commentedResult, approvedResult] = await Promise.allSettled([
    // Comments on MRs: target_type is null in GitLab's response — filter via note.noteable_type
    apiFetch(
      'gitlab',
      `${base}/api/v4/users/${userId}/events?action=commented&after=${dayBefore}&per_page=100`,
      { headers },
      'Load Standup MR Events',
    ),
    apiFetch(
      'gitlab',
      `${base}/api/v4/users/${userId}/events?action=approved&target_type=merge_request&after=${dayBefore}&per_page=100`,
      { headers },
      'Load Standup MR Events',
    ),
  ]);

  const events: GitLabUserMREvent[] = [];

  if (commentedResult.status === 'fulfilled' && commentedResult.value.ok) {
    const data = (await commentedResult.value.json()) as GitLabUserMREvent[];
    events.push(
      ...data.filter(
        (e) =>
          e.created_at.slice(0, 10) === date &&
          e.note?.noteable_type === 'MergeRequest' &&
          // Count ONLY the current user's own comments — exclude replies from
          // other people on the same threads. Check both the event actor and
          // the note author; drop the event when either is explicitly someone
          // else (lenient defaults keep the event when a field is absent).
          (e.author?.id ?? userId) === userId &&
          (e.note?.author?.id ?? userId) === userId,
      ),
    );
  }

  if (approvedResult.status === 'fulfilled' && approvedResult.value.ok) {
    const data = (await approvedResult.value.json()) as GitLabUserMREvent[];
    events.push(
      ...data.filter((e) => e.created_at.slice(0, 10) === date && e.target_type === 'MergeRequest'),
    );
  }

  return events;
}

// ─── Participating MRs (commented on — role-independent) ──────────────────────

/**
 * A merge request the current user has commented on within a rolling window.
 * Role-independent: derived from the user's own `commented` events, not from
 * MR assignment, reviewer, or author roles.
 *
 * Only actionable MRs are returned: those where the user has NOT yet approved,
 * OR where the user has at least one unresolved thread (open thread).
 */
export interface ParticipatedMR {
  projectId: number;
  mrIid: number;
  title: string;
  /** How many of the user's own comment events hit this MR in the window. */
  commentCount: number;
  /** ISO timestamp of the user's most recent comment on this MR. */
  lastCommentedAt: string;
  /** Whether the current user authored (created) this MR. */
  authoredByMe: boolean;
  /** Whether the current user has approved this MR. */
  approvedByMe: boolean;
  /** Number of threads the user participated in that are still unresolved. */
  openThreadCount: number;
  /** Source branch name (from MR detail). Used for Jira key matching. */
  sourceBranch: string;
  /** GitLab web URL for the MR (from MR detail). */
  webUrl: string;
}

/**
 * Fetch MRs the current user has participated in (commented on) within the
 * last `sinceDays` days.
 *
 * Role-independent: uses the GitLab User Events API filtered to
 * `action=commented`, then deduplicates by project+MR iid. An MR appears in
 * the result even when the user is not an assignee, reviewer, or author.
 *
 * Pitfall 4 (same as fetchUserMREvents): GitLab `after` is exclusive and
 * date-granular — subtract one extra day so the boundary day is included.
 *
 * @param baseUrl   - GitLab base URL (e.g. "https://gitlab.example.com")
 * @param token     - Personal Access Token (PRIVATE-TOKEN header)
 * @param userId    - GitLab user ID
 * @param sinceDays - Rolling window in days (default 30)
 */
export async function fetchParticipatedMRs(
  baseUrl: string,
  token: string,
  userId: number,
  sinceDays = 30,
): Promise<ParticipatedMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' };

  // Pitfall 4: GitLab `after` is exclusive — subtract one extra day so the
  // boundary day's events are included.
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - sinceDays - 1);
  const after = afterDate.toISOString().slice(0, 10);

  const response = await apiFetch(
    'gitlab',
    `${base}/api/v4/users/${userId}/events?action=commented&after=${after}&per_page=100`,
    { headers },
    'Load Participated MRs',
  );

  if (!response.ok) {
    throw new ApiError('Failed to fetch participated MRs', response.status, 'gitlab');
  }

  const data = (await response.json()) as GitLabUserMREvent[];

  // Deduplicate by project_id:noteable_iid into a map
  const deduped = new Map<
    string,
    {
      projectId: number;
      mrIid: number;
      title: string;
      commentCount: number;
      lastCommentedAt: string;
    }
  >();

  for (const e of data) {
    // Filter: must be an MR comment authored by the current user
    if (e.note?.noteable_type !== 'MergeRequest') continue;
    if (!e.note.noteable_iid) continue;
    // Lenient own-author check (mirrors fetchUserMREvents pattern)
    if ((e.author?.id ?? userId) !== userId) continue;
    if ((e.note?.author?.id ?? userId) !== userId) continue;

    const key = `${e.project_id}:${e.note.noteable_iid}`;
    const existing = deduped.get(key);

    if (existing) {
      existing.commentCount += 1;
      if (e.created_at > existing.lastCommentedAt) {
        existing.lastCommentedAt = e.created_at;
      }
    } else {
      deduped.set(key, {
        projectId: e.project_id,
        mrIid: e.note.noteable_iid,
        title: e.target_title,
        commentCount: 1,
        lastCommentedAt: e.created_at,
      });
    }
  }

  const candidates = Array.from(deduped.values());

  // PHASE 1 — state filter: keep only OPEN MRs.
  // Fetch MR detail for each candidate in parallel; exclude any MR whose state
  // is not 'opened' or whose detail fetch fails (hard filter — we only want to
  // show confirmed-open MRs in the Participating section).
  // Also capture authoredByMe from detail.author.id for use in Phase 2.
  const detailResults = await Promise.allSettled(
    candidates.map((c) => fetchMRDetail(base, token, c.projectId, c.mrIid)),
  );
  const openCandidates = candidates
    .map((c, i) => {
      const result = detailResults[i];
      if (result.status !== 'fulfilled' || result.value.state !== 'opened') return null;
      return {
        ...c,
        authoredByMe: result.value.author.id === userId,
        sourceBranch: result.value.source_branch,
        webUrl: result.value.web_url,
      };
    })
    .filter(Boolean) as Array<
    (typeof candidates)[number] & { authoredByMe: boolean; sourceBranch: string; webUrl: string }
  >;

  // PHASE 2 — Enrich each open candidate with discussions + approvals in parallel.
  // Promise.allSettled ensures a single failed sub-request doesn't drop the
  // whole candidate; failures lean toward inclusion (showing actionable items).
  const enriched = await Promise.all(
    openCandidates.map(async (candidate) => {
      const [discussionsResult, approvalsResult] = await Promise.allSettled([
        fetchMRDiscussions(base, token, candidate.projectId, candidate.mrIid),
        fetchMRApprovals(base, token, candidate.projectId, candidate.mrIid),
      ]);

      // Approvals failure → treat as not-approved (lean toward showing).
      // `approved_by` may be absent on GitLab CE/Free (no approvals feature) —
      // guard with ?? [] so the synchronous .some() never throws and rejects
      // the enclosing Promise.all (which would error the whole section).
      const approvedByMe =
        approvalsResult.status === 'fulfilled'
          ? (approvalsResult.value.approved_by ?? []).some((a) => a.user.id === userId)
          : false;

      // Discussions failure → treat as empty (MR still shown if not approved)
      const discussions = discussionsResult.status === 'fulfilled' ? discussionsResult.value : [];

      // Threads where the user participated (has at least one non-system note by me).
      // Guard `notes` (?? []) against malformed/partial discussion payloads.
      const myThreads = discussions.filter((d) =>
        (d.notes ?? []).some((n) => !n.system && n.author.id === userId),
      );

      // Unresolved threads: any note in the thread is resolvable and not resolved
      const myOpenThreads = myThreads.filter((d) =>
        (d.notes ?? []).some((n) => n.resolvable && !n.resolved),
      );

      const openThreadCount = myOpenThreads.length;
      const { authoredByMe } = candidate;

      // Inclusion rule:
      //   - keep if there is at least one open (unresolved) thread, OR
      //   - keep if the MR was NOT authored by me AND I haven't approved it yet
      // Rationale: for MRs I authored, approving is someone else's job — only
      // open threads should keep my own MRs alive here.
      const include = openThreadCount > 0 || (!authoredByMe && !approvedByMe);

      return include
        ? ({
            ...candidate,
            authoredByMe,
            approvedByMe,
            openThreadCount,
            sourceBranch: candidate.sourceBranch,
            webUrl: candidate.webUrl,
          } satisfies ParticipatedMR)
        : null;
    }),
  );

  // Filter out dropped MRs and sort by most recent comment descending
  return (enriched.filter(Boolean) as ParticipatedMR[]).sort((a, b) =>
    b.lastCommentedAt.localeCompare(a.lastCommentedAt),
  );
}
