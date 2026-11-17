import { type Editor, Extension, type JSONContent } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { type Node as PMNode, type ResolvedPos, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import * as pmView from '@tiptap/pm/view';
import { loadWiki } from '@/lib/wiki/editor';
import { useAuthStore } from '@/stores/auth.store';
import { getHost } from '../host';
import { isSafeLinkUrl } from '../link-url';
import { type UploadEntry, withUploads } from '../media/upload-plugin';
import { clipboardImageName, renameFile } from '../media/upload-state';
import { normalisePastedHtml, PASTE_IMAGE_MARKER_PREFIX } from './html-normalise';
import { looksLikeWiki } from './wiki-text';

/** `__parseFromClipboard` is exported at runtime but missing from the type declarations. */
const parseFromClipboard = (
  pmView as unknown as {
    __parseFromClipboard: (
      view: Editor['view'],
      text: string,
      html: string | null,
      plain: boolean,
      $context: ResolvedPos,
    ) => Slice;
  }
).__parseFromClipboard;

const BLOCK_HTML = /<(h[1-6]|ul|ol|table|pre|blockquote|hr)\b/i;
const FETCH_TIMEOUT_MS = 5000;

function nameFromUrl(url: string): string | null {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    const clean = decodeURIComponent(last).replace(/[^\w.() -]/g, '');
    return /\.[A-Za-z0-9]{2,5}$/.test(clean) ? clean : null;
  } catch {
    return null;
  }
}

function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

/** One fetch, 5s timeout, image content-type only; no retries and no Referer tweaks (T-99-35). */
export async function fetchPastedImage(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<File> {
  const res = await fetch(url, { signal: timeoutSignal(timeoutMs) });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) throw new Error('not an image');
  const blob = await res.blob();
  const name =
    nameFromUrl(url) ?? clipboardImageName({ name: 'image.png', type }, new Date(), new Set());
  return new File([blob], name, { type });
}

function decodeDataUrl(url: string, name: string): File {
  const m = /^data:([^;,]+)?((?:;[^;,]+)*?),(.*)$/is.exec(url);
  if (!m) throw new Error('bad data url');
  const type = m[1] || 'image/png';
  const body = m[3];
  const bytes = m[2].includes(';base64')
    ? Uint8Array.from(atob(decodeURIComponent(body)), (c) => c.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body));
  return new File([bytes], name, { type });
}

function linkFallback(src: string): JSONContent | null {
  if (!isSafeLinkUrl(src)) return null;
  return { type: 'text', text: src, marks: [{ type: 'link', attrs: { href: src } }] };
}

function canUpload(editor: Editor): boolean {
  const host = getHost(editor);
  return Boolean(host.uploadFile) || Boolean(host.staged && host.stageFile);
}

function handleHtml(editor: Editor, view: Editor['view'], html: string, text: string): boolean {
  const host = getHost(editor);
  const { html: clean, images } = normalisePastedHtml(html, {
    jiraBaseUrl: useAuthStore.getState().jiraBaseUrl,
    attachments: host.attachments,
  });
  if (!clean.trim() && images.length === 0) return false;
  const slice = parseFromClipboard(view, text, clean, false, view.state.selection.$from);
  const tr = view.state.tr.replaceSelection(slice);

  const found: { pos: number; marker: string }[] = [];
  tr.doc.descendants((node, pos) => {
    if (
      node.type.name === 'image' &&
      String(node.attrs.name).startsWith(PASTE_IMAGE_MARKER_PREFIX)
    ) {
      found.push({ pos, marker: String(node.attrs.name) });
    }
  });
  const byMarker = new Map(images.map((i) => [i.marker, i]));
  const uploading = canUpload(editor);
  const taken = new Set<string>(host.attachments.map((a) => a.filename));
  const entries: UploadEntry[] = [];
  const items = found.map((f, i) => {
    const img = byMarker.get(f.marker);
    return { ...f, img, offset: i };
  });
  // Delete in reverse document order so earlier positions stay valid.
  for (const it of [...items].reverse()) {
    const fallback = it.img ? linkFallback(it.img.src) : null;
    if (!uploading) {
      const node: PMNode | null = fallback ? editor.schema.nodeFromJSON(fallback) : null;
      if (node) tr.replaceWith(it.pos, it.pos + 1, node);
      else tr.delete(it.pos, it.pos + 1);
    } else {
      tr.delete(it.pos, it.pos + 1);
    }
  }
  if (uploading) {
    for (const it of items) {
      const img = it.img;
      if (!img) continue;
      const src = img.src;
      const generic = clipboardImageName(
        { name: 'image.png', type: 'image/png' },
        new Date(),
        taken,
      );
      const urlName = src.startsWith('data:') ? null : nameFromUrl(src);
      const name = img.alt && /\.\w{2,5}$/.test(img.alt) ? img.alt : (urlName ?? generic);
      taken.add(name);
      entries.push({
        name,
        pos: it.pos - it.offset,
        load: () =>
          src.startsWith('data:')
            ? Promise.resolve(decodeDataUrl(src, name))
            : fetchPastedImage(src).then((f) => renameFile(f, name)),
        fallback: src.startsWith('data:') ? null : linkFallback(src),
      });
    }
    view.dispatch(withUploads(tr, editor, entries));
  } else {
    view.dispatch(tr);
  }
  return true;
}

function handleWikiText(editor: Editor, view: Editor['view'], text: string): boolean {
  const load = loadWiki(text);
  if (load.kind === 'failed' || !('doc' in load) || !load.doc) return false;
  let parsed: Slice;
  try {
    parsed = Slice.maxOpen(editor.schema.nodeFromJSON(load.doc).content);
  } catch {
    return false;
  }
  const { from, to, $from } = view.state.selection;
  // Isolate the paste from earlier typing, then step 1: the literal text as plain paragraphs.
  view.dispatch(closeHistory(view.state.tr));
  const tr1 = view.state.tr.replaceSelection(parseFromClipboard(view, text, null, true, $from));
  const end = tr1.mapping.map(to, 1);
  view.dispatch(closeHistory(tr1));
  // Step 2: replace that literal range with the parsed rich content (own undo step).
  const tr2 = view.state.tr.replaceRange(from, end, parsed);
  view.dispatch(closeHistory(tr2));
  return true;
}

/** HTML / wiki-text / plain-mode paste (D-12..D-15). Registered after WikiLinkPaste. */
export const WikiSmartPaste = Extension.create({
  name: 'wikiSmartPaste',
  addProseMirrorPlugins() {
    const editor = this.editor;
    let plainNext = false;
    return [
      new Plugin({
        key: new PluginKey('wikiSmartPaste'),
        props: {
          handleKeyDown: (_view, e) => {
            if (e.key.toLowerCase() === 'v' && (e.metaKey || e.ctrlKey)) plainNext = e.shiftKey;
            return false;
          },
          handlePaste: (view, event) => {
            const plain = plainNext;
            plainNext = false;
            if (plain) return false;
            // Code and monospace keep pasted text literal: never convert wiki/HTML there.
            const { $from } = view.state.selection;
            if ($from.parent.type.spec.code || $from.marks().some((m) => m.type.name === 'mono')) {
              return false;
            }
            const data = event.clipboardData;
            const html = data?.getData('text/html') ?? '';
            const text = data?.getData('text/plain') ?? '';
            const types = Array.from(data?.types ?? []);
            if (html.includes('data-pm-slice')) return false;
            const htmlHasBlocks = BLOCK_HTML.test(html);
            const codeWrapper = types.includes('vscode-editor-data');
            if (text && looksLikeWiki(text) && (!html || codeWrapper || !htmlHasBlocks)) {
              if (handleWikiText(editor, view, text)) {
                event.preventDefault();
                return true;
              }
            }
            if (html.trim()) {
              if (handleHtml(editor, view, html, text)) {
                event.preventDefault();
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
