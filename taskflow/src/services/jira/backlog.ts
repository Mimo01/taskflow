/**
 * Jira backlog service — Phase 74 GH-CUT-01.
 *
 * Only fetchSprintList remains after the Phase 74 cutover. The legacy REST
 * fetchers (fetchBacklogIssues, fetchBacklogSprintStories, fetchBacklogView)
 * were removed in Plan 06; backlog data now flows through
 * services/jira/greenhopper/useGhBacklogData (xboard data.json source).
 *
 * fetchSprintList is preserved per D-09a — issue-detail FieldsSection.tsx
 * still uses it to populate the sprint picker.
 */

import { apiFetch } from '../../lib/apiFetch';
import type { JiraActiveSprint } from './types';

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
  return allSprints.filter(
    (s) => s.originBoardId === undefined || s.originBoardId === canonicalBoardId,
  );
}
