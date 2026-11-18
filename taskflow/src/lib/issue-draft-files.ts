/*
 * Disk copies of staged attachments for issue drafts, under
 * $APPDATA/issue-drafts/<draftId>/<unique>-<name>. Never log file names or bytes:
 * drafts may contain customer data.
 */
import { BaseDirectory, mkdir, readDir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';

export type StagedFileRef = { name: string; size: number; type: string; path: string };

const ROOT = 'issue-drafts';
const ID_RE = /^[A-Za-z0-9-]+$/;

/** Strip path components and '..' so a file name is a single safe segment. */
export function safeDraftFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/\.\.+/g, '').trim();
  return cleaned || 'file';
}

function dirFor(draftId: string): string {
  if (!ID_RE.test(draftId)) throw new Error('Invalid draft id');
  return `${ROOT}/${draftId}`;
}

export async function stageDraftFile(draftId: string, file: File): Promise<StagedFileRef> {
  const dir = dirFor(draftId);
  // Unique per copy: same-named files (pasted screenshots are all image.png) and names that
  // only differ by case or '..' must never share a path.
  const path = `${dir}/${crypto.randomUUID()}-${safeDraftFileName(file.name)}`;
  await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
  await writeFile(path, new Uint8Array(await file.arrayBuffer()), {
    baseDir: BaseDirectory.AppData,
  });
  return { name: file.name, size: file.size, type: file.type, path };
}

/** Rebuilds the File, or null when the copy is missing. */
export async function readDraftFile(ref: StagedFileRef): Promise<File | null> {
  try {
    const bytes = await readFile(ref.path, { baseDir: BaseDirectory.AppData });
    return new File([bytes as BlobPart], ref.name, { type: ref.type });
  } catch {
    return null;
  }
}

/** Removes one staged copy; best effort. */
export async function removeDraftFile(ref: StagedFileRef): Promise<void> {
  if (!ref.path.startsWith(`${ROOT}/`) || ref.path.split('/').includes('..')) return;
  try {
    await remove(ref.path, { baseDir: BaseDirectory.AppData });
  } catch {
    // already gone
  }
}

export async function removeDraftFiles(draftId: string): Promise<void> {
  try {
    await remove(dirFor(draftId), { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // already gone
  }
}

export async function purgeAllDraftFiles(): Promise<void> {
  try {
    await remove(ROOT, { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // nothing to purge
  }
}

/** Removes every draft directory whose id is not in `liveDraftIds`. */
export async function purgeOrphanDraftFiles(liveDraftIds: Set<string>): Promise<void> {
  try {
    const entries = await readDir(ROOT, { baseDir: BaseDirectory.AppData });
    for (const e of entries) {
      if (liveDraftIds.has(e.name)) continue;
      try {
        await remove(`${ROOT}/${e.name}`, { baseDir: BaseDirectory.AppData, recursive: true });
      } catch {
        // best effort
      }
    }
  } catch {
    // no drafts dir
  }
}
