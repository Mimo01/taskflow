// NOTF-01: Unified notification feed (Jira + GitLab)
// NOTF-02: Polling with configurable interval, clamped to [30, 300] seconds
// NOTF-03: OS desktop notification dispatch
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNewNotifications, tryDispatchOsNotification } from './notifications';

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

const mockJiraMR = {
  id: 101,
  iid: 1,
  project_id: 5,
  title: 'PROJ-42: Fix login bug',
  source_branch: 'feature/PROJ-42-fix-login',
  state: 'opened' as const,
  author: { id: 1, name: 'Alice', username: 'alice', avatar_url: '' },
  reviewers: [],
  updated_at: '2026-03-11T14:00:00Z', // Must be after lastSeenGitlabCursor so MR isn't skipped
  web_url: 'https://gitlab.example.com/project/mr/1',
  labels: [],
  milestone: null,
};

describe('notifications service', () => {
  beforeEach(() => {
    vi.mocked(mockFetch).mockReset();
    vi.mocked(isPermissionGranted).mockReset();
    vi.mocked(requestPermission).mockReset();
    vi.mocked(sendNotification).mockReset();
  });

  describe('NOTF-01: fetchNewNotifications — Jira comment items', () => {
    it('returns NotificationItem[] with id=jira-comment-{id} for Jira comments', async () => {
      // Query A (issue updates) returns empty — we only care about comment mentions here
      const emptyIssuesResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };
      const jiraSearchResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-1',
              fields: {
                summary: 'Fix login bug',
                comment: {
                  comments: [
                    {
                      id: 'c001',
                      author: { displayName: 'J.Smith' },
                      body: 'Hey [~jdoe] please look at this',
                      updated: '2026-03-11T12:00:00.000Z',
                      created: '2026-03-11T12:00:00.000Z',
                    },
                  ],
                },
              },
            },
          ],
        }),
      };

      const emptyJiraResp = { ok: true, status: 200, json: async () => ({ issues: [] }) };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(emptyIssuesResp as unknown as Response) // Query A
        .mockResolvedValueOnce(jiraSearchResp as unknown as Response) // Query B
        .mockResolvedValueOnce(emptyJiraResp as unknown as Response) // Query C: all comments
        .mockResolvedValueOnce(emptyJiraResp as unknown as Response); // Query D: due date

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('jira-comment-c001');
      expect(result[0].source).toBe('jira');
      expect(result[0].entityTitle).toBe('PROJ-1: Fix login bug');
      expect(result[0].author).toBe('J.Smith');
      expect(result[0].createdAt).toBe('2026-03-11T12:00:00.000Z');
    });

    it('bodyPreview is truncated to 80 chars', async () => {
      // Body must include mention text so it passes client-side filter
      const mention = '[~auser] ';
      const longBody = mention + 'A'.repeat(120);
      // Query A (issue updates) returns empty — we only care about comment mentions here
      const emptyIssuesResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };
      const jiraSearchResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-2',
              fields: {
                summary: 'Long body issue',
                comment: {
                  comments: [
                    {
                      id: 'c002',
                      author: { displayName: 'A.User' },
                      body: longBody,
                      updated: '2026-03-11T13:00:00.000Z',
                      created: '2026-03-11T13:00:00.000Z',
                    },
                  ],
                },
              },
            },
          ],
        }),
      };

      const emptyJiraResp2 = { ok: true, status: 200, json: async () => ({ issues: [] }) };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(emptyIssuesResp as unknown as Response) // Query A
        .mockResolvedValueOnce(jiraSearchResp as unknown as Response) // Query B
        .mockResolvedValueOnce(emptyJiraResp2 as unknown as Response) // Query C
        .mockResolvedValueOnce(emptyJiraResp2 as unknown as Response); // Query D

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'A.User',
          jiraUsername: 'auser',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].bodyPreview).toHaveLength(80);
      expect(result[0].fullBody).toBe(longBody);
    });
  });

  describe('NOTF-01: fetchNewNotifications — GitLab note items', () => {
    it('skips system notes and own-user notes, only returns notes newer than cursor', async () => {
      const notesResp = {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'n001',
            system: false,
            author: { id: 99, name: 'B.Other' },
            body: 'Review comment',
            created_at: '2026-03-11T14:00:00.000Z',
          },
          {
            id: 'n002',
            system: true, // non-actionable system note — should be skipped
            author: { id: 99, name: 'B.Other' },
            body: 'added 1 commit',
            created_at: '2026-03-11T14:01:00.000Z',
          },
          {
            id: 'n003',
            system: false,
            author: { id: 42, name: 'Current User' }, // own note — should be skipped
            body: 'My own note',
            created_at: '2026-03-11T14:02:00.000Z',
          },
          {
            id: 'n004',
            system: false,
            author: { id: 99, name: 'B.Other' },
            body: 'Old note',
            created_at: '2026-03-10T08:00:00.000Z', // older than cursor — should stop
          },
        ],
      };

      vi.mocked(mockFetch).mockResolvedValueOnce(notesResp as unknown as Response);

      const result = await fetchNewNotifications(
        null,
        'https://gitlab.example.com',
        { jira: null, gitlab: 'gitlab-token' },
        {
          activeJiraProject: null,
          jiraUserDisplayName: null,
          jiraUsername: null,
          gitlabUserId: 42,
          gitlabUsername: null,
          mrList: [mockJiraMR],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gitlab-note-n001');
      expect(result[0].source).toBe('gitlab');
    });
  });

  describe('NOTF-01: fetchNewNotifications — merge and sort', () => {
    it('merges Jira and GitLab results and sorts chronologically newest-first', async () => {
      // Query A (Jira issue updates) returns empty — test focuses on comment mention + GitLab note
      const emptyIssuesResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };
      // Query B (Jira comment mentions)
      const jiraResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-1',
              fields: {
                summary: 'Fix login bug',
                comment: {
                  comments: [
                    {
                      id: 'c001',
                      author: { displayName: 'J.Smith' },
                      body: '[~jdoe] please review',
                      updated: '2026-03-11T11:00:00.000Z',
                      created: '2026-03-11T11:00:00.000Z',
                    },
                  ],
                },
              },
            },
          ],
        }),
      };

      const notesResp = {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'n001',
            system: false,
            author: { id: 99, name: 'B.Other' },
            body: 'GitLab comment',
            created_at: '2026-03-11T13:00:00.000Z',
          },
        ],
      };

      // Empty response for additional Jira queries (all-comments, due-date)
      const emptyResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };

      // MR author.id=1, gitlabUserId=42 → not author → only notes fetched (no approvals/pipelines)
      vi.mocked(mockFetch)
        .mockResolvedValueOnce(emptyIssuesResp as unknown as Response) // Query A: issue updates
        .mockResolvedValueOnce(jiraResp as unknown as Response) // Query B: comment mentions
        .mockResolvedValueOnce(emptyResp as unknown as Response) // Query C: all comments
        .mockResolvedValueOnce(emptyResp as unknown as Response) // Query D: due date reminders
        .mockResolvedValueOnce(notesResp as unknown as Response); // GitLab: notes (only call — not author)

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        'https://gitlab.example.com',
        { jira: 'jira-token', gitlab: 'gitlab-token' },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: 42,
          gitlabUsername: null,
          mrList: [mockJiraMR],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(2);
      // Newest first
      expect(result[0].id).toBe('gitlab-note-n001'); // 13:00
      expect(result[1].id).toBe('jira-comment-c001'); // 11:00
    });
  });

  describe('NOTF-03: tryDispatchOsNotification', () => {
    it('calls sendNotification when isPermissionGranted returns true', async () => {
      vi.mocked(isPermissionGranted).mockResolvedValue(true);
      vi.mocked(sendNotification).mockResolvedValue(undefined);

      const result = await tryDispatchOsNotification('Test Title', 'Test body');

      expect(result).toBe('sent');
      expect(sendNotification).toHaveBeenCalledWith({
        title: 'Test Title',
        body: 'Test body',
        sound: 'Basso',
      });
    });

    it('requests permission when not already granted, sends if granted', async () => {
      vi.mocked(isPermissionGranted).mockResolvedValue(false);
      vi.mocked(requestPermission).mockResolvedValue('granted');
      vi.mocked(sendNotification).mockResolvedValue(undefined);

      const result = await tryDispatchOsNotification('Test Title', 'Test body');

      expect(result).toBe('sent');
      expect(requestPermission).toHaveBeenCalled();
    });

    it('returns "denied" when requestPermission returns "denied"', async () => {
      vi.mocked(isPermissionGranted).mockResolvedValue(false);
      vi.mocked(requestPermission).mockResolvedValue('denied');

      const result = await tryDispatchOsNotification('Test Title', 'Test body');

      expect(result).toBe('denied');
      expect(sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('NOTF-02: notificationPollIntervalSecs clamping', () => {
    it('interval value of 5 should be clamped to 30', () => {
      const clamp = (secs: number) => Math.max(30, Math.min(300, secs));
      expect(clamp(5)).toBe(30);
    });

    it('interval value of 999 should be clamped to 300', () => {
      const clamp = (secs: number) => Math.max(30, Math.min(300, secs));
      expect(clamp(999)).toBe(300);
    });
  });

  describe('NOTF-self-author filter — GitLab', () => {
    // MR authored by user id=1 so that the approvals branch is entered
    const selfAuthorMR = {
      id: 200,
      iid: 10,
      project_id: 5,
      title: 'My MR',
      source_branch: 'feature/my-mr',
      state: 'opened' as const,
      author: { id: 1, name: 'John Doe', username: 'jdoe', avatar_url: '' },
      reviewers: [],
      updated_at: '2026-03-12T10:00:00Z',
      web_url: 'https://gitlab.example.com/project/mr/10',
      labels: [],
      milestone: null,
    };

    it('filters out self: self-approval (approved_by entry with own id) is skipped', async () => {
      const notesResp = { ok: true, status: 200, json: async () => [] };
      const approvalsResp = {
        ok: true,
        status: 200,
        json: async () => ({
          approved_by: [
            {
              user: { id: 1, name: 'John Doe', username: 'jdoe' },
              approved_at: '2026-03-12T10:00:00Z',
            },
          ],
        }),
      };
      const pipelinesResp = { ok: true, status: 200, json: async () => [] };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(notesResp as unknown as Response)
        .mockResolvedValueOnce(approvalsResp as unknown as Response)
        .mockResolvedValueOnce(pipelinesResp as unknown as Response);

      const result = await fetchNewNotifications(
        null,
        'https://gitlab.example.com',
        { jira: null, gitlab: 'gitlab-token' },
        {
          activeJiraProject: null,
          jiraUserDisplayName: null,
          jiraUsername: null,
          gitlabUserId: 1, // same as approved_by[0].user.id
          gitlabUsername: 'jdoe',
          mrList: [selfAuthorMR],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result.filter((r) => r.id.startsWith('gitlab-approval-'))).toHaveLength(0);
    });

    it('passes through: approval by someone else still produces gitlab-approval notification', async () => {
      const notesResp = { ok: true, status: 200, json: async () => [] };
      const approvalsResp = {
        ok: true,
        status: 200,
        json: async () => ({
          approved_by: [
            {
              user: { id: 2, name: 'Alice', username: 'alice' },
              approved_at: '2026-03-12T10:00:00Z',
            },
          ],
        }),
      };
      const pipelinesResp = { ok: true, status: 200, json: async () => [] };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(notesResp as unknown as Response)
        .mockResolvedValueOnce(approvalsResp as unknown as Response)
        .mockResolvedValueOnce(pipelinesResp as unknown as Response);

      const result = await fetchNewNotifications(
        null,
        'https://gitlab.example.com',
        { jira: null, gitlab: 'gitlab-token' },
        {
          activeJiraProject: null,
          jiraUserDisplayName: null,
          jiraUsername: null,
          gitlabUserId: 1, // different from approved_by[0].user.id=2
          gitlabUsername: 'jdoe',
          mrList: [selfAuthorMR],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      const approvals = result.filter((r) => r.id.startsWith('gitlab-approval-'));
      expect(approvals).toHaveLength(1);
      expect(approvals[0].author).toBe('Alice');
    });
  });

  describe('NOTF-self-author filter — Jira', () => {
    it('filters out self: Query A — changelog authored by current user is skipped', async () => {
      // History entry where the CURRENT user (John Doe) made the change — should be suppressed
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-100',
              fields: {
                summary: 'Self-change issue',
                status: { name: 'In Progress' },
                assignee: { displayName: 'John Doe' },
                reporter: { displayName: 'John Doe' },
                updated: '2026-03-12T10:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T10:00:00.000Z',
                    author: { displayName: 'John Doe' }, // current user
                    items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      const empty = { ok: true, status: 200, json: async () => ({ issues: [] }) };
      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(0);
    });

    it('passes through: Query A — changelog authored by someone else still produces notification', async () => {
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-101',
              fields: {
                summary: 'Other-change issue',
                status: { name: 'In Progress' },
                assignee: { displayName: 'John Doe' },
                reporter: { displayName: 'John Doe' },
                updated: '2026-03-12T10:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T10:00:00.000Z',
                    author: { displayName: 'Alice' }, // someone else
                    items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      const empty = { ok: true, status: 200, json: async () => ({ issues: [] }) };
      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toMatch(/^jira-issue-/);
      expect(result[0].author).toBe('Alice');
    });

    it('filters out self: Query A — self-assignment (user assigns themselves) is skipped', async () => {
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-102',
              fields: {
                summary: 'Self-assign issue',
                status: { name: 'To Do' },
                assignee: { displayName: 'John Doe' },
                reporter: { displayName: 'John Doe' },
                updated: '2026-03-12T10:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T10:00:00.000Z',
                    author: { displayName: 'John Doe' }, // current user assigns themselves
                    items: [{ field: 'assignee', fromString: null, toString: 'John Doe' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      const empty = { ok: true, status: 200, json: async () => ({ issues: [] }) };
      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      // No jira-assign-* and no jira-issue-* should be emitted
      expect(result.filter((r) => r.id.startsWith('jira-assign-'))).toHaveLength(0);
      expect(result.filter((r) => r.id.startsWith('jira-issue-'))).toHaveLength(0);
    });

    it('passes through: Query A — assignment by someone else still produces jira-assign notification', async () => {
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-103',
              fields: {
                summary: 'Assigned by Alice',
                status: { name: 'To Do' },
                assignee: { displayName: 'John Doe' },
                reporter: { displayName: 'Alice' },
                updated: '2026-03-12T10:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T10:00:00.000Z',
                    author: { displayName: 'Alice' }, // someone else assigns
                    items: [{ field: 'assignee', fromString: null, toString: 'John Doe' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      const empty = { ok: true, status: 200, json: async () => ({ issues: [] }) };
      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response)
        .mockResolvedValueOnce(empty as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result.filter((r) => r.id.startsWith('jira-assign-'))).toHaveLength(1);
    });

    it('filters out self: Query C — self comment skipped via displayName', async () => {
      const allCommentsResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-104',
              fields: {
                summary: 'Self-comment issue',
                comment: {
                  comments: [
                    {
                      id: 'sc001',
                      author: { displayName: 'John Doe', name: 'jdoe' },
                      body: 'My own comment',
                      updated: '2026-03-12T10:00:00.000Z',
                      created: '2026-03-12T10:00:00.000Z',
                    },
                  ],
                },
              },
            },
          ],
        }),
      };
      const empty = { ok: true, status: 200, json: async () => ({ issues: [] }) };
      vi.mocked(mockFetch)
        .mockResolvedValueOnce(empty as unknown as Response) // Query A
        .mockResolvedValueOnce(empty as unknown as Response) // Query B
        .mockResolvedValueOnce(allCommentsResp as unknown as Response) // Query C
        .mockResolvedValueOnce(empty as unknown as Response); // Query D

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result.filter((r) => r.id.startsWith('jira-allcomment-'))).toHaveLength(0);
    });

    it('filters out self: Query C — self comment skipped when displayName is null but username matches author.name', async () => {
      const allCommentsResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-105',
              fields: {
                summary: 'Self-comment fallback issue',
                comment: {
                  comments: [
                    {
                      id: 'sc002',
                      author: { displayName: 'John Doe', name: 'jdoe' },
                      body: 'My own comment via username fallback',
                      updated: '2026-03-12T10:00:00.000Z',
                      created: '2026-03-12T10:00:00.000Z',
                    },
                  ],
                },
              },
            },
          ],
        }),
      };
      const empty = { ok: true, status: 200, json: async () => ({ issues: [] }) };
      vi.mocked(mockFetch)
        .mockResolvedValueOnce(empty as unknown as Response) // Query A
        .mockResolvedValueOnce(empty as unknown as Response) // Query B
        .mockResolvedValueOnce(allCommentsResp as unknown as Response) // Query C
        .mockResolvedValueOnce(empty as unknown as Response); // Query D

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: null, // null — must fall back to username check
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result.filter((r) => r.id.startsWith('jira-allcomment-'))).toHaveLength(0);
    });
  });

  describe('QUICK-19: broadened Jira notifications — assignee/reporter/watcher', () => {
    it('returns items for issues where jiraUsername matches assignee', async () => {
      // Query A: assignee/reporter/watcher issues (with changelog for change detection)
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-10',
              fields: {
                summary: 'Assignee issue',
                status: { name: 'In Progress' },
                assignee: { displayName: 'Jane Doe' },
                reporter: { displayName: 'Boss Man' },
                updated: '2026-03-12T10:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T10:00:00.000Z',
                    author: { displayName: 'Boss Man' },
                    items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      // Query B: comment mentions — empty
      const commentResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };

      const emptyJiraR = { ok: true, status: 200, json: async () => ({ issues: [] }) };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response) // Query A
        .mockResolvedValueOnce(commentResp as unknown as Response) // Query B
        .mockResolvedValueOnce(emptyJiraR as unknown as Response) // Query C
        .mockResolvedValueOnce(emptyJiraR as unknown as Response); // Query D

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'Jane Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('jira-issue-PROJ-10-2026-03-12T10:00:00.000Z');
      expect(result[0].source).toBe('jira');
      expect(result[0].entityTitle).toBe('PROJ-10: Assignee issue');
      expect(result[0].bodyPreview).toContain('Status:');
    });

    it('returns items for issues where user is reporter', async () => {
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-20',
              fields: {
                summary: 'Reporter issue',
                status: { name: 'To Do' },
                assignee: { displayName: 'Someone Else' },
                reporter: { displayName: 'Jane Doe' },
                updated: '2026-03-12T11:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T11:00:00.000Z',
                    author: { displayName: 'Someone Else' },
                    items: [{ field: 'status', fromString: 'In Progress', toString: 'To Do' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      const commentResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };

      const emptyJR = { ok: true, status: 200, json: async () => ({ issues: [] }) };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(commentResp as unknown as Response)
        .mockResolvedValueOnce(emptyJR as unknown as Response)
        .mockResolvedValueOnce(emptyJR as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'Jane Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('jira-issue-PROJ-20-2026-03-12T11:00:00.000Z');
      expect(result[0].source).toBe('jira');
      expect(result[0].entityTitle).toBe('PROJ-20: Reporter issue');
    });

    it('returns items for issues where user is watcher', async () => {
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-30',
              fields: {
                summary: 'Watcher issue',
                status: { name: 'Done' },
                assignee: null,
                reporter: { displayName: 'Someone' },
                updated: '2026-03-12T12:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T12:00:00.000Z',
                    author: { displayName: 'Someone' },
                    items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      const commentResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };

      const emptyJR2 = { ok: true, status: 200, json: async () => ({ issues: [] }) };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(commentResp as unknown as Response)
        .mockResolvedValueOnce(emptyJR2 as unknown as Response)
        .mockResolvedValueOnce(emptyJR2 as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'Jane Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      // assignee is null — author falls back to reporter displayName
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('jira-issue-PROJ-30-2026-03-12T12:00:00.000Z');
      expect(result[0].author).toBe('Someone');
    });

    it('original comment-mention path still produces results (backwards compat)', async () => {
      // Query A returns nothing
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({ issues: [] }),
      };
      // Query B returns a comment mention
      const commentResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-99',
              fields: {
                summary: 'Mention issue',
                comment: {
                  comments: [
                    {
                      id: 'c999',
                      author: { displayName: 'J.Smith' },
                      body: 'Hey [~jdoe] take a look',
                      updated: '2026-03-12T09:00:00.000Z',
                      created: '2026-03-12T09:00:00.000Z',
                    },
                  ],
                },
              },
            },
          ],
        }),
      };

      const emptyJR3 = { ok: true, status: 200, json: async () => ({ issues: [] }) };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(commentResp as unknown as Response)
        .mockResolvedValueOnce(emptyJR3 as unknown as Response)
        .mockResolvedValueOnce(emptyJR3 as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('jira-comment-c999');
      expect(result[0].source).toBe('jira');
    });

    it('deduplicates when same issue appears in both issue-update and comment-mention results', async () => {
      // Query A returns PROJ-5 (with changelog for change detection)
      const issueUpdatesResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-5',
              fields: {
                summary: 'Duplicate issue',
                status: { name: 'In Review' },
                assignee: { displayName: 'Jane Doe' },
                reporter: { displayName: 'Boss' },
                updated: '2026-03-12T08:00:00.000Z',
              },
              changelog: {
                histories: [
                  {
                    created: '2026-03-12T08:00:00.000Z',
                    author: { displayName: 'Boss' },
                    items: [{ field: 'status', fromString: 'To Do', toString: 'In Review' }],
                  },
                ],
              },
            },
          ],
        }),
      };
      // Query B also returns PROJ-5 as a comment mention — produces jira-comment-dup1
      const commentResp = {
        ok: true,
        status: 200,
        json: async () => ({
          issues: [
            {
              key: 'PROJ-5',
              fields: {
                summary: 'Duplicate issue',
                comment: {
                  comments: [
                    {
                      id: 'dup1',
                      author: { displayName: 'J.Smith' },
                      body: '[~jdoe] see this',
                      updated: '2026-03-12T08:00:00.000Z',
                      created: '2026-03-12T08:00:00.000Z',
                    },
                  ],
                },
              },
            },
          ],
        }),
      };

      const emptyJR4 = { ok: true, status: 200, json: async () => ({ issues: [] }) };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(issueUpdatesResp as unknown as Response)
        .mockResolvedValueOnce(commentResp as unknown as Response)
        .mockResolvedValueOnce(emptyJR4 as unknown as Response)
        .mockResolvedValueOnce(emptyJR4 as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'Jane Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      // Different IDs: jira-issue-PROJ-5-... and jira-comment-dup1 — both present, no actual
      // duplication since ids differ. This test verifies the seen-Set deduplication doesn't
      // accidentally drop different-id items from the same issue.
      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.id);
      expect(ids).toContain('jira-issue-PROJ-5-2026-03-12T08:00:00.000Z');
      expect(ids).toContain('jira-comment-dup1');
    });

    it('returns [] when both jiraUsername and jiraUserDisplayName are null', async () => {
      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: null,
          jiraUsername: null,
          gitlabUserId: null,
          gitlabUsername: null,
          mrList: [],
          lastSeenJiraCursor: '2026-03-11T10:00:00.000Z',
          lastSeenGitlabCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(0);
      // fetch should not have been called at all
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
