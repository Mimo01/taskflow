import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFilterStore } from './filter.store';

describe('filter.store', () => {
  beforeEach(() => {
    act(() => {
      useFilterStore.setState({
        activeEpics: new Set<string>(),
        activeLabels: new Set<string>(),
        activeAssignees: new Set<string>(),
        activeStatuses: new Set<string>(),
      });
    });
  });

  it('toggleEpic adds an epic', () => {
    act(() => {
      useFilterStore.getState().toggleEpic('Epic-1');
    });
    expect(useFilterStore.getState().activeEpics.has('Epic-1')).toBe(true);
  });

  it('toggleEpic twice removes the epic (toggle off)', () => {
    act(() => {
      useFilterStore.getState().toggleEpic('Epic-1');
    });
    act(() => {
      useFilterStore.getState().toggleEpic('Epic-1');
    });
    expect(useFilterStore.getState().activeEpics.has('Epic-1')).toBe(false);
    expect(useFilterStore.getState().activeEpics.size).toBe(0);
  });

  it('toggleLabel adds a label', () => {
    act(() => {
      useFilterStore.getState().toggleLabel('bug');
    });
    expect(useFilterStore.getState().activeLabels.has('bug')).toBe(true);
  });

  it('clearAll empties all Sets', () => {
    act(() => {
      useFilterStore.getState().toggleEpic('Epic-1');
      useFilterStore.getState().toggleLabel('bug');
      useFilterStore.getState().toggleAssignee('Alice');
      useFilterStore.getState().toggleStatus('open');
    });
    act(() => {
      useFilterStore.getState().clearAll();
    });
    const state = useFilterStore.getState();
    expect(state.activeEpics.size).toBe(0);
    expect(state.activeLabels.size).toBe(0);
    expect(state.activeAssignees.size).toBe(0);
    expect(state.activeStatuses.size).toBe(0);
  });

  it('applyQuickFilter populates all 4 Sets', () => {
    act(() => {
      useFilterStore.getState().applyQuickFilter({
        id: '1',
        name: 'QF',
        epics: ['E1'],
        labels: ['L1'],
        assignees: ['A1'],
        statuses: ['S1'],
      });
    });
    const state = useFilterStore.getState();
    expect(state.activeEpics.has('E1')).toBe(true);
    expect(state.activeLabels.has('L1')).toBe(true);
    expect(state.activeAssignees.has('A1')).toBe(true);
    expect(state.activeStatuses.has('S1')).toBe(true);
  });
});
