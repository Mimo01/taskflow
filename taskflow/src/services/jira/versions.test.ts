import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiFetch', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '../../lib/apiFetch';
import { fetchFixVersions } from './versions';

const mockedApiFetch = vi.mocked(apiFetch);
const baseUrl = 'https://jira.example.com';
const token = 'test-token';
const projectKey = 'PROJ';

describe('versions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchFixVersions', () => {
    it('returns versions array on success', async () => {
      const versions = [{ id: '1', name: 'v1.0', released: false }];
      mockedApiFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => versions,
      } as unknown as Response);

      const result = await fetchFixVersions(baseUrl, token, projectKey);
      expect(result).toEqual(versions);
    });

    it('throws on 401', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ errorMessages: ['Unauthorized'] }),
      } as unknown as Response);

      await expect(fetchFixVersions(baseUrl, token, projectKey)).rejects.toThrow('Unauthorized');
    });

    it('WR-01: surfaces the field-validation reason from the errors object', async () => {
      mockedApiFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          errorMessages: [],
          errors: { fixVersions: "Field 'fixVersions' cannot be set" },
        }),
      } as unknown as Response);

      await expect(fetchFixVersions(baseUrl, token, projectKey)).rejects.toThrow(
        "fixVersions: Field 'fixVersions' cannot be set",
      );
    });
  });
});
