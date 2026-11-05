import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';

/** Save raw bytes into Downloads via the Rust command; returns the saved path. */
export async function saveBytes(bytes: Uint8Array | number[], filename: string): Promise<string> {
  return invoke<string>('save_attachment', {
    bytes: Array.from(bytes),
    filename,
  });
}

/** Save the contents of a local blob: URL (native fetch, no auth involved). */
export async function saveBlobUrl(blobUrl: string, filename: string): Promise<string> {
  const buffer = await globalThis.fetch(blobUrl).then((r) => r.arrayBuffer());
  return saveBytes(new Uint8Array(buffer), filename);
}

/** Open a file the app itself saved in the OS default app. Errors propagate. */
export async function openSavedFile(path: string): Promise<void> {
  await openPath(path);
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
