import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { listJiraProjects, validateJira } from './projects';

const mockedApiFetch = vi.mocked(apiFetch);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';

describe('projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateJira', () => {
    it('returns JiraUser on success', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ displayName: 'Admin User', emailAddress: 'admin@example.com', name: 'admin' }),
      } as unknown as Response);

      const result = await validateJira(baseUrl, token);
      expect(result).toEqual({
        displayName: 'Admin User',
        emailAddress: 'admin@example.com',
        name: 'admin',
      });
    });

    it('throws on 401', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(validateJira(baseUrl, token)).rejects.toThrow('Invalid token or token has expired');
    });
  });

  describe('listJiraProjects', () => {
    it('returns projects array on success', async () => {
      const projects = [{ key: 'PROJ', name: 'Project', id: '1' }];
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => projects,
      } as unknown as Response);

      const result = await listJiraProjects(baseUrl, token);
      expect(result).toEqual(projects);
    });

    it('throws on 403', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 403,
      } as unknown as Response);

      await expect(listJiraProjects(baseUrl, token)).rejects.toThrow('Token valid but lacks required permissions');
    });
  });
});
