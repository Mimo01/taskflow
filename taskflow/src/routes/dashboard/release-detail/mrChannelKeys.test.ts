// WR-06: the query sites (useReleaseDetail) and the prefix-scoped optimistic
// patch/invalidate (useMrFixMutation) must key on the same strings. When those
// were independent literals, a rename at one end turned the other into a
// silent no-op with no type error and no failing test. These tests assert the
// structural contract that makes the prefix match work, without re-hard-coding
// the literals a third time.

import { describe, expect, it } from 'vitest';
import { MR_CHANNEL_QUERY_PREFIXES, mrChannelKeys } from './mrChannelKeys';

const PROJECT_ID = 42;

describe('mrChannelKeys', () => {
  it('every windowed key starts with a prefix that MR_CHANNEL_QUERY_PREFIXES contains', () => {
    const windowedKeys = [
      mrChannelKeys.allProject(PROJECT_ID, '2026-01-01T00:00:00.000Z'),
      mrChannelKeys.milestone(PROJECT_ID, '33.5.0 (21.07.2026)'),
      mrChannelKeys.branch(PROJECT_ID, 'release/33.5.0'),
    ];

    expect(windowedKeys).toHaveLength(MR_CHANNEL_QUERY_PREFIXES.length);
    for (const key of windowedKeys) {
      expect(MR_CHANNEL_QUERY_PREFIXES).toContain(key[0]);
    }
    // Each prefix is used by exactly one query site — no two channels collide.
    expect(new Set(windowedKeys.map((k) => k[0])).size).toBe(MR_CHANNEL_QUERY_PREFIXES.length);
  });

  it('a windowed key is prefix-matched by its own project-granular key (what setQueriesData relies on)', () => {
    const windowedKeys = [
      mrChannelKeys.allProject(PROJECT_ID, '2026-01-01T00:00:00.000Z'),
      mrChannelKeys.milestone(PROJECT_ID, '33.5.0 (21.07.2026)'),
      mrChannelKeys.branch(PROJECT_ID, 'release/33.5.0'),
    ];

    for (const key of windowedKeys) {
      const prefixKey = mrChannelKeys.channelForProject(key[0], PROJECT_ID);
      expect(prefixKey).toHaveLength(2);
      expect(key.slice(0, 2)).toEqual([...prefixKey]);
    }
  });

  it('keys for different projects never prefix-match each other', () => {
    expect(mrChannelKeys.channelForProject('gitlab-branch-mrs', 1)).not.toEqual(
      mrChannelKeys.channelForProject('gitlab-branch-mrs', 2),
    );
  });

  it('an unset project keeps a distinct key rather than collapsing onto project 0', () => {
    expect(mrChannelKeys.allProject(null, 'w')).not.toEqual(mrChannelKeys.allProject(0, 'w'));
    expect(mrChannelKeys.allProject(undefined, 'w')).not.toEqual(mrChannelKeys.allProject(0, 'w'));
  });
});
