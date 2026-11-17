/** Pure naming and classification helpers for pasted/dropped files (D-08, D-09, D-11). */

// Parity with IMAGE_EXTENSIONS in routes/dashboard/issue-detail/resolvePreviewKind.ts
// (not exported there; keep the two lists in sync).
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

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const GENERIC_NAME = /^(image\.(png|jpe?g|gif|webp)|pasted image.*)?$/i;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ts(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i <= 0 || i === name.length - 1 ? '' : name.slice(i + 1).toLowerCase();
}

function dedupe(base: string, ext: string, taken: ReadonlySet<string>): string {
  const dot = ext ? `.${ext}` : '';
  let name = `${base}${dot}`;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}${dot}`;
  return name;
}

export function clipboardImageName(
  file: Pick<File, 'name' | 'type'>,
  now: Date,
  taken: ReadonlySet<string>,
): string {
  if (!GENERIC_NAME.test(file.name.trim())) return file.name;
  const ext = MIME_EXT[file.type] ?? 'png';
  return dedupe(`image-${ts(now)}`, ext, taken);
}

export function classifyFile(file: Pick<File, 'name' | 'type'>): 'image' | 'file' {
  if ((file.type ?? '').startsWith('image/')) return 'image';
  return IMAGE_EXTENSIONS.has(extOf(file.name)) ? 'image' : 'file';
}

export function stagedFileName(file: Pick<File, 'name'>, taken: ReadonlySet<string>): string {
  const clean = file.name.replace(/[!|\]]/g, '') || 'file';
  const ext = extOf(clean);
  const base = ext ? clean.slice(0, clean.length - ext.length - 1) : clean;
  return dedupe(base, ext, taken);
}

/** `name`, or `name-2.ext`, `name-3.ext`… when it is already taken (WR-03). */
export function uniqueFileName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const ext = extOf(name);
  return dedupe(ext ? name.slice(0, name.length - ext.length - 1) : name, ext, taken);
}

export function renameFile(file: File, name: string): File {
  if (file.name === name) return file;
  return new File([file], name, { type: file.type, lastModified: file.lastModified });
}
