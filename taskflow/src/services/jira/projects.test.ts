import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchJiraProjectNumericId, listJiraProjects, validateJira } from './projects';

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
        json: async () => ({
          displayName: 'Admin User',
          emailAddress: 'admin@example.com',
          name: 'admin',
        }),
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

      await expect(validateJira(baseUrl, token)).rejects.toThrow(
        'Invalid token or token has expired',
      );
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

      await expect(listJiraProjects(baseUrl, token)).rejects.toThrow(
        'Token valid but lacks required permissions',
      );
    });
  });

  describe('fetchJiraProjectNumericId', () => {
    it('returns numeric id parsed from data.id string on 200', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '10134', key: 'PROJ', name: 'My Project' }),
      } as unknown as Response);

      const result = await fetchJiraProjectNumericId(baseUrl, token, 'PROJ');
      expect(result).toBe(10134);
      expect(typeof result).toBe('number');
    });

    it('throws ApiError on 401', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as unknown as Response);

      await expect(fetchJiraProjectNumericId(baseUrl, token, 'PROJ')).rejects.toMatchObject({
        status: 401,
        source: 'jira',
      });
    });

    it('throws descriptive error on non-2xx (e.g. 404)', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      await expect(fetchJiraProjectNumericId(baseUrl, token, 'PROJ')).rejects.toThrow(
        'Jira project PROJ not found',
      );
    });

    it('throws "Cannot reach" on network error', async () => {
      mockedApiFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(fetchJiraProjectNumericId(baseUrl, token, 'PROJ')).rejects.toThrow(
        'Cannot reach',
      );
    });
  });
});
