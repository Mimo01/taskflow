import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri plugin-store so LazyStore doesn't attempt IPC calls in jsdom
vi.mock('@tauri-apps/plugin-store', () => {
  class LazyStore {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    save = vi.fn().mockResolvedValue(undefined);
    delete = vi.fn().mockResolvedValue(undefined);
  }
  return { LazyStore };
});

import type { TempoFilter } from './tempo-filters.store';
import { useTempoFiltersStore } from './tempo-filters.store';

const FILTER_A: TempoFilter = {
  id: 'f1',
  name: 'A',
  preset: 'this-week',
  username: 'alice',
  displayName: 'Alice',
};

const FILTER_B: TempoFilter = {
  id: 'f2',
  name: 'B',
  preset: 'this-month',
  username: null,
  displayName: null,
};

describe('tempo-filters.store', () => {
  beforeEach(() => {
    act(() => {
      useTempoFiltersStore.setState({ savedFilters: [] });
    });
  });

  it('addFilter appends a filter', () => {
    act(() => {
      useTempoFiltersStore.getState().addFilter(FILTER_A);
    });
    expect(useTempoFiltersStore.getState().savedFilters).toEqual([FILTER_A]);
  });

  it('addFilter called twice preserves insertion order', () => {
    act(() => {
      useTempoFiltersStore.getState().addFilter(FILTER_A);
      useTempoFiltersStore.getState().addFilter(FILTER_B);
    });
    expect(useTempoFiltersStore.getState().savedFilters).toEqual([FILTER_A, FILTER_B]);
  });

  it('removeFilter removes only the matching filter', () => {
    act(() => {
      useTempoFiltersStore.setState({ savedFilters: [FILTER_A, FILTER_B] });
    });
    act(() => {
      useTempoFiltersStore.getState().removeFilter('f1');
    });
    expect(useTempoFiltersStore.getState().savedFilters).toEqual([FILTER_B]);
  });

  it('removeFilter with a non-existent id leaves savedFilters unchanged', () => {
    act(() => {
      useTempoFiltersStore.setState({ savedFilters: [FILTER_A] });
    });
    act(() => {
      useTempoFiltersStore.getState().removeFilter('does-not-exist');
    });
    expect(useTempoFiltersStore.getState().savedFilters).toEqual([FILTER_A]);
  });

  it('renameFilter updates only the name field of the matching filter', () => {
    act(() => {
      useTempoFiltersStore.setState({ savedFilters: [FILTER_A, FILTER_B] });
    });
    act(() => {
      useTempoFiltersStore.getState().renameFilter('f1', 'New Name');
    });
    const filters = useTempoFiltersStore.getState().savedFilters;
    expect(filters[0]).toEqual({ ...FILTER_A, name: 'New Name' });
    expect(filters[1]).toEqual(FILTER_B);
  });

  it('renameFilter updates name to empty string', () => {
    act(() => {
      useTempoFiltersStore.setState({ savedFilters: [FILTER_A] });
    });
    act(() => {
      useTempoFiltersStore.getState().renameFilter('f1', '');
    });
    expect(useTempoFiltersStore.getState().savedFilters[0].name).toBe('');
    // Other fields remain unchanged
    expect(useTempoFiltersStore.getState().savedFilters[0].preset).toBe('this-week');
    expect(useTempoFiltersStore.getState().savedFilters[0].username).toBe('alice');
    expect(useTempoFiltersStore.getState().savedFilters[0].displayName).toBe('Alice');
  });
});
