import { describe, expect, it } from 'vitest';
import { NO_ACTIVE_SPRINT_SUBTITLE, resolveSprintScopeState } from './sprint-empty-state';

const base = { itemsLoading: false, hasItems: false };
const s = (noActiveSprint: boolean, isResolving: boolean) => ({ noActiveSprint, isResolving });

describe('resolveSprintScopeState', () => {
  it('items always win', () => {
    expect(resolveSprintScopeState({ ...base, hasItems: true, sprint: s(true, true) })).toBe(
      'items',
    );
  });
  it('loading while items load', () => {
    expect(resolveSprintScopeState({ ...base, itemsLoading: true, sprint: s(false, false) })).toBe(
      'loading',
    );
  });
  it('loading while sprint resolves', () => {
    expect(resolveSprintScopeState({ ...base, sprint: s(false, true) })).toBe('loading');
  });
  it('no-sprint when settled and no active sprint', () => {
    expect(resolveSprintScopeState({ ...base, sprint: s(true, false) })).toBe('no-sprint');
  });
  it('empty when settled with a sprint', () => {
    expect(resolveSprintScopeState({ ...base, sprint: s(false, false) })).toBe('empty');
  });
});

describe('NO_ACTIVE_SPRINT_SUBTITLE', () => {
  it('is the canonical sentence', () => {
    expect(NO_ACTIVE_SPRINT_SUBTITLE).toBe(
      'Start a sprint in Jira and its issues will appear here.',
    );
  });
});
