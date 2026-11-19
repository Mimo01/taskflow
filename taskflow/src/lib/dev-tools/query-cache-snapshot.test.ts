import { describe, expect, it } from 'vitest';
import {
  type CacheRow,
  filterCacheRows,
  formatQueryKey,
  type QueryLike,
  toCacheRow,
} from './query-cache-snapshot';

function fakeQuery(p: {
  hash?: string;
  key?: readonly unknown[];
  status?: 'pending' | 'error' | 'success';
  fetchStatus?: 'fetching' | 'paused' | 'idle';
  observers?: number;
  staleByTime?: boolean;
  invalidated?: boolean;
  dataUpdatedAt?: number;
  errorUpdatedAt?: number;
  error?: Error | null;
}): QueryLike {
  return {
    queryHash: p.hash ?? 'h',
    queryKey: p.key ?? ['a'],
    state: {
      status: p.status ?? 'success',
      fetchStatus: p.fetchStatus ?? 'idle',
      dataUpdatedAt: p.dataUpdatedAt ?? 1000,
      errorUpdatedAt: p.errorUpdatedAt ?? 0,
      isInvalidated: p.invalidated ?? false,
      error: p.error ?? null,
      data: undefined,
      dataUpdateCount: 1,
      fetchFailureCount: 0,
    },
    options: { gcTime: Number.POSITIVE_INFINITY },
    getObserversCount: () => p.observers ?? 0,
    isActive: () => (p.observers ?? 0) > 0,
    isDisabled: () => false,
    isStaleByTime: () => p.staleByTime ?? false,
  };
}

describe('formatQueryKey', () => {
  it('joins parts with a separator and JSON-encodes objects', () => {
    expect(formatQueryKey(['issue', 'ABC-1', { expand: 'x' }])).toBe(
      'issue › ABC-1 › {"expand":"x"}',
    );
  });

  it('renders undefined explicitly', () => {
    expect(formatQueryKey(['a', undefined])).toBe('a › undefined');
  });

  it('ellipsises labels over 160 chars', () => {
    const label = formatQueryKey(['x'.repeat(300)]);
    expect(label.length).toBe(160);
    expect(label.endsWith('…')).toBe(true);
  });
});

describe('toCacheRow', () => {
  it('copies plain fields', () => {
    const row = toCacheRow(fakeQuery({ observers: 2, key: ['issue', 'A'] }), 0, 5000);
    expect(row).toMatchObject({
      hash: 'h',
      keyLabel: 'issue › A',
      status: 'success',
      fetchStatus: 'idle',
      observers: 2,
      active: true,
      invalidated: false,
      error: null,
    });
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
  });

  it('carries errorUpdatedAt and the snapshot time for live relative times', () => {
    const row = toCacheRow(fakeQuery({ errorUpdatedAt: 4321 }), 0, 9999);
    expect(row.errorUpdatedAt).toBe(4321);
    expect(row.snapshotAt).toBe(9999);
  });

  it('stale for unobserved queries uses isStaleByTime', () => {
    expect(toCacheRow(fakeQuery({ staleByTime: true }), 300000, 0).stale).toBe(true);
    expect(toCacheRow(fakeQuery({ staleByTime: false }), 300000, 0).stale).toBe(false);
  });

  it('invalidated and errored queries carry their flags and message', () => {
    const row = toCacheRow(
      fakeQuery({ invalidated: true, status: 'error', error: new Error('boom') }),
      0,
      0,
    );
    expect(row.invalidated).toBe(true);
    expect(row.error).toBe('boom');
  });
});

describe('filterCacheRows', () => {
  const mk = (p: Partial<CacheRow>): CacheRow => ({
    ...toCacheRow(fakeQuery({}), 0, 0),
    ...p,
  });
  const rows = [
    mk({ hash: '1', keyLabel: 'issue › A', fetchStatus: 'fetching', observers: 1 }),
    mk({ hash: '2', keyLabel: 'mr › 5', stale: true }),
    mk({ hash: '3', keyLabel: 'issue › B', status: 'error', error: 'x' }),
    mk({ hash: '4', keyLabel: 'misc', invalidated: true }),
  ];

  it('all + search', () => {
    expect(filterCacheRows(rows, { search: '', state: 'all' })).toHaveLength(4);
    expect(filterCacheRows(rows, { search: 'ISSUE', state: 'all' }).map((r) => r.hash)).toEqual([
      '1',
      '3',
    ]);
  });

  it('state filters', () => {
    const ids = (state: string) => filterCacheRows(rows, { search: '', state }).map((r) => r.hash);
    expect(ids('fetching')).toEqual(['1']);
    expect(ids('stale')).toEqual(['2']);
    expect(ids('error')).toEqual(['3']);
    expect(ids('inactive')).toEqual(['2', '3', '4']);
    expect(ids('invalidated')).toEqual(['4']);
  });
});
