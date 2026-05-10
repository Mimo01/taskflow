import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSavedFilterStore } from './saved-filter.store';

const FILTER_A = { id: 'f1', name: 'Open Bugs', jql: 'type = Bug AND status = Open' };
const FILTER_B = { id: 'f2', name: 'My Issues', jql: 'assignee = currentUser()' };

describe('saved-filter.store', () => {
  beforeEach(() => {
    act(() => {
      useSavedFilterStore.setState({
        savedFilters: [],
        activeFilterId: null,
        isLoading: false,
      });
    });
  });

  it('initial state has empty list, null activeFilterId, and isLoading false', () => {
    const s = useSavedFilterStore.getState();
    expect(s.savedFilters).toEqual([]);
    expect(s.activeFilterId).toBeNull();
    expect(s.isLoading).toBe(false);
  });

  it('setSavedFilters replaces the full list', () => {
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A, FILTER_B]));
    expect(useSavedFilterStore.getState().savedFilters).toEqual([FILTER_A, FILTER_B]);
  });

  it('setSavedFilters with empty array clears the list', () => {
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A]));
    act(() => useSavedFilterStore.getState().setSavedFilters([]));
    expect(useSavedFilterStore.getState().savedFilters).toEqual([]);
  });

  it('addSavedFilter appends a filter to the existing list', () => {
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A]));
    act(() => useSavedFilterStore.getState().addSavedFilter(FILTER_B));
    expect(useSavedFilterStore.getState().savedFilters).toEqual([FILTER_A, FILTER_B]);
  });

  it('updateSavedFilter replaces the matching filter by ID', () => {
    const updated = { ...FILTER_A, name: 'Renamed' };
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A, FILTER_B]));
    act(() => useSavedFilterStore.getState().updateSavedFilter('f1', updated));
    const filters = useSavedFilterStore.getState().savedFilters;
    expect(filters[0]).toEqual(updated);
    expect(filters[1]).toEqual(FILTER_B);
  });

  it('updateSavedFilter leaves list unchanged when ID does not match', () => {
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A]));
    act(() =>
      useSavedFilterStore
        .getState()
        .updateSavedFilter('unknown', { id: 'unknown', name: 'X', jql: '' }),
    );
    expect(useSavedFilterStore.getState().savedFilters).toEqual([FILTER_A]);
  });

  it('removeSavedFilter removes the filter from the list', () => {
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A, FILTER_B]));
    act(() => useSavedFilterStore.getState().removeSavedFilter('f1'));
    expect(useSavedFilterStore.getState().savedFilters).toEqual([FILTER_B]);
  });

  it('removeSavedFilter clears activeFilterId when the active filter is removed', () => {
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A, FILTER_B]));
    act(() => useSavedFilterStore.getState().setActiveFilter('f1'));
    act(() => useSavedFilterStore.getState().removeSavedFilter('f1'));
    expect(useSavedFilterStore.getState().activeFilterId).toBeNull();
    expect(useSavedFilterStore.getState().savedFilters).toEqual([FILTER_B]);
  });

  it('removeSavedFilter preserves activeFilterId when a different filter is removed', () => {
    act(() => useSavedFilterStore.getState().setSavedFilters([FILTER_A, FILTER_B]));
    act(() => useSavedFilterStore.getState().setActiveFilter('f1'));
    act(() => useSavedFilterStore.getState().removeSavedFilter('f2'));
    expect(useSavedFilterStore.getState().activeFilterId).toBe('f1');
  });

  it('setActiveFilter sets the active filter ID', () => {
    act(() => useSavedFilterStore.getState().setActiveFilter('f1'));
    expect(useSavedFilterStore.getState().activeFilterId).toBe('f1');
  });

  it('setActiveFilter(null) clears the active filter', () => {
    act(() => useSavedFilterStore.getState().setActiveFilter('f1'));
    act(() => useSavedFilterStore.getState().setActiveFilter(null));
    expect(useSavedFilterStore.getState().activeFilterId).toBeNull();
  });

  it('setLoading(true) sets isLoading to true', () => {
    act(() => useSavedFilterStore.getState().setLoading(true));
    expect(useSavedFilterStore.getState().isLoading).toBe(true);
  });

  it('setLoading(false) sets isLoading back to false', () => {
    act(() => useSavedFilterStore.getState().setLoading(true));
    act(() => useSavedFilterStore.getState().setLoading(false));
    expect(useSavedFilterStore.getState().isLoading).toBe(false);
  });
});
