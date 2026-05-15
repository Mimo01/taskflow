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

import { useAioCyclesSelectionStore } from './aio-cycles-selection.store';

describe('aio-cycles-selection.store', () => {
  beforeEach(() => {
    act(() => {
      useAioCyclesSelectionStore.setState({ byProjectKey: {} });
    });
  });

  it('getSelectedFolder returns null when no entry stored for that key', () => {
    const result = useAioCyclesSelectionStore.getState().getSelectedFolder('PROJ');
    expect(result).toBeNull();
  });

  it('setSelectedFolder then getSelectedFolder round-trips the id', () => {
    act(() => {
      useAioCyclesSelectionStore.getState().setSelectedFolder('PROJ', 101);
    });
    expect(useAioCyclesSelectionStore.getState().getSelectedFolder('PROJ')).toBe(101);
  });

  it('setSelectedFolder is per-project — setting key A does not affect key B', () => {
    act(() => {
      useAioCyclesSelectionStore.getState().setSelectedFolder('A', 5);
      useAioCyclesSelectionStore.getState().setSelectedFolder('B', 7);
    });
    expect(useAioCyclesSelectionStore.getState().getSelectedFolder('A')).toBe(5);
    expect(useAioCyclesSelectionStore.getState().getSelectedFolder('B')).toBe(7);
  });

  it('clearSelectedFolder removes only the targeted project key', () => {
    act(() => {
      useAioCyclesSelectionStore.getState().setSelectedFolder('A', 5);
      useAioCyclesSelectionStore.getState().setSelectedFolder('B', 7);
    });
    act(() => {
      useAioCyclesSelectionStore.getState().clearSelectedFolder('A');
    });
    expect(useAioCyclesSelectionStore.getState().getSelectedFolder('A')).toBeNull();
    expect(useAioCyclesSelectionStore.getState().getSelectedFolder('B')).toBe(7);
  });

  it('stores -1 as a valid value (regression guard for Ungrouped pseudo-folder)', () => {
    act(() => {
      useAioCyclesSelectionStore.getState().setSelectedFolder('PROJ', -1);
    });
    expect(useAioCyclesSelectionStore.getState().getSelectedFolder('PROJ')).toBe(-1);
  });
});
