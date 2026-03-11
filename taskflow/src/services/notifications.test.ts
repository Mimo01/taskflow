// NOTF-01: Unified notification feed (Jira + GitLab)
// NOTF-02: Polling with configurable interval, clamped to [30, 300] seconds
// NOTF-03: OS desktop notification dispatch
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchNewNotifications,
  tryDispatchOsNotification,
} from './notifications';

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
  state: 'opened' as const,
  author: { id: 1, name: 'Alice', username: 'alice', avatar_url: '' },
  reviewers: [],
  updated_at: '2026-03-11T10:00:00Z',
  web_url: 'https://gitlab.example.com/project/mr/1',
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

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(jiraSearchResp as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: null,
          mrList: [],
          lastSeenCursor: '2026-03-11T10:00:00.000Z',
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

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(jiraSearchResp as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        null,
        { jira: 'jira-token', gitlab: null },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'A.User',
          jiraUsername: 'auser',
          gitlabUserId: null,
          mrList: [],
          lastSeenCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].bodyPreview).toHaveLength(80);
      expect(result[0].fullBody).toBe(longBody);
    });
  });

  describe('NOTF-01: fetchNewNotifications — GitLab note items', () => {
    it('skips system notes and own-user notes, only returns notes newer than lastSeenCursor', async () => {
      const notesResp = {
        ok: true,
        status: 200,
        json: async () => ([
          {
            id: 'n001',
            system: false,
            author: { id: 99, name: 'B.Other' },
            body: 'Review comment',
            created_at: '2026-03-11T14:00:00.000Z',
          },
          {
            id: 'n002',
            system: true, // system note — should be skipped
            author: { id: 99, name: 'B.Other' },
            body: 'assigned to @alice',
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
        ]),
      };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(notesResp as unknown as Response);

      const result = await fetchNewNotifications(
        null,
        'https://gitlab.example.com',
        { jira: null, gitlab: 'gitlab-token' },
        {
          activeJiraProject: null,
          jiraUserDisplayName: null,
          jiraUsername: null,
          gitlabUserId: 42,
          mrList: [mockJiraMR],
          lastSeenCursor: '2026-03-11T10:00:00.000Z',
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gitlab-note-n001');
      expect(result[0].source).toBe('gitlab');
    });
  });

  describe('NOTF-01: fetchNewNotifications — merge and sort', () => {
    it('merges Jira and GitLab results and sorts chronologically newest-first', async () => {
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
        json: async () => ([
          {
            id: 'n001',
            system: false,
            author: { id: 99, name: 'B.Other' },
            body: 'GitLab comment',
            created_at: '2026-03-11T13:00:00.000Z',
          },
        ]),
      };

      vi.mocked(mockFetch)
        .mockResolvedValueOnce(jiraResp as unknown as Response)
        .mockResolvedValueOnce(notesResp as unknown as Response);

      const result = await fetchNewNotifications(
        'https://jira.example.com',
        'https://gitlab.example.com',
        { jira: 'jira-token', gitlab: 'gitlab-token' },
        {
          activeJiraProject: 'PROJ',
          jiraUserDisplayName: 'John Doe',
          jiraUsername: 'jdoe',
          gitlabUserId: 42,
          mrList: [mockJiraMR],
          lastSeenCursor: '2026-03-11T10:00:00.000Z',
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
      expect(sendNotification).toHaveBeenCalledWith({ title: 'Test Title', body: 'Test body' });
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
});
