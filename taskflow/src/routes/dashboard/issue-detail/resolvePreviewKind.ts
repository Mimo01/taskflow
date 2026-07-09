import type { JiraAttachment } from '@/services/jira';

export type PreviewKind = 'image' | 'text' | 'code' | 'pdf' | 'video' | 'audio' | 'other';

const CODE_EXTENSIONS = new Set([
  'json',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
  'sh',
  'yml',
  'yaml',
  'xml',
  'html',
  'css',
]);

const TEXT_EXTENSIONS = new Set(['md', 'log', 'csv', 'txt']);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav']);

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

/**
 * Classifies a Jira attachment into a preview kind by checking unambiguous
 * mimeType prefixes first, then falling back to filename extension for
 * generic mimeTypes (octet-stream / empty / text/plain-masquerading-as-code).
 */
export function resolvePreviewKind(attachment: JiraAttachment): PreviewKind {
  const mimeType = attachment.mimeType ?? '';
  const ext = getExtension(attachment.filename ?? '');

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';

  const isGenericMime = mimeType === '' || mimeType === 'application/octet-stream';
  const isTextMime = mimeType.startsWith('text/');

  if (isGenericMime || isTextMime) {
    if (CODE_EXTENSIONS.has(ext)) return 'code';
    if (TEXT_EXTENSIONS.has(ext)) return 'text';
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
    if (isTextMime) return 'text';
  }

  return 'other';
}
