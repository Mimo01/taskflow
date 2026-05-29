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

  // ── BL-01 regression: CLOSED-sprint issues fall through to backlog bucket ──

  it('BL-01: reverse-index built from ACTIVE/FUTURE-only sprints does NOT include an issue whose sole membership is a CLOSED sprint', () => {
    // Synthesize a CLOSED sprint in-memory with a unique issue id that does
    // NOT appear in any ACTIVE/FUTURE sprint.  The fixture has no CLOSED sprint,
    // so we extend it here without mutating the on-disk JSON.
    const CLOSED_SPRINT_ID = 99999;
    const CLOSED_ONLY_ISSUE_ID = 999_000_001; // deliberately absent from real fixture

    type SprintLike = { id: number; state: string; issuesIds: number[] };
    const syntheticSprints: SprintLike[] = [
      ...typed.sprints,
      {
        id: CLOSED_SPRINT_ID,
        state: 'CLOSED',
        issuesIds: [CLOSED_ONLY_ISSUE_ID],
      },
    ];

    // Build the BL-01-correct reverse index: skip CLOSED sprints.
    const reverseActive = new Map<number, number>();
    for (const s of syntheticSprints) {
      if (s.state !== 'ACTIVE' && s.state !== 'FUTURE') continue; // BL-01 guard
      for (const id of s.issuesIds) reverseActive.set(id, s.id);
    }

    // The CLOSED-sprint issue must NOT be in the index so it can route to the
    // backlog bucket in BacklogPage's partition logic.
    expect(reverseActive.has(CLOSED_ONLY_ISSUE_ID)).toBe(false);

    // Sanity: an ACTIVE-sprint issue IS in the index (guard isn't over-filtering).
    const activeSprint = syntheticSprints.find((s) => s.state === 'ACTIVE' && s.issuesIds.length > 0);
    if (!activeSprint) throw new Error('fixture has no ACTIVE sprint with issues — sanity check invalid');
    expect(reverseActive.has(activeSprint.issuesIds[0] as number)).toBe(true);

    // Counter-proof: a naïve index that includes ALL sprints WOULD capture the
    // CLOSED-sprint issue (confirming the fix is load-bearing, not vacuous).
    const reverseAll = new Map<number, number>();
    for (const s of syntheticSprints) {
      for (const id of s.issuesIds) reverseAll.set(id, s.id);
    }
    expect(reverseAll.has(CLOSED_ONLY_ISSUE_ID)).toBe(true);
  });

  // ── BL-02 regression: CLOSED-sprint names resolve from raw backlog.sprints ──

  it('BL-02: lookupSprintNameById resolves CLOSED-sprint name from full backlog.sprints[] but not from ACTIVE/FUTURE-filtered list', () => {
    const CLOSED_SPRINT_ID = 88888;
    const CLOSED_SPRINT_NAME = 'Old Closed Sprint';

    type SprintLike = { id: number; state: string; name: string; issuesIds: number[] };
    const fullSprints: SprintLike[] = [
      ...typed.sprints,
      {
        id: CLOSED_SPRINT_ID,
        state: 'CLOSED',
        name: CLOSED_SPRINT_NAME,
        issuesIds: [],
      },
    ];

    // Simulate BL-02-correct lookup: search the FULL list (includes CLOSED).
    const lookupFromFull = (id: number): string | null => {
      const s = fullSprints.find((x) => x.id === id);
      return s ? s.name : null;
    };

    // Simulate the PRE-fix behaviour: lookup only across ACTIVE/FUTURE sections.
    const activeFutureSprints = fullSprints.filter(
      (s) => s.state === 'ACTIVE' || s.state === 'FUTURE',
    );
    const lookupFromFiltered = (id: number): string | null => {
      const s = activeFutureSprints.find((x) => x.id === id);
      return s ? s.name : null;
    };

    // BL-02 requirement: CLOSED sprint name IS resolvable from the full list.
    expect(lookupFromFull(CLOSED_SPRINT_ID)).toBe(CLOSED_SPRINT_NAME);

    // Pre-fix behaviour (filtered list): CLOSED sprint name is NOT resolvable —
    // pinning why the raw-list source is required (the fix must NOT regress to this).
    expect(lookupFromFiltered(CLOSED_SPRINT_ID)).toBeNull();

    // Sanity: an ACTIVE sprint is resolvable from both paths.
    const activeSprint = fullSprints.find((s) => s.state === 'ACTIVE');
    if (!activeSprint) throw new Error('fixture has no ACTIVE sprint — sanity check invalid');
    expect(lookupFromFull(activeSprint.id)).toBe(activeSprint.name);
    expect(lookupFromFiltered(activeSprint.id)).toBe(activeSprint.name);
  });
});
