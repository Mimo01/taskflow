import { afterEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();
const openPathMock = vi.fn();
const revealMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: (...a: unknown[]) => openPathMock(...a),
  revealItemInDir: (...a: unknown[]) => revealMock(...a),
}));

import {
  filenameFromSrc,
  isSafeToOpen,
  openSavedFile,
  saveBlobUrl,
  saveBytes,
} from './save-attachment';

afterEach(() => {
  vi.restoreAllMocks();
  invokeMock.mockReset();
  openPathMock.mockReset();
  revealMock.mockReset();
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
      ok: true,
      status: 200,
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

  it('rejects a non-2xx response instead of saving its error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new Uint8Array([60, 104]).buffer,
    } as Response);
    await expect(saveBlobUrl('https://x/missing.png', 'm.png')).rejects.toThrow('HTTP 404');
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('isSafeToOpen', () => {
  it('allows passive documents and media', () => {
    for (const f of ['a.png', 'B.JPG', 'doc.pdf', 'notes.txt', 'sheet.xlsx', 'clip.mov']) {
      expect(isSafeToOpen(f)).toBe(true);
    }
  });
  it('rejects executables, archives, browser-executed and unknown types', () => {
    for (const f of [
      'x.command',
      'x.terminal',
      'x.sh',
      'x.app',
      'x.dmg',
      'x.pkg',
      'x.jar',
      'x.zip',
      'x.html',
      'x.svg',
      'x.png.command',
      'noext',
      '.png',
      'trailing.',
    ]) {
      expect(isSafeToOpen(f)).toBe(false);
    }
  });
});

describe('openSavedFile', () => {
  it('opens safe types with openPath', async () => {
    openPathMock.mockResolvedValue(undefined);
    await expect(openSavedFile('/dl/a.png')).resolves.toBe('opened');
    expect(openPathMock).toHaveBeenCalledWith('/dl/a.png');
    expect(revealMock).not.toHaveBeenCalled();
  });
  it('reveals unsafe types in Finder instead of launching them', async () => {
    revealMock.mockResolvedValue(undefined);
    await expect(openSavedFile('/dl/run.command')).resolves.toBe('revealed');
    expect(revealMock).toHaveBeenCalledWith('/dl/run.command');
    expect(openPathMock).not.toHaveBeenCalled();
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
