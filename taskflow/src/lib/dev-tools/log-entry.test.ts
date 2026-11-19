import { afterEach, describe, expect, it } from 'vitest';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { currentRoute, entryEnd, entryStart, entryState, isPending } from './log-entry';

const base: ApiLogEntry = {
  id: 'a',
  timestamp: '2026-01-01T00:00:00.000Z',
  source: 'jira',
  method: 'GET',
  url: 'https://x/y',
  requestHeaders: {},
  status: 200,
  durationMs: 50,
  responseBody: '',
};

describe('log-entry', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('entryState prefers explicit state, else derives from status', () => {
    expect(entryState({ ...base, state: 'pending', status: null })).toBe('pending');
    expect(entryState({ ...base, status: null })).toBe('error');
    expect(entryState(base)).toBe('done');
    expect(isPending({ ...base, state: 'pending' })).toBe(true);
  });

  it('entryStart falls back to the timestamp', () => {
    expect(entryStart(base)).toBe(Date.parse(base.timestamp));
    expect(entryStart({ ...base, startedAt: 12.5 })).toBe(12.5);
  });

  it('entryEnd uses endedAt, then now while pending, then start + duration', () => {
    expect(entryEnd({ ...base, startedAt: 10, endedAt: 99 }, 500)).toBe(99);
    expect(entryEnd({ ...base, startedAt: 10, state: 'pending', status: null }, 500)).toBe(500);
    expect(entryEnd({ ...base, startedAt: 10 }, 500)).toBe(60);
  });

  it('currentRoute strips # and the query', () => {
    window.location.hash = '#/dashboard?x=1';
    expect(currentRoute()).toBe('/dashboard');
    window.location.hash = '';
    expect(currentRoute()).toBe('/');
  });
});
