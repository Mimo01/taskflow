import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ApiLogEntry } from './debug-log.store';
import { useDebugLogStore } from './debug-log.store';

function makeEntry(id: string): ApiLogEntry {
  return {
    id,
    timestamp: new Date().toISOString(),
    source: 'jira',
    method: 'GET',
    url: 'https://example.com',
    requestHeaders: {},
    status: 200,
    durationMs: 100,
    responseBody: '{}',
  };
}

describe('debug-log.store', () => {
  beforeEach(() => {
    act(() => {
      useDebugLogStore.setState({ entries: [] });
    });
  });

  it('append adds an entry', () => {
    act(() => {
      useDebugLogStore.getState().append(makeEntry('entry-1'));
    });
    expect(useDebugLogStore.getState().entries).toHaveLength(1);
  });

  it('append prepends (newest first)', () => {
    act(() => {
      useDebugLogStore.getState().append(makeEntry('entry-1'));
      useDebugLogStore.getState().append(makeEntry('entry-2'));
    });
    const { entries } = useDebugLogStore.getState();
    expect(entries[0].id).toBe('entry-2');
    expect(entries[1].id).toBe('entry-1');
  });

  it('FIFO eviction at 200 entries', () => {
    act(() => {
      for (let i = 0; i < 201; i++) {
        useDebugLogStore.getState().append(makeEntry(`entry-${i}`));
      }
    });
    const { entries } = useDebugLogStore.getState();
    expect(entries).toHaveLength(200);
    // Newest entry should be first
    expect(entries[0].id).toBe('entry-200');
    // Oldest entry (entry-0) should have been evicted
    expect(entries.find((e) => e.id === 'entry-0')).toBeUndefined();
  });

  it('clear empties all entries', () => {
    act(() => {
      useDebugLogStore.getState().append(makeEntry('entry-1'));
      useDebugLogStore.getState().append(makeEntry('entry-2'));
    });
    act(() => {
      useDebugLogStore.getState().clear();
    });
    expect(useDebugLogStore.getState().entries).toHaveLength(0);
  });

  it("accepts 'updater' as a source value", () => {
    const entry: ApiLogEntry = {
      id: 'updater-entry-1',
      timestamp: new Date().toISOString(),
      source: 'updater',
      method: 'GET',
      url: 'tauri://updater/check',
      requestHeaders: {},
      status: 200,
      durationMs: 0,
      responseBody: 'Update check: up to date',
    };
    act(() => {
      useDebugLogStore.getState().append(entry);
    });
    const { entries } = useDebugLogStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('updater');
  });
});
