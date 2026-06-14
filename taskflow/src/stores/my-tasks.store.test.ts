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

import { useMyTasksStore } from './my-tasks.store';

describe('my-tasks.store', () => {
  beforeEach(() => {
    act(() => {
      useMyTasksStore.setState({ groupingMode: 'my-day', scope: 'current-sprint' });
    });
  });

  it('has default groupingMode of my-day (D-09)', () => {
    expect(useMyTasksStore.getState().groupingMode).toBe('my-day');
  });

  it('has default scope of current-sprint (D-09)', () => {
    expect(useMyTasksStore.getState().scope).toBe('current-sprint');
  });

  it('setGroupingMode updates groupingMode to by-status', () => {
    act(() => {
      useMyTasksStore.getState().setGroupingMode('by-status');
    });
    expect(useMyTasksStore.getState().groupingMode).toBe('by-status');
  });

  it('setGroupingMode updates groupingMode to by-sprint-parent', () => {
    act(() => {
      useMyTasksStore.getState().setGroupingMode('by-sprint-parent');
    });
    expect(useMyTasksStore.getState().groupingMode).toBe('by-sprint-parent');
  });

  it('setScope updates scope to all-assigned', () => {
    act(() => {
      useMyTasksStore.getState().setScope('all-assigned');
    });
    expect(useMyTasksStore.getState().scope).toBe('all-assigned');
  });

  it('setScope updates scope to all-reported (E2)', () => {
    act(() => {
      useMyTasksStore.getState().setScope('all-reported');
    });
    expect(useMyTasksStore.getState().scope).toBe('all-reported');
  });

  it('setState mutation persists — re-reading getState() returns the mutated value', () => {
    act(() => {
      useMyTasksStore.setState({ groupingMode: 'by-status', scope: 'all-assigned' });
    });
    expect(useMyTasksStore.getState().groupingMode).toBe('by-status');
    expect(useMyTasksStore.getState().scope).toBe('all-assigned');
  });

  it('activeFilter is NOT in store (D-01/D-10)', () => {
    // Verify the store has no activeFilter key — it must never be persisted
    expect('activeFilter' in useMyTasksStore.getState()).toBe(false);
  });
});
