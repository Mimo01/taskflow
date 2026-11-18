import { describe, expect, it } from 'vitest';
import type { JiraFixVersion } from '@/services/jira/types';
import { orderFixVersions } from './fix-version-order';

const v = (id: string, released: boolean, releaseDate?: string, name = `v${id}`): JiraFixVersion =>
  ({ id, name, released, releaseDate }) as JiraFixVersion;

describe('orderFixVersions', () => {
  it('returns [] for empty/undefined', () => {
    expect(orderFixVersions([], new Set())).toEqual([]);
    expect(orderFixVersions(undefined, new Set())).toEqual([]);
  });

  it('puts unreleased first, undated before dated, dated desc', () => {
    const out = orderFixVersions(
      [
        v('1', true, '2026-01-01'),
        v('2', false, '2026-03-01'),
        v('3', false),
        v('4', false, '2026-05-01'),
      ],
      new Set(),
    );
    expect(out.map((x) => x.id)).toEqual(['3', '4', '2', '1']);
  });

  it('limits released to 10 recent plus selected older', () => {
    const rel = Array.from({ length: 12 }, (_, i) =>
      v(String(i), true, `2026-01-${String(i + 10).padStart(2, '0')}`),
    );
    const out = orderFixVersions(rel, new Set(['0']));
    expect(out).toHaveLength(11);
    expect(out.map((x) => x.id)).toContain('0');
    expect(out.map((x) => x.id)).not.toContain('1');
  });

  it('sorts undated released after dated', () => {
    const out = orderFixVersions([v('a', true), v('b', true, '2026-01-01')], new Set());
    expect(out.map((x) => x.id)).toEqual(['b', 'a']);
  });
});
