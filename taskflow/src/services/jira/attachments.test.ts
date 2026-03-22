import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAttachment, uploadAttachment } from './attachments';

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}));

import { fetch as mockFetch } from '@tauri-apps/plugin-http';

const BASE = 'https://jira.example.com';
const TOKEN = 'test-token';

describe('attachments service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('uploadAttachment', () => {
    it('sends POST with FormData and X-Atlassian-Token header', async () => {
      const attachment = {
        id: '10001',
        filename: 'screenshot.png',
        content: 'https://jira.example.com/secure/attachment/10001/screenshot.png',
        mimeType: 'image/png',
      };

      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [attachment],
      } as Response);

      const file = new File(['data'], 'screenshot.png', { type: 'image/png' });
      const result = await uploadAttachment(BASE, TOKEN, 'PROJ-1', file);

      expect(result).toEqual([attachment]);

      const callArgs = vi.mocked(mockFetch).mock.calls[0];
      expect(callArgs[0]).toBe(`${BASE}/rest/api/2/issue/PROJ-1/attachments`);

      const init = callArgs[1] as RequestInit;
      expect(init.method).toBe('POST');

      const headers = init.headers as Record<string, string>;
      expect(headers['X-Atlassian-Token']).toBe('no-check');
      expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
      // Content-Type must NOT be set (FormData sets multipart boundary)
      expect(headers['Content-Type']).toBeUndefined();

      expect(init.body).toBeInstanceOf(FormData);
    });

    it('throws ApiError on 401', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const file = new File(['data'], 'test.txt', { type: 'text/plain' });
      await expect(uploadAttachment(BASE, TOKEN, 'PROJ-1', file)).rejects.toThrow(
        'Failed to upload attachment',
      );
    });
  });

  describe('deleteAttachment', () => {
    it('sends DELETE to correct URL', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      await deleteAttachment(BASE, TOKEN, '10001');

      expect(vi.mocked(mockFetch)).toHaveBeenCalledWith(
        `${BASE}/rest/api/2/attachment/10001`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('throws ApiError on 403', async () => {
      vi.mocked(mockFetch).mockResolvedValue({
        ok: false,
        status: 403,
      } as Response);

      await expect(deleteAttachment(BASE, TOKEN, '10001')).rejects.toThrow(
        'Failed to delete attachment',
      );
    });
  });
});
