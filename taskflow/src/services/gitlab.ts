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
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }

  if (response.ok) {
    const data = await response.json();
    return { id: data.id, name: data.name, username: data.username };
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
      'Validate Connection',
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
      'Validate Connection',
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

export interface DiscussionNote {
  id: string;
  resolvable: boolean;
  resolved: boolean;
  body: string;
}

export interface Discussion {
  id: string;
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
  const url = `${baseUrl.replace(/\/$/, '')}/api/v4/projects/${projectId}/merge_requests/${mrIid}/discussions`;

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

  const data = await response.json();
  return data as Discussion[];
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
      'Load MR Detail',
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
