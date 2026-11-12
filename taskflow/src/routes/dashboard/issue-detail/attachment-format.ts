import { File, FileText } from 'lucide-react';
import type { JiraAttachment } from '@/services/jira';
import { isTextualMime } from './resolvePreviewKind';

export function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(mimeType: string) {
  const mime = mimeType ?? '';
  if (mime.startsWith('text/') || mime === 'application/pdf' || isTextualMime(mime)) {
    return FileText;
  }
  return File;
}

// Jira thumbnails are often missing or a generic placeholder for some PNGs; small
// images load fine as full content (same path the description uses), so prefer that.
export const MAX_FULL_THUMB_BYTES = 2 * 1024 * 1024;

export function getAttachmentImageSrc(attachment: JiraAttachment): {
  src: string;
  fallbackSrc: string;
} {
  return {
    src:
      attachment.size !== undefined && attachment.size <= MAX_FULL_THUMB_BYTES
        ? attachment.content
        : (attachment.thumbnail ?? attachment.content),
    fallbackSrc: attachment.thumbnail ?? attachment.content,
  };
}
