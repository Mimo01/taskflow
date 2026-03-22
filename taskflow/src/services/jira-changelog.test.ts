import { describe, it, expect } from 'vitest';
import { mergeTimeline, filterTimeline, countByType } from './jira-changelog';
import type { TimelineEntry } from './jira-changelog';
import type { JiraComment } from './jira';

// Helper factories
function makeComment(overrides: Partial<JiraComment> = {}): JiraComment {
  return {
    id: '1',
    author: { displayName: 'Alice' },
    body: 'A comment',
    created: '2024-01-02T12:00:00.000Z',
    updated: '2024-01-02T12:00:00.000Z',
    ...overrides,
  };
}

function makeHistory(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    created: '2024-01-01T12:00:00.000Z',
    author: { displayName: 'Bob' },
    items: [{ field: 'status', fieldtype: 'jira', from: null, fromString: 'Open', to: null, toString: 'In Progress' }],
    ...overrides,
  };
}

describe('mergeTimeline', () => {
  it('merges comments and histories sorted newest-first', () => {
    const comments = [makeComment({ created: '2024-01-02T12:00:00.000Z' })];
    const histories = [makeHistory({ created: '2024-01-01T12:00:00.000Z' })];
    const result = mergeTimeline(comments, histories);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('comment');
    expect(result[1].type).toBe('change');
  });

  it('returns only change entries when comments are empty', () => {
    const histories = [makeHistory()];
    const result = mergeTimeline([], histories);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('change');
  });

  it('returns only comment entries when histories are empty', () => {
    const comments = [makeComment()];
    const result = mergeTimeline(comments, []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('comment');
  });

  it('returns empty array when both are empty', () => {
    const result = mergeTimeline([], []);
    expect(result).toHaveLength(0);
  });

  it('keeps multiple items grouped in one history entry (one TimelineEntry per history)', () => {
    const history = makeHistory({
      items: [
        { field: 'status', fieldtype: 'jira', from: null, fromString: 'Open', to: null, toString: 'Done' },
        { field: 'assignee', fieldtype: 'jira', from: null, fromString: 'Alice', to: null, toString: 'Bob' },
      ],
    });
    const result = mergeTimeline([], [history]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('change');
    // Access items through the data property
    const entry = result[0] as Extract<TimelineEntry, { type: 'change' }>;
    expect(entry.data.items).toHaveLength(2);
  });

  it('maintains stable sort order for identical timestamps', () => {
    const ts = '2024-01-01T12:00:00.000Z';
    const comments = [makeComment({ id: 'c1', created: ts }), makeComment({ id: 'c2', created: ts })];
    const histories = [makeHistory({ id: 'h1', created: ts })];
    const result = mergeTimeline(comments, histories);
    expect(result).toHaveLength(3);
    // All have the same timestamp — no crash, all present
    const types = result.map(e => e.type);
    expect(types.filter(t => t === 'comment')).toHaveLength(2);
    expect(types.filter(t => t === 'change')).toHaveLength(1);
  });
});

describe('filterTimeline', () => {
  const entries: TimelineEntry[] = [
    { type: 'comment', timestamp: '2024-01-02T12:00:00.000Z', data: makeComment() },
    { type: 'change', timestamp: '2024-01-01T12:00:00.000Z', data: makeHistory() },
  ];

  it('returns only comments when filter is "comment"', () => {
    const result = filterTimeline(entries, 'comment');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('comment');
  });

  it('returns only changes when filter is "change"', () => {
    const result = filterTimeline(entries, 'change');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('change');
  });

  it('returns all entries when filter is "all"', () => {
    const result = filterTimeline(entries, 'all');
    expect(result).toHaveLength(2);
  });
});

describe('countByType', () => {
  it('counts entries by type correctly', () => {
    const entries: TimelineEntry[] = [
      { type: 'comment', timestamp: '2024-01-03T00:00:00Z', data: makeComment() },
      { type: 'comment', timestamp: '2024-01-02T00:00:00Z', data: makeComment({ id: '2' }) },
      { type: 'change', timestamp: '2024-01-01T00:00:00Z', data: makeHistory() },
    ];
    const result = countByType(entries);
    expect(result).toEqual({ all: 3, comment: 2, change: 1 });
  });

  it('returns zeros for empty array', () => {
    expect(countByType([])).toEqual({ all: 0, comment: 0, change: 0 });
  });
});
