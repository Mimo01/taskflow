import type { Editor } from '@tiptap/core';
import { attachmentRef, stagedAttachmentRef } from '@/lib/attachment-markup';
import { getHost } from '../host';
import { recordUploadFailure } from '../media/upload-plugin';
import {
  classifyFile,
  clipboardImageName,
  renameFile,
  stagedFileName,
  uniqueFileName,
} from '../media/upload-state';

/**
 * Source-mode paste/drop: uploads (or stages) the files and calls `insert` with the wiki markup
 * for each. Failures land in the shared upload-failure list. Returns false when the host can
 * neither upload nor stage.
 */
export function uploadIntoSource(
  editor: Editor,
  files: File[],
  insert: (markup: string) => void,
): boolean {
  const host = getHost(editor);
  const staging = Boolean(host.staged && host.stageFile);
  if (!staging && !host.uploadFile) return false;
  if (files.length === 0) return false;

  const taken = new Set<string>(host.attachments.map((a) => a.filename));
  for (const original of files) {
    let file = original;
    if (classifyFile(file) === 'image') {
      file = renameFile(file, clipboardImageName(file, new Date(), taken));
    }
    if (staging && host.stageFile) {
      const renamed = renameFile(file, stagedFileName(file, taken));
      taken.add(renamed.name);
      host.stageFile(renamed);
      insert(stagedAttachmentRef(renamed));
      continue;
    }
    file = renameFile(file, uniqueFileName(file.name, taken));
    taken.add(file.name);
    host.uploadFile?.(file).then(
      (att) => insert(attachmentRef(att)),
      () => recordUploadFailure(editor, original.name),
    );
  }
  return true;
}
