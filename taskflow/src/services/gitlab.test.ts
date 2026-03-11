// AUTH-02: GitLab PAT validation
import { vi } from 'vitest';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { fetch as mockFetch } from '@tauri-apps/plugin-http';
import { validateGitLab, listGitLabGroups } from './gitlab';

describe('gitlab service', () => {
  beforeEach(() => {
    vi.mocked(mockFetch).mockReset();
  });

  describe('validateGitLab', () => {
    it('AUTH-02: validateGitLab returns user data on 200 response', async () => {
      const mockUser = { id: 42, name: 'Jane Smith', username: 'jsmith' };
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as any);

      const result = await validateGitLab('https://gitlab.example.com', 'my-token');
      expect(result).toEqual({ id: 42, name: 'Jane Smith', username: 'jsmith' });
    });

    it('AUTH-02: validateGitLab throws "Invalid token or token has expired" on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as any);

      await expect(validateGitLab('https://gitlab.example.com', 'bad-token')).rejects.toThrow(
        'Invalid token or token has expired',
      );
    });

    it('AUTH-02: validateGitLab throws "Token valid but lacks required permissions" on 403', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({}),
      } as any);

      await expect(validateGitLab('https://gitlab.example.com', 'limited-token')).rejects.toThrow(
        'Token valid but lacks required permissions',
      );
    });

    it('AUTH-02: validateGitLab throws "Cannot reach [URL]" on network error', async () => {
      vi.mocked(mockFetch).mockRejectedValue(new Error('Network failure'));

      await expect(validateGitLab('https://gitlab.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://gitlab.example.com — check the base URL',
      );
    });

    it('AUTH-02: validateGitLab throws "Cannot reach [URL]" on non-401/403 error status', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as any);

      await expect(validateGitLab('https://gitlab.example.com', 'any-token')).rejects.toThrow(
        'Cannot reach https://gitlab.example.com — check the base URL',
      );
    });
  });

  describe('listGitLabGroups', () => {
    it('AUTH-02: listGitLabGroups returns groups list on success', async () => {
      const mockGroups = [
        { id: 1, name: 'Engineering', full_path: 'engineering' },
        { id: 2, name: 'Frontend', full_path: 'engineering/frontend' },
      ];
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockGroups,
      } as any);

      const result = await listGitLabGroups('https://gitlab.example.com', 'my-token');
      expect(result).toEqual(mockGroups);
    });
  });
});
