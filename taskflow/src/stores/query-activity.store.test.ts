import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsStore } from './settings.store';
import { type QueryActivityEvent, useQueryActivityStore } from './query-activity.store';

const ev = (id: string): QueryActivityEvent => ({
  id,
  at: 1,
  kind: 'fetch',
  queryHash: 'h',
  keyLabel: 'k',
});

describe('query-activity.store', () => {
  beforeEach(() => {
    act(() => {
      useQueryActivityStore.getState().clear();
      useSettingsStore.setState({ retentionLimit: 3 });
    });
  });

  it('append prepends (newest first)', () => {
    act(() => {
      useQueryActivityStore.getState().append(ev('a'));
      useQueryActivityStore.getState().append(ev('b'));
    });
    expect(useQueryActivityStore.getState().events.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('evicts the oldest at the retention limit', () => {
    act(() => {
      for (const id of ['a', 'b', 'c', 'd']) useQueryActivityStore.getState().append(ev(id));
    });
    expect(useQueryActivityStore.getState().events.map((e) => e.id)).toEqual(['d', 'c', 'b']);
  });

  it('clear empties the store', () => {
    act(() => {
      useQueryActivityStore.getState().append(ev('a'));
      useQueryActivityStore.getState().clear();
    });
    expect(useQueryActivityStore.getState().events).toHaveLength(0);
  });
});
