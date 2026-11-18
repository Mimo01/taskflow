import { describe, expect, it } from 'vitest';
import { buildInitialState, formReducer } from './useCreateEditForm';

describe('formReducer HYDRATE / RESET_KEEP', () => {
  it('HYDRATE merges given keys only', () => {
    const base = { ...buildInitialState(), priority: 'High' };
    const next = formReducer(base, { type: 'HYDRATE', state: { summary: 'S', labels: ['a'] } });
    expect(next.summary).toBe('S');
    expect(next.labels).toEqual(['a']);
    expect(next.priority).toBe('High');
  });

  it('RESET_KEEP returns defaults overlaid with keep', () => {
    const dirty = {
      ...buildInitialState(),
      summary: 'x',
      description: 'd',
      storyPoints: '3',
      timeEstimate: '2h',
      apiError: 'boom',
    };
    const next = formReducer(dirty, {
      type: 'RESET_KEEP',
      keep: { priority: 'High', labels: ['x'] },
    });
    expect(next).toEqual({ ...buildInitialState(), priority: 'High', labels: ['x'] });
    expect(next.summary).toBe('');
    expect(next.apiError).toBeNull();
  });
});

describe('buildInitialState labels / fixVersions', () => {
  it('seeds from initialValues', () => {
    const s = buildInitialState(undefined, undefined, {
      issueKey: 'A-1',
      summary: '',
      description: '',
      assigneeName: null,
      priority: null,
      storyPoints: null,
      epicLinkKey: null,
      labels: ['a'],
      fixVersions: [{ id: '1', name: '1.0' }],
    });
    expect(s.labels).toEqual(['a']);
    expect(s.fixVersions).toEqual([{ id: '1', name: '1.0' }]);
  });
  it('defaults to empty', () => {
    const s = buildInitialState();
    expect(s.labels).toEqual([]);
    expect(s.fixVersions).toEqual([]);
  });
});
