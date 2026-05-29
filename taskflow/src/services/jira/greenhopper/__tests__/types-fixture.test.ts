/**
 * Phase 74 — Task 2: Pin GhBacklogResponse to the real fixture.
 *
 * Compile-time + runtime structural assertion that the widened
 * GhBacklogResponse (Phase 74 D-04a) is compatible with
 * __fixtures__/data.real.json. Future drift in either the fixture or the
 * type produces a loud test failure (regression gate).
 *
 * See: 74-RESEARCH.md §"Code Examples — Type test loading the real fixture"
 *      74-PLAN.md Task 2.
 */

import { describe, expect, it } from 'vitest';

import fixture from '../__fixtures__/data.real.json';
import type { GhBacklogResponse } from '../types';

describe('GhBacklogResponse fixture pin', () => {
  it('GhBacklogResponse is structurally compatible with the real fixture', () => {
    const typed = fixture as unknown as GhBacklogResponse;

    expect(typed.entityData.statuses).toBeDefined();
    expect(typed.sprints.every((s) => Array.isArray(s.issuesIds))).toBe(true);
    expect(typeof typed.rankCustomFieldId).toBe('number');
    expect(typeof typed.canManageSprints).toBe('boolean');
    expect(typeof typed.canCreateIssue).toBe('boolean');
    expect(typeof typed.versionData.versionsPerProject).toBe('object');
    expect(typed.versionData.versionsPerProject).not.toBeNull();
  });
});
