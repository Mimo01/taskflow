/**
 * Jira backlog view: fetch unassigned backlog issues and full backlog view with sprints.
 */

import { ApiError } from '../../lib/api-error';
import { apiFetch } from '../../lib/apiFetch';
import { fetchAllSearchPages, isResponseLikeError } from './client';
import type { BacklogViewData, JiraActiveSprint, JiraIssue } from './types';

/**
 * Fetch all backlog issues for a Jira project.
 *
 * Uses compound JQL to retrieve issues that are not in any open or future sprint:
 *   project = {projectKey} AND (sprint is EMPTY OR sprint not in (openSprints(), futureSprints()))
 *   AND issuetype not in subtaskIssueTypes() ORDER BY created DESC
 *
 * Delegates pagination to the private fetchAllSearchPages helper.
 * On 400 response (e.g. Jira Software license not active), throws a user-friendly error.
 */
export async function fetchBacklogIssues(
  baseUrl: string,
  token: string,
  projectKey: string,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Deduplicate fields (custom keys may overlap with defaults)
  const fields = [
    ...new Set([
      'summary',
      'status',
      'assignee',
      'issuetype',
      'labels',
      'customfield_10016',
      'customfield_10014',
      'customfield_10015',
      storyPointsFieldKey,
      epicLinkFieldKey,
      epicNameFieldKey,
    ]),
  ].join(',');

  const jql = encodeURIComponent(
    `project = ${projectKey} AND sprint is EMPTY AND issuetype != Sub-task AND statusCategory != Done ORDER BY rank ASC`,
  );
  const baseSearchUrl = `${base}/rest/api/2/search?jql=${jql}&fields=${fields}`;

  try {
    return await fetchAllSearchPages(baseSearchUrl, headers);
  } catch (err) {
    // Re-throw ApiError directly (auth failures from fetchAllSearchPages)
    if (err instanceof ApiError) throw err;
    // fetchAllSearchPages throws the raw Response on first-page failure (duck-typed by status)
    if (isResponseLikeError(err)) {
      const status = err.status;
      if (status === 400) {
        throw new Error(
          'Backlog query unavailable — ensure Jira Software license is active for this project',
        );
      }
      throw new Error(`Jira search failed with status ${status}`);
    }
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
}

/**
 * Fetch the ordered sprint list (active + future) for a board.
 * Returns sprints in Jira board order, including empty sprints.
 *
 * Filters sprints to only those whose originBoardId matches the discovered
 * canonical board ID. Jira DC boards can surface sprints from other boards
 * (e.g. when a project has multiple boards or shared sprints), so this
 * filtering prevents foreign sprints from appearing in the backlog view.
 */
export async function fetchSprintList(
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<JiraActiveSprint[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const res = await apiFetch(
    'jira',
    `${base}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`,
    { headers },
    'Load Sprint List',
  );
  if (!res.ok) return [];
  const data = await res.json();
  const allSprints: JiraActiveSprint[] = (data?.values ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as number,
    name: String(s.name ?? ''),
    state: String(s.state ?? '').toLowerCase() as 'active' | 'future' | 'closed',
    startDate: typeof s.startDate === 'string' ? s.startDate : undefined,
    endDate: typeof s.endDate === 'string' ? s.endDate : undefined,
    originBoardId: typeof s.originBoardId === 'number' ? s.originBoardId : undefined,
  }));

  // Determine the canonical board ID from the first sprint that has originBoardId set.
  // This is the board that "owns" these sprints. Filter out sprints from other boards
  // (which can appear when a Jira DC board surfaces sprints from shared projects).
  const canonicalBoardId = allSprints.find((s) => s.originBoardId !== undefined)?.originBoardId;
  if (canonicalBoardId === undefined) {
    // No originBoardId on any sprint — cannot filter, return all
    return allSprints;
  }
  return allSprints.filter((s) => s.originBoardId === undefined || s.originBoardId === canonicalBoardId);
}

/**
 * Fetch parent (non-subtask) issues across ALL active and future sprints for a project,
 * including the sprint custom field so BacklogPage can group stories by sprint section.
 *
 * Used exclusively by BacklogPage under query key `jira-backlog-sprint-stories`.
 * Does NOT share cache with SprintBoardTab's `jira-sprint-stories` (which uses the
 * standard search API without the sprint field and only targets openSprints()).
 *
 * Uses the Agile board endpoint so `fields.sprint` is returned as a reliable object
 * (consistent with originBoardId-scoped sprint discovery used elsewhere).
 *
 * Returns [] silently on 400 (Jira Software not installed) or when boardId is null.
 *
 * @param boardId - Scrum board ID from useBoardId hook; pass null to return []
 */
export async function fetchBacklogSprintStories(
  baseUrl: string,
  token: string,
  projectKey: string,
  boardId: number,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
): Promise<JiraIssue[]> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const spFields = [
    ...new Set(['customfield_10016', 'customfield_10028', storyPointsFieldKey]),
  ].join(',');
  // Include `sprint` in the fields list. The Agile board endpoint (/rest/agile/1.0/board/{id}/issue)
  // returns fields.sprint as a reliable object (not via the customfield_10020 key).
  const fields = `summary,status,assignee,issuetype,labels,sprint,${spFields},${epicLinkFieldKey},parent,subtasks,timetracking`;

  // Fetch active and future sprint stories in parallel via the Agile board endpoint.
  // Using the Agile endpoint (not /rest/api/2/search) ensures fields.sprint is populated.
  const agileBase = `${base}/rest/agile/1.0/board/${boardId}/issue`;
  const activeJql = encodeURIComponent(
    `project = ${projectKey} AND sprint in openSprints() AND issuetype not in subtaskIssueTypes() ORDER BY rank ASC`,
  );
  const futureJql = encodeURIComponent(
    `project = ${projectKey} AND sprint in futureSprints() AND issuetype not in subtaskIssueTypes() ORDER BY rank ASC`,
  );

  try {
    const [activeIssues, futureIssues] = await Promise.all([
      fetchAllSearchPages(`${agileBase}?jql=${activeJql}&fields=${fields}`, headers).catch(
        () => [] as JiraIssue[],
      ),
      fetchAllSearchPages(`${agileBase}?jql=${futureJql}&fields=${fields}`, headers).catch(
        () => [] as JiraIssue[],
      ),
    ]);
    return [...activeIssues, ...futureIssues];
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isResponseLikeError(err)) {
      const status = err.status;
      if (status === 400) {
        // Jira Software not installed — treat as empty
        return [];
      }
      throw new Error(`Jira search failed with status ${status}`);
    }
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
}

/**
 * Fetch the full backlog view: active sprint, future sprints, and unassigned backlog.
 *
 * Strategy:
 * 1. Use provided boardId (from shared useBoardId hook, D-03/D-05) — no internal board discovery.
 * 2. Fetch active + future sprint issues from that board via Agile API.
 * 3. Fetch sprint list to include empty sprints and establish canonical order.
 * 4. Fetch unassigned backlog issues (sprint is EMPTY AND issuetype != Sub-task).
 *
 * Epic names/colors are NOT fetched internally (D-04). Callers use the shared
 * fetchEpicsBasic query cache instead. The epicNames and epicColors fields are
 * omitted from the returned BacklogViewData.
 *
 * On board/sprint failure the sprints array is empty and only the backlog is populated.
 * Never throws -- all errors are caught and partial results are returned.
 *
 * @param boardId - Scrum board ID (from useBoardId hook); null to skip sprint fetching
 */
export async function fetchBacklogView(
  baseUrl: string,
  token: string,
  projectKey: string,
  boardId: number | null,
  storyPointsFieldKey = 'customfield_10016',
  epicLinkFieldKey = 'customfield_10014',
  epicNameFieldKey = 'customfield_10015',
): Promise<BacklogViewData> {
  const base = baseUrl.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const issueFields = [
    ...new Set([
      'summary',
      'status',
      'assignee',
      'issuetype',
      'labels',
      'subtasks',
      'customfield_10016',
      'customfield_10014',
      'customfield_10015',
      storyPointsFieldKey,
      epicLinkFieldKey,
      epicNameFieldKey,
    ]),
  ].join(',');

  // The Agile board issue API returns fields.sprint as a proper object --
  // no custom field key guessing needed (customfield_10020 varies by instance).
  const agileFields = `${issueFields},sprint`;

  // Parse fields.sprint from Agile API response (single object, not an array)
  function parseSprintFromIssue(issue: JiraIssue): JiraActiveSprint | null {
    const s = (issue.fields as Record<string, unknown>).sprint;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
    const sprint = s as Record<string, unknown>;
    if (typeof sprint.id !== 'number') return null;
    return {
      id: sprint.id,
      name: String(sprint.name ?? ''),
      state: String(sprint.state ?? '').toLowerCase() as 'active' | 'future' | 'closed',
      startDate: typeof sprint.startDate === 'string' ? sprint.startDate : undefined,
      endDate: typeof sprint.endDate === 'string' ? sprint.endDate : undefined,
      originBoardId: typeof sprint.originBoardId === 'number' ? sprint.originBoardId : undefined,
    };
  }

  // Group issues by sprint, preserving rank order
  function groupBySprint(
    issues: JiraIssue[],
  ): Array<{ sprint: JiraActiveSprint; issues: JiraIssue[] }> {
    const map = new Map<number, { sprint: JiraActiveSprint; issues: JiraIssue[] }>();
    for (const issue of issues) {
      const sprint = parseSprintFromIssue(issue);
      if (!sprint) continue;
      if (!map.has(sprint.id)) map.set(sprint.id, { sprint, issues: [] });
      map.get(sprint.id)?.issues.push(issue);
    }
    return Array.from(map.values());
  }

  // Step 2: Fetch active + future sprint issues via Agile board endpoint.
  // boardId is provided by the caller (from useBoardId hook, D-03/D-05).
  // /rest/agile/1.0/board/{id}/issue returns fields.sprint as a reliable object,
  // and openSprints()/futureSprints() JQL functions scope results to this project only.
  let sprints: Array<{ sprint: JiraActiveSprint; issues: JiraIssue[] }> = [];
  if (boardId !== null) {
    const activeJql = encodeURIComponent(
      `project = ${projectKey} AND sprint in openSprints() AND issuetype != Sub-task ORDER BY rank ASC`,
    );
    const futureJql = encodeURIComponent(
      `project = ${projectKey} AND sprint in futureSprints() AND issuetype != Sub-task ORDER BY rank ASC`,
    );
    const agileBase = `${base}/rest/agile/1.0/board/${boardId}/issue`;
    const [activeIssues, futureIssues] = await Promise.all([
      fetchAllSearchPages(`${agileBase}?jql=${activeJql}&fields=${agileFields}`, headers).catch(
        () => [] as JiraIssue[],
      ),
      fetchAllSearchPages(`${agileBase}?jql=${futureJql}&fields=${agileFields}`, headers).catch(
        () => [] as JiraIssue[],
      ),
    ]);
    const activeSprints = groupBySprint(activeIssues);
    const futureSprints = groupBySprint(futureIssues);

    // Determine the project's canonical board from the active sprint's originBoardId.
    // The discovered boardId may be wrong (e.g. "Copy of X" instead of "X").
    // originBoardId on the active sprint reliably identifies which board owns these sprints.
    const projectBoardId =
      activeSprints[0]?.sprint.originBoardId ?? futureSprints[0]?.sprint.originBoardId;

    const filterByBoard = (groups: typeof activeSprints) =>
      projectBoardId !== undefined
        ? groups.filter((g) => g.sprint.originBoardId === projectBoardId)
        : groups;

    const filteredActive = filterByBoard(activeSprints);
    const filteredFuture = filterByBoard(futureSprints);

    // Fetch all active+future sprints from the canonical board to include empty sprints.
    // Use projectBoardId if known (authoritative), otherwise fall back to discovered boardId.
    const sprintListBoardId = projectBoardId ?? boardId;
    try {
      const sprintListRes = await apiFetch(
        'jira',
        `${base}/rest/agile/1.0/board/${sprintListBoardId}/sprint?state=active,future`,
        { headers },
        'Load Backlog',
      );
      if (sprintListRes.ok) {
        const sprintListData = await sprintListRes.json();
        // Use the sprint list order as authoritative (Jira board order).
        // Rebuild sprints array: for each sprint in the list, use existing
        // issue group if available, otherwise create an empty entry.
        const issueGroupById = new Map<number, { sprint: JiraActiveSprint; issues: JiraIssue[] }>();
        for (const g of [...filteredActive, ...filteredFuture]) {
          issueGroupById.set(g.sprint.id, g);
        }
        sprints = [];
        for (const s of sprintListData?.values ?? []) {
          // Filter out sprints from other boards
          if (
            projectBoardId !== undefined &&
            typeof s.originBoardId === 'number' &&
            s.originBoardId !== projectBoardId
          )
            continue;
          const existing = issueGroupById.get(s.id);
          if (existing) {
            sprints.push(existing);
          } else {
            sprints.push({
              sprint: {
                id: s.id,
                name: String(s.name ?? ''),
                state: String(s.state ?? '').toLowerCase() as 'active' | 'future' | 'closed',
                startDate: typeof s.startDate === 'string' ? s.startDate : undefined,
                endDate: typeof s.endDate === 'string' ? s.endDate : undefined,
                originBoardId: typeof s.originBoardId === 'number' ? s.originBoardId : undefined,
              },
              issues: [],
            });
          }
        }
      } else {
        // Sprint list failed -- fall back to issue-derived order
        sprints = [...filteredActive, ...filteredFuture];
      }
    } catch {
      // Sprint list failed -- fall back to issue-derived order
      sprints = [...filteredActive, ...filteredFuture];
    }
  }

  // Step 3: Fetch backlog (unassigned to any sprint) via regular search API
  const backlogJql = encodeURIComponent(
    `project = ${projectKey} AND sprint is EMPTY AND issuetype != Sub-task ORDER BY rank ASC`,
  );
  const backlog = await fetchAllSearchPages(
    `${base}/rest/api/2/search?jql=${backlogJql}&fields=${issueFields}`,
    headers,
  ).catch(() => [] as JiraIssue[]);

  // Epic names/colors are omitted (D-04): callers use the shared fetchEpicsBasic cache.
  return { sprints, backlog };
}
