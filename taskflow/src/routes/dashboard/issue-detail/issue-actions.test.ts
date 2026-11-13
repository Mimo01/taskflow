import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCloneInitialValues, buildEditInitialValues } from './issue-actions';

const issue = {
  id: '1',
  key: 'PROJ-1',
  fields: {
    summary: 'Hello',
    description: 'Desc',
    assignee: { name: 'al', displayName: 'Al', avatarUrls: { '48x48': 'http://a/48' } },
    priority: { name: 'Major' },
    story_points: 5,
    epic_link: 'EPIC-1',
    customfield_100: 'x',
    customfield_200: null,
    attachment: [{ id: 'a' }],
    issuelinks: [
      { type: { id: '10' }, outwardIssue: { key: 'PROJ-2' } },
      { type: { id: '11' }, inwardIssue: { key: 'PROJ-3' } },
    ],
  },
} as never;

describe('issue-actions', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('buildEditInitialValues maps the issue and collects non-null custom fields', () => {
    expect(buildEditInitialValues(issue, 'story_points', 'epic_link')).toEqual({
      issueKey: 'PROJ-1',
      summary: 'Hello',
      description: 'Desc',
      assigneeName: 'al',
      assigneeDisplayName: 'Al',
      assigneeAvatarUrl: 'http://a/48',
      priority: 'Major',
      storyPoints: 5,
      epicLinkKey: 'EPIC-1',
      customFields: { customfield_100: 'x' },
      attachments: [{ id: 'a' }],
    });
  });

  it('buildCloneInitialValues prefixes the summary and copies links with fresh ids', () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValueOnce('u1').mockReturnValueOnce('u2'),
    });
    const v = buildCloneInitialValues(issue, 'story_points', 'epic_link');
    expect(v.issueKey).toBe('');
    expect(v.summary).toBe('Clone - Hello');
    expect(v.linkRows).toEqual([
      { id: 'u1', linkTypeId: '10', issueKey: 'PROJ-2' },
      { id: 'u2', linkTypeId: '11', issueKey: 'PROJ-3' },
    ]);
  });
});
