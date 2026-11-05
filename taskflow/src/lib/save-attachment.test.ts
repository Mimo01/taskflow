import { afterEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const openPathMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openPath: (...a: unknown[]) => openPathMock(...a) }));

import { filenameFromSrc, openSavedFile, saveBlobUrl, saveBytes } from './save-attachment';

afterEach(() => {
  vi.restoreAllMocks();
  invokeMock.mockReset();
  openPathMock.mockReset();
});

describe('saveBytes', () => {
  it('invokes save_attachment with number[] and returns the path', async () => {
    invokeMock.mockResolvedValue('/dl/a.png');
    const path = await saveBytes(new Uint8Array([1, 2, 3]), 'a.png');
    expect(invokeMock).toHaveBeenCalledWith('save_attachment', {
      bytes: [1, 2, 3],
      filename: 'a.png',
    });
    expect(path).toBe('/dl/a.png');
  });
});

describe('saveBlobUrl', () => {
  it('reads bytes via native fetch and delegates to saveBytes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      arrayBuffer: async () => new Uint8Array([9, 8]).buffer,
    } as Response);
    invokeMock.mockResolvedValue('/dl/b.png');
    const path = await saveBlobUrl('blob:x', 'b.png');
    expect(fetchSpy).toHaveBeenCalledWith('blob:x');
    expect(invokeMock).toHaveBeenCalledWith('save_attachment', {
      bytes: [9, 8],
      filename: 'b.png',
    });
    expect(path).toBe('/dl/b.png');
  });
});

describe('openSavedFile', () => {
  it('calls openPath', async () => {
    openPathMock.mockResolvedValue(undefined);
    await openSavedFile('/dl/a.png');
    expect(openPathMock).toHaveBeenCalledWith('/dl/a.png');
  });
  it('rethrows errors', async () => {
    openPathMock.mockRejectedValue(new Error('denied'));
    await expect(openSavedFile('/dl/a.png')).rejects.toThrow('denied');
  });
});

describe('filenameFromSrc', () => {
  it('prefers alt', () => {
    expect(filenameFromSrc('https://x/y/z.png', 'shot.png')).toBe('shot.png');
  });
  it('falls back to last segment, decoded, query stripped', () => {
    expect(filenameFromSrc('https://x/y/my%20file.png?v=1', '')).toBe('my file.png');
  });
  it('falls back to image', () => {
    expect(filenameFromSrc('', undefined)).toBe('image');
  });
});
