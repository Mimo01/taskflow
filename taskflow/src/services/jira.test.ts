// AUTH-01: Jira PAT validation
// AUTH-06: Error banners for Jira validation failures
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateJira, listJiraProjects } from './jira';

describe('jira service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateJira', () => {
    it('AUTH-01: validateJira returns user data on 200 response', async () => {
      const mockUser = { displayName: 'Jane Smith', emailAddress: 'jane@example.com' };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      }));

      const result = await validateJira('https://jira.example.com', 'my-token');
      expect(result).toEqual({ displayName: 'Jane Smith', emailAddress: 'jane@example.com' });
    });

    it('AUTH-01: validateJira throws "Invalid token or token has expired" on 401', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }));

      await expect(validateJira('https://jira.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });

    it('AUTH-01: validateJira throws "Token valid but lacks required permissions" on 403', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      }));

      await expect(validateJira('https://jira.example.com', 'limited-token')).rejects.toThrow(
        'Token valid but lacks required permissions',
      );
    });

    it('AUTH-01: validateJira throws "Cannot reach [URL]" on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

      await expect(validateJira('https://jira.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://jira.example.com — check the base URL',
      );
    });

    it('AUTH-01: validateJira throws "Cannot reach [URL]" on non-401/403 error status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }));

      await expect(validateJira('https://jira.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://jira.example.com — check the base URL',
      );
    });
  });

  describe('listJiraProjects', () => {
    it('AUTH-06: listJiraProjects returns project list on success', async () => {
      const mockProjects = [
        { id: '10001', key: 'APP', name: 'Application' },
        { id: '10002', key: 'BE', name: 'Backend' },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockProjects,
      }));

      const result = await listJiraProjects('https://jira.example.com', 'my-token');
      expect(result).toEqual(mockProjects);
    });

    it('AUTH-06: listJiraProjects throws on 401', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }));

      await expect(listJiraProjects('https://jira.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });
  });
});
