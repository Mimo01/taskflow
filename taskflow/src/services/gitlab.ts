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
  state: 'opened' | 'closed' | 'merged' | 'locked';
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
  target_branch: string;
  created_at: string;
  labels: GitLabLabel[]; // normalized from string[] or object[] by fetchMRDetail
  draft: boolean;
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
export async function fetchProjectMilestonesInRange(
  baseUrl: string,
  token: string,
  projectId: number,
  from: string,
  to: string,
): Promise<GitLabMilestone[]> {
  const all = await fetchProjectMilestones(baseUrl, token, projectId);
  return all.filter((m) => {
    const date = m.due_date ?? m.start_date;
    if (!date) return false;
    return date >= from && date <= to;
  });
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
 * Search a single project's merge requests by Jira ticket key, across ALL states.
 *
 * GGX-WARN-01: Used by the release detail page to find an MR that carries a task's
 * ticket key but is NOT in the release's matched milestone (a "wrong milestone"
 * warning). Unlike the global `searchGitLabMRs` (open-only, cross-project, capped at
 * 20, error-swallowing), this is project-scoped, includes opened/merged/closed, and
 * paginates the full result set so merged/closed MRs on the wrong milestone are found.
 *
 * Searches the MR title via `search=<key>&in=title`. GitLab's MR search does not index
 * branch names, so a key that only appears in `source_branch` will not be returned here;
 * callers should re-run `linkMRToTask` on the results to confirm the key truly matches.
 *
 * Label-color enrichment is intentionally skipped — this consumer renders only the
 * milestone/iid/web_url, never MR labels, so the extra labels call is avoided.
 *
 * @param baseUrl   - GitLab base URL
 * @param token     - Personal Access Token
 * @param projectId - GitLab numeric project ID
 * @param key       - Jira ticket key (URL-encoded before sending)
 * @returns Array of MRs across all pages and states whose title matches the key
 */
export async function searchProjectMRsByKey(
  baseUrl: string,
  token: string,
  projectId: number,
  key: string,
): Promise<GitLabMR[]> {
  const base = baseUrl.replace(/\/$/, '');
  const perPage = 100;
  let page = 1;
  const allMRs: GitLabMR[] = [];

  while (true) {
    const url = `${base}/api/v4/projects/${projectId}/merge_requests?search=${encodeURIComponent(key)}&in=title&state=all&per_page=${perPage}&page=${page}`;

    let response: Response;
    try {
      response = await apiFetch(
        'gitlab',
        url,
        {
          headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        },
        'Search Project MRs',
      );
    } catch {
      throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Failed to search project MRs', response.status, 'gitlab');
      }
      throw new Error(`Failed to search project MRs: status ${response.status}`);
    }

    const data = (await response.json()) as GitLabMR[];
    allMRs.push(...data);

    if (data.length < perPage) break;
    page++;
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
