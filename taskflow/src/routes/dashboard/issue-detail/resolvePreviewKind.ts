import type { JiraAttachment } from '@/services/jira';

export type PreviewKind = 'image' | 'text' | 'code' | 'pdf' | 'video' | 'audio' | 'other';

// Single source of truth for "extension is code" (resolvePreviewKind) and
// "extension maps to this hljs language" (highlightCode) — keeps the two
// classifications from silently drifting apart as extensions are added.
export const CODE_EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  json: 'json',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  html: 'xml',
  css: 'css',
  xsd: 'xml',
  xsl: 'xml',
  xslt: 'xml',
  wsdl: 'xml',
  xhtml: 'xml',
  htm: 'xml',
  plist: 'xml',
  pom: 'xml',
  har: 'json',
  webmanifest: 'json',
  geojson: 'json',
  mjs: 'javascript',
  cjs: 'javascript',
  mts: 'typescript',
  cts: 'typescript',
  sql: 'sql',
  properties: 'properties',
  ini: 'ini',
  toml: 'ini',
  cfg: 'ini',
  conf: 'ini',
  env: 'ini',
  diff: 'diff',
  patch: 'diff',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  php: 'php',
  cs: 'csharp',
  scss: 'scss',
  less: 'less',
  gradle: 'gradle',
  groovy: 'groovy',
  ps1: 'powershell',
  bash: 'bash',
  zsh: 'bash',
  hpp: 'cpp',
  cc: 'cpp',
};

// Extension-less well-known filenames (lowercase).
const CODE_FILENAME_LANGUAGE_MAP: Record<string, string> = {
  dockerfile: 'dockerfile',
};

const TEXT_EXTENSIONS = new Set([
  'md',
  'log',
  'csv',
  'txt',
  'tsv',
  'out',
  'err',
  'text',
  'markdown',
  'rst',
  'jsonl',
  'ndjson',
  'srt',
  'vtt',
]);

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'ico',
]);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac']);

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

const TEXTUAL_APPLICATION_MIMES = new Set([
  'application/xml',
  'application/json',
  'application/x-yaml',
  'application/yaml',
  'application/sql',
  'application/x-sql',
  'application/javascript',
  'application/x-javascript',
  'application/ecmascript',
  'application/x-sh',
  'application/x-shellscript',
  'application/toml',
  'application/x-httpd-php',
  'application/graphql',
]);

function normalizeMime(mimeType: string | undefined): string {
  return (mimeType ?? '').split(';')[0].trim().toLowerCase();
}

/** True for structured application/* MIME types whose body is plain text. */
export function isTextualMime(mimeType: string): boolean {
  const mime = normalizeMime(mimeType);
  if (!mime.startsWith('application/')) return false;
  return TEXTUAL_APPLICATION_MIMES.has(mime) || mime.endsWith('+xml') || mime.endsWith('+json');
}

/** hljs language for a filename: by extension, else well-known extension-less names. */
export function codeLanguageFor(filename: string): string | undefined {
  const ext = getExtension(filename);
  const byExt = ext ? CODE_EXTENSION_LANGUAGE_MAP[ext] : undefined;
  return byExt ?? CODE_FILENAME_LANGUAGE_MAP[filename.toLowerCase()];
}

/**
 * Classifies a Jira attachment into a preview kind by checking unambiguous
 * mimeType prefixes first, then falling back to filename extension for
 * generic mimeTypes (octet-stream / empty / text/* / textual application/*).
 * Jira reports XML/JSON/YAML etc. with structured application/* types, so
 * those are treated like text/* for extension lookup, with a MIME-family
 * fallback when the extension is unknown.
 */
export function resolvePreviewKind(attachment: JiraAttachment): PreviewKind {
  const mimeType = normalizeMime(attachment.mimeType);
  const filename = attachment.filename ?? '';
  const ext = getExtension(filename);

  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';

  const isGenericMime = mimeType === '' || mimeType === 'application/octet-stream';
  const isTextMime = mimeType.startsWith('text/');
  const isTextualApp = isTextualMime(mimeType);

  if (isGenericMime || isTextMime || isTextualApp) {
    if (IMAGE_EXTENSIONS.has(ext)) return 'image';
    if (codeLanguageFor(filename)) return 'code';
    if (TEXT_EXTENSIONS.has(ext)) return 'text';
    if (VIDEO_EXTENSIONS.has(ext)) return 'video';
    if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
    if (
      mimeType === 'application/xml' ||
      mimeType === 'text/xml' ||
      mimeType.endsWith('+xml') ||
      mimeType === 'application/json' ||
      mimeType.endsWith('+json')
    ) {
      return 'code';
    }
    if (isTextMime || isTextualApp) return 'text';
  }

  return 'other';
}

// Preview size caps (bytes). Text/code is fetched + highlighted in full, so it
// gets a small cap; PDF/video/audio are embedded whole via blob/data URLs.
export const MAX_TEXT_PREVIEW_SIZE = 2 * 1024 * 1024;
export const MAX_MEDIA_PREVIEW_SIZE = 50 * 1024 * 1024;

export function previewSizeCap(kind: PreviewKind): number | undefined {
  if (kind === 'text' || kind === 'code') return MAX_TEXT_PREVIEW_SIZE;
  if (kind === 'pdf' || kind === 'video' || kind === 'audio') return MAX_MEDIA_PREVIEW_SIZE;
  return undefined;
}

export type PreviewUnavailable = 'unsupported' | 'too-large';

/** Why an attachment can't open in the preview modal, or null if it can. */
export function previewUnavailableReason(
  attachment: JiraAttachment,
  kind: PreviewKind = resolvePreviewKind(attachment),
): PreviewUnavailable | null {
  if (kind === 'other') return 'unsupported';
  const cap = previewSizeCap(kind);
  if (cap != null && (attachment.size ?? 0) > cap) return 'too-large';
  return null;
}
