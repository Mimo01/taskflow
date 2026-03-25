import { describe, expect, it } from 'vitest';
import type { JiraComment } from './jira';
import type { JiraWorklog } from './jira/types';
import {
  type ChangelogHistory,
  countByType,
  filterTimeline,
  mergeTimeline,
} from './jira-changelog';

const comment1: JiraComment = {
  id: 'c1',
  author: { displayName: 'Alice' },
  body: 'First comment',
  created: '2026-03-20T10:00:00.000+0000',
  updated: '2026-03-20T10:00:00.000+0000',
};

const comment2: JiraComment = {
  id: 'c2',
  author: { displayName: 'Bob' },
  body: 'Second comment',
  created: '2026-03-20T14:00:00.000+0000',
  updated: '2026-03-20T14:00:00.000+0000',
};

const history1: ChangelogHistory = {
  id: 'h1',
  created: '2026-03-20T12:00:00.000+0000',
  author: { displayName: 'Alice' },
  items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }],
};

const worklog1: JiraWorklog = {
  id: 'w1',
  author: { displayName: 'Charlie' },
  timeSpent: '2h',
  timeSpentSeconds: 7200,
  started: '2026-03-20T11:00:00.000+0000',
  created: '2026-03-20T11:30:00.000+0000',
  updated: '2026-03-20T11:30:00.000+0000',
  comment: 'Fixed the bug',
};

const worklog2: JiraWorklog = {
  id: 'w2',
  author: { displayName: 'Alice' },
  timeSpent: '30m',
  timeSpentSeconds: 1800,
  started: '2026-03-20T15:00:00.000+0000',
  created: '2026-03-20T15:30:00.000+0000',
  updated: '2026-03-20T15:30:00.000+0000',
};

describe('jira-changelog', () => {
  describe('mergeTimeline', () => {
    it('merges comments and histories sorted by timestamp (newest first)', () => {
      const result = mergeTimeline([comment1, comment2], [history1]);
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('comment');
      expect(result[0].timestamp).toBe('2026-03-20T14:00:00.000+0000');
      expect(result[1].type).toBe('change');
      expect(result[2].type).toBe('comment');
    });

    it('includes worklogs sorted by started timestamp', () => {
      const result = mergeTimeline([comment1], [history1], [worklog1, worklog2]);
      expect(result).toHaveLength(4);
      // Order: worklog2 (15:00) > history1 (12:00) > worklog1 (11:00) > comment1 (10:00)
      expect(result[0].type).toBe('worklog');
      expect(result[0].data).toBe(worklog2);
      expect(result[1].type).toBe('change');
      expect(result[2].type).toBe('worklog');
      expect(result[2].data).toBe(worklog1);
      expect(result[3].type).toBe('comment');
    });

    it('works with empty worklogs array (backward compatible)', () => {
      const result = mergeTimeline([comment1], [history1]);
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.type !== 'worklog')).toBe(true);
    });

    it('handles all empty arrays', () => {
      const result = mergeTimeline([], [], []);
      expect(result).toEqual([]);
    });
  });

  describe('filterTimeline', () => {
    const allEntries = mergeTimeline([comment1, comment2], [history1], [worklog1]);

    it('returns all entries with "all" filter', () => {
      expect(filterTimeline(allEntries, 'all')).toHaveLength(4);
    });

    it('filters to comments only', () => {
      const filtered = filterTimeline(allEntries, 'comment');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.type === 'comment')).toBe(true);
    });

    it('filters to changes only', () => {
      const filtered = filterTimeline(allEntries, 'change');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('change');
    });

    it('filters to worklogs only', () => {
      const filtered = filterTimeline(allEntries, 'worklog');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('worklog');
    });
  });

  describe('countByType', () => {
    it('counts entries by type', () => {
      const entries = mergeTimeline([comment1, comment2], [history1], [worklog1, worklog2]);
      const counts = countByType(entries);
      expect(counts).toEqual({
        all: 5,
        comment: 2,
        change: 1,
        worklog: 2,
      });
    });

    it('returns zeros for empty timeline', () => {
      expect(countByType([])).toEqual({
        all: 0,
        comment: 0,
        change: 0,
        worklog: 0,
      });
    });
  });
});
