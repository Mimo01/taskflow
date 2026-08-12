// RECENT-01 / Phase 20: recent-items store — pushItem, dedup, 10-item cap

import { act, renderHook } from '@testing-library/react';
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

import { useRecentItemsStore } from './recent-items.store';

describe('recent-items.store (Phase 20)', () => {
  beforeEach(() => {
    act(() => {
      useRecentItemsStore.setState({ items: [] });
    });
  });

  it('items array starts empty', () => {
    const { result } = renderHook(() => useRecentItemsStore());
    expect(result.current.items).toEqual([]);
  });

  it('pushItem adds an item to the front of the list', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      result.current.pushItem({ type: 'jira', id: 'PROJ-1' });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].type).toBe('jira');
    expect(result.current.items[0].id).toBe('PROJ-1');
    expect(typeof result.current.items[0].timestamp).toBe('number');
  });

  it('pushItem deduplicates — same type + id replaces existing and moves to front', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      result.current.pushItem({ type: 'jira', id: 'PROJ-1' });
      result.current.pushItem({ type: 'jira', id: 'PROJ-2' });
      result.current.pushItem({ type: 'jira', id: 'PROJ-1' }); // duplicate
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe('PROJ-1'); // moved to front
    expect(result.current.items[1].id).toBe('PROJ-2');
  });

  it('pushItem caps at 10 items — 11th push drops the oldest', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      for (let i = 1; i <= 11; i++) {
        result.current.pushItem({ type: 'jira', id: `PROJ-${i}` });
      }
    });

    expect(result.current.items).toHaveLength(10);
    // PROJ-11 is newest (front), PROJ-1 was dropped (oldest)
    expect(result.current.items[0].id).toBe('PROJ-11');
    expect(result.current.items[9].id).toBe('PROJ-2');
    // PROJ-1 should not be present
    expect(result.current.items.find((i) => i.id === 'PROJ-1')).toBeUndefined();
  });

  it('GitLab items preserve the url field', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      result.current.pushItem({
        type: 'gitlab',
        id: '42',
        url: 'https://gitlab.com/org/repo/-/merge_requests/42',
      });
    });

    expect(result.current.items[0].type).toBe('gitlab');
    expect(result.current.items[0].id).toBe('42');
    expect(result.current.items[0].url).toBe('https://gitlab.com/org/repo/-/merge_requests/42');
  });

  it('pushItem with issueType stores that value on the item', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      result.current.pushItem({ type: 'jira', id: 'PROJ-1', issueType: 'Bug' });
    });

    expect(result.current.items[0].issueType).toBe('Bug');
  });

  it('pushItem for an existing item without issueType preserves the previously stored issueType', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      result.current.pushItem({ type: 'jira', id: 'PROJ-1', issueType: 'Bug' });
      result.current.pushItem({ type: 'jira', id: 'PROJ-1' });
    });

    expect(result.current.items[0].issueType).toBe('Bug');
  });

  it('pushItem for an existing item with a new issueType overwrites the stored one', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      result.current.pushItem({ type: 'jira', id: 'PROJ-1', issueType: 'Bug' });
      result.current.pushItem({ type: 'jira', id: 'PROJ-1', issueType: 'Story' });
    });

    expect(result.current.items[0].issueType).toBe('Story');
  });

  it('items pushed without issueType leave the field undefined', () => {
    const { result } = renderHook(() => useRecentItemsStore());

    act(() => {
      result.current.pushItem({ type: 'jira', id: 'PROJ-1' });
    });

    expect(result.current.items[0].issueType).toBeUndefined();
  });
});
