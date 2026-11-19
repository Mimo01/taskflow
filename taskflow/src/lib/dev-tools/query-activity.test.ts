import { describe, expect, it } from 'vitest';
import { correlatedRequestIds, diffQueryActivity, type QuerySnap } from './query-activity';

const snap = (over: Partial<QuerySnap> = {}): QuerySnap => ({
  fetchStatus: 'idle',
  status: 'pending',
  isInvalidated: false,
  dataUpdatedAt: 0,
  errorUpdatedAt: 0,
  ...over,
});

describe('diffQueryActivity', () => {
  it('idle to fetching is a fetch', () => {
    expect(diffQueryActivity(snap(), snap({ fetchStatus: 'fetching' }))).toEqual(['fetch']);
  });

  it('fetching to idle with newer data is a success', () => {
    expect(
      diffQueryActivity(
        snap({ fetchStatus: 'fetching' }),
        snap({ status: 'success', dataUpdatedAt: 10 }),
      ),
    ).toEqual(['success']);
  });

  it('an error is reported once', () => {
    expect(
      diffQueryActivity(
        snap({ fetchStatus: 'fetching' }),
        snap({ status: 'error', errorUpdatedAt: 10 }),
      ),
    ).toEqual(['error']);
  });

  it('invalidation false to true is invalidated', () => {
    const ok = snap({ status: 'success', dataUpdatedAt: 5 });
    expect(diffQueryActivity(ok, { ...ok, isInvalidated: true })).toEqual(['invalidated']);
  });

  it('null is removed', () => {
    expect(diffQueryActivity(snap(), null)).toEqual(['removed']);
  });

  it('an unchanged snapshot gives nothing', () => {
    const s = snap({ status: 'success', dataUpdatedAt: 5 });
    expect(diffQueryActivity(s, { ...s })).toEqual([]);
  });

  it('an undefined prev with a fetching snapshot is a fetch', () => {
    expect(diffQueryActivity(undefined, snap({ fetchStatus: 'fetching' }))).toEqual(['fetch']);
  });
});

describe('correlatedRequestIds', () => {
  const at = (id: string, startedAt: number) => ({
    id,
    startedAt,
    timestamp: '2026-01-01T00:00:00.000Z',
  });

  it('includes starts within [t, t+150] and excludes the rest', () => {
    const ids = correlatedRequestIds(1000, [
      at('before', 999),
      at('at', 1000),
      at('edge', 1150),
      at('after', 1151),
    ]);
    expect([...ids].sort()).toEqual(['at', 'edge']);
  });
});
