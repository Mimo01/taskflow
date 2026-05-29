/**
 * Phase 74 — Task 4 (gate 1): backlog-shape adapter contract.
 *
 * Two assertions feeding Plan 03's adapter pass at BacklogPage:
 *   1. adaptIssue over a real GhIssue from `__fixtures__/data.real.json`
 *      produces a JiraIssue-shaped object with resolved status, resolved
 *      issuetype, synthesized assignee (when present), and story points
 *      populated at `fields[storyPointsFieldKey]` from
 *      `gh.estimateStatistic.statFieldValue.value` (Phase 74 D-05).
 *   2. A reverse-index `Map<issueId, sprintId>` built from
 *      `data.sprints[].issuesIds[]` correctly returns the sprintId for at
 *      least one fixture issue (Phase 74 D-04b).
 *
 * The adapter call uses the entityMaps built from the SAME data.json
 * payload (D-04 — entity maps come from data.entityData), confirming the
 * "single payload powers backlog + entity resolvers + sprint membership"
 * claim of GH-BACKLOG-01.
 */

import { describe, expect, it } from 'vitest';

import fixture from '../__fixtures__/data.real.json';
import { adaptIssue } from '../adapter';
import type { EntityMaps, GhBacklogResponse, GhIssue } from '../types';

const typed = fixture as unknown as GhBacklogResponse;

describe('Phase 74 backlog adapter contract', () => {
  it('adaptIssue over a backlog GhIssue resolves entity maps + synthesizes assignee + story points', () => {
    const gh: GhIssue | undefined = typed.issues[0];
    if (!gh) throw new Error('fixture data.real.json has no issues[0]');

    // EntityMaps from THIS payload (Phase 74 D-04). Same shape as Phase 73.
    const entityMaps: EntityMaps = {
      statuses: typed.entityData.statuses,
      priorities: typed.entityData.priorities,
      types: typed.entityData.types,
      epics: typed.entityData.epics,
    };

    const storyPointsFieldKey = gh.estimateStatistic.statFieldId;
    const out = adaptIssue(gh, entityMaps, storyPointsFieldKey);

    // Status resolved (not the "Unknown" fallback)
    expect(out.fields.status.id).toBe(gh.statusId);
    expect(out.fields.status.name.length).toBeGreaterThan(0);
    expect(out.fields.status.name).not.toBe('Unknown');

    // Issue type resolved
    expect(out.fields.issuetype.id).toBe(gh.typeId);
    expect(out.fields.issuetype.name.length).toBeGreaterThan(0);

    // Assignee synthesized when present (D-05)
    if (gh.assignee !== undefined) {
      expect(out.fields.assignee).not.toBeNull();
      expect(out.fields.assignee?.displayName).toBe(gh.assigneeName ?? gh.assignee);
      expect(out.fields.assignee?.avatarUrls?.['48x48']).toBe(gh.avatarUrl ?? '');
    }

    // Story points (D-02 gate): writes to customfield_10016 from
    // gh.estimateStatistic.statFieldValue.value when the statFieldId matches.
    expect(out.fields.customfield_10016).toBe(gh.estimateStatistic.statFieldValue.value ?? null);
  });

  it('sprint reverse-index from data.sprints[].issuesIds maps issueId → sprintId for backlog grouping (D-04b)', () => {
    const reverse = new Map<number, number>();
    for (const sprint of typed.sprints) {
      for (const issueId of sprint.issuesIds) {
        reverse.set(issueId, sprint.id);
      }
    }

    // At least one mapped pair must exist (fixture has many).
    expect(reverse.size).toBeGreaterThan(0);

    // Pick a fixture sprint and one of its issuesIds; the reverse-index
    // must return that sprint's id.
    const sprintWithIssues = typed.sprints.find((s) => s.issuesIds.length > 0);
    if (!sprintWithIssues) throw new Error('fixture data.real.json has no sprint with issuesIds');
    const someIssueId = sprintWithIssues.issuesIds[0] as number;
    expect(reverse.get(someIssueId)).toBe(sprintWithIssues.id);
  });
});
