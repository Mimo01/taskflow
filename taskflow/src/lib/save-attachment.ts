import { invoke } from '@tauri-apps/api/core';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';

/** Save raw bytes into Downloads via the Rust command; returns the saved path. */
export async function saveBytes(bytes: Uint8Array | number[], filename: string): Promise<string> {
  return invoke<string>('save_attachment', {
    bytes: Array.from(bytes),
    filename,
  });
}

/** Throw a readable error for a non-2xx response instead of saving its error body. */
export function assertOk(resp: Response): Response {
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp;
}

/** Save the contents of a local blob: URL (native fetch, no auth involved). */
export async function saveBlobUrl(blobUrl: string, filename: string): Promise<string> {
  const resp = assertOk(await globalThis.fetch(blobUrl));
  const buffer = await resp.arrayBuffer();
  return saveBytes(new Uint8Array(buffer), filename);
}

/**
 * Extensions safe to hand to the OS default app: passive documents/media only.
 * Anything else (scripts, .command, .app/.dmg/.pkg, archives, .html/.svg that a
 * browser would execute, unknown types) is revealed in Finder instead.
 */
const SAFE_OPEN_EXTENSIONS = new Set([
  // images
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'tif',
  'tiff',
  'heic',
  'heif',
  'avif',
  'ico',
  // documents
  'pdf',
  'txt',
  'md',
  'csv',
  'log',
  'json',
  'xml',
  'yaml',
  'yml',
  'rtf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'pages',
  'numbers',
  'key',
  // media
  'mp4',
  'mov',
  'm4v',
  'webm',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'flac',
]);

export function isSafeToOpen(filename: string): boolean {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return false;
  return SAFE_OPEN_EXTENSIONS.has(filename.slice(dot + 1).toLowerCase());
}

export const REVEALED_MESSAGE = 'Shown in Finder — this file type is not opened automatically.';

/**
 * Open a file the app itself saved: safe types in the OS default app, anything
 * else revealed in Finder. Errors propagate. Returns what was done.
 */
export async function openSavedFile(path: string): Promise<'opened' | 'revealed'> {
  const name = path.split(/[/\\]/).pop() ?? path;
  if (isSafeToOpen(name)) {
    await openPath(path);
    return 'opened';
  }
  await revealItemInDir(path);
  return 'revealed';
}

/** alt if non-empty, else last URL path segment (decoded, query stripped), else 'image'. */
export function filenameFromSrc(src: string, alt?: string): string {
  if (alt && alt.trim() !== '') return alt;
  const path = src.split(/[?#]/)[0] ?? '';
  const last = path.split('/').filter(Boolean).pop();
  if (last) {
    try {
      return decodeURIComponent(last);
    } catch {
      return last;
    }
  }
  return 'image';
}
