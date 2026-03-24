import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { createJiraFilter, deleteJiraFilter, fetchFavouriteFilters, updateJiraFilter } from './filters';

const mockedApiFetch = vi.mocked(apiFetch);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';

describe('filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createJiraFilter', () => {
    it('sends POST to /rest/api/2/filter with name, jql, description, favourite:true', async () => {
      const created = { id: '100', name: 'My Filter', jql: 'project = TEST', description: 'desc', favourite: true };
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => created,
      } as unknown as Response);

      const result = await createJiraFilter(baseUrl, token, 'My Filter', 'project = TEST', 'desc');
      expect(result).toEqual(created);
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        `${baseUrl}/rest/api/2/filter`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My Filter', jql: 'project = TEST', description: 'desc', favourite: true }),
        }),
        'Save Filter',
      );
    });

    it('defaults description to empty string when omitted', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '100', name: 'F', jql: 'x=1' }),
      } as unknown as Response);

      await createJiraFilter(baseUrl, token, 'F', 'x=1');
      const body = JSON.parse((mockedApiFetch.mock.calls[0][2] as RequestInit).body as string);
      expect(body.description).toBe('');
    });

    it('throws on non-ok response', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 400,
      } as unknown as Response);

      await expect(createJiraFilter(baseUrl, token, 'F', 'bad jql')).rejects.toThrow('Failed to create filter: 400');
    });
  });

  describe('fetchFavouriteFilters', () => {
    it('sends GET to /rest/api/2/filter/favourite and returns array', async () => {
      const filters = [
        { id: '1', name: 'Filter A', jql: 'project = A' },
        { id: '2', name: 'Filter B', jql: 'project = B' },
      ];
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => filters,
      } as unknown as Response);

      const result = await fetchFavouriteFilters(baseUrl, token);
      expect(result).toEqual(filters);
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        `${baseUrl}/rest/api/2/filter/favourite`,
        expect.objectContaining({ method: 'GET' }),
        'Fetch Favourite Filters',
      );
    });

    it('throws on non-ok response', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      await expect(fetchFavouriteFilters(baseUrl, token)).rejects.toThrow('Failed to fetch favourite filters: 500');
    });
  });

  describe('updateJiraFilter', () => {
    it('sends PUT to /rest/api/2/filter/{id} with updates', async () => {
      const updated = { id: '10', name: 'Updated', jql: 'project = NEW', description: 'new desc' };
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => updated,
      } as unknown as Response);

      const result = await updateJiraFilter(baseUrl, token, '10', { name: 'Updated', jql: 'project = NEW' });
      expect(result).toEqual(updated);
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        `${baseUrl}/rest/api/2/filter/10`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated', jql: 'project = NEW' }),
        }),
        'Update Filter',
      );
    });
  });

  describe('deleteJiraFilter', () => {
    it('sends DELETE to /rest/api/2/filter/{id}', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 204,
      } as unknown as Response);

      await expect(deleteJiraFilter(baseUrl, token, '42')).resolves.toBeUndefined();
      expect(mockedApiFetch).toHaveBeenCalledWith(
        'jira',
        `${baseUrl}/rest/api/2/filter/42`,
        expect.objectContaining({ method: 'DELETE' }),
        'Delete Filter',
      );
    });

    it('throws on non-ok response', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as unknown as Response);

      await expect(deleteJiraFilter(baseUrl, token, '99')).rejects.toThrow('Failed to delete filter: 404');
    });
  });
});
