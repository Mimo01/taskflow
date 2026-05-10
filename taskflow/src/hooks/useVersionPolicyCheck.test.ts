import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/build-info', () => ({
  buildInfo: { version: '1.2.0', commitSha: 'abc', buildDate: '2026-01-01' },
}));

vi.mock('@/stores/settings.store', () => ({
  useSettingsStore: (selector: (s: { updateCheckInterval: number | 'manual' }) => unknown) =>
    selector({ updateCheckInterval: 6 }),
}));

// Mock useQuery to return a controlled policy value
let mockedPolicy: { softMinimum: string; hardMinimum: string } | null = null;

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: mockedPolicy })),
}));

// fetchVersionPolicy and isBelow are mocked at module level — use real isBelow
vi.mock('@/services/versionPolicy', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/versionPolicy')>();
  return {
    ...real,
    fetchVersionPolicy: vi.fn(),
  };
});

import { useVersionPolicyCheck } from './useVersionPolicyCheck';

describe('useVersionPolicyCheck', () => {
  it('returns both flags false when policy is null (fail-open)', () => {
    mockedPolicy = null;
    const { result } = renderHook(() => useVersionPolicyCheck());
    expect(result.current.softMinimumActive).toBe(false);
    expect(result.current.hardMinimumActive).toBe(false);
    expect(result.current.policy).toBeNull();
  });

  it('hardMinimumActive is true when current version is below hardMinimum', () => {
    // current=1.2.0, hardMinimum=1.3.0, softMinimum=1.1.0
    mockedPolicy = { softMinimum: '1.1.0', hardMinimum: '1.3.0' };
    const { result } = renderHook(() => useVersionPolicyCheck());
    expect(result.current.hardMinimumActive).toBe(true);
    // soft is false because hardMinimumActive excludes it
    expect(result.current.softMinimumActive).toBe(false);
  });

  it('softMinimumActive is true when version is between soft and hard thresholds', () => {
    // current=1.2.0, softMinimum=1.3.0 (below), hardMinimum=1.0.0 (above — no hard enforcement)
    mockedPolicy = { softMinimum: '1.3.0', hardMinimum: '1.0.0' };
    const { result } = renderHook(() => useVersionPolicyCheck());
    expect(result.current.softMinimumActive).toBe(true);
    expect(result.current.hardMinimumActive).toBe(false);
  });

  it('both flags false when version meets both minimums', () => {
    // current=1.2.0, both minimums at or below current
    mockedPolicy = { softMinimum: '1.1.0', hardMinimum: '1.0.0' };
    const { result } = renderHook(() => useVersionPolicyCheck());
    expect(result.current.softMinimumActive).toBe(false);
    expect(result.current.hardMinimumActive).toBe(false);
  });

  it('softMinimumActive is false when also below hardMinimum (mutual exclusion)', () => {
    // current=1.2.0 is below BOTH soft=1.4.0 and hard=1.3.0
    // hard fires first; soft clause has && !hardMinimumActive so soft stays false
    mockedPolicy = { softMinimum: '1.4.0', hardMinimum: '1.3.0' };
    const { result } = renderHook(() => useVersionPolicyCheck());
    expect(result.current.hardMinimumActive).toBe(true);
    expect(result.current.softMinimumActive).toBe(false);
  });
});
