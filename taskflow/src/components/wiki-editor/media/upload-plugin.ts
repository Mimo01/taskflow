import { type Editor, Extension, type JSONContent } from '@tiptap/core';
import {
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { getHost, setLocalPreview } from '../host';
import { embedContentFor } from './embed';
import { classifyFile, clipboardImageName, renameFile, stagedFileName } from './upload-state';

/*
 * Upload placeholders are widget decorations held in plugin state, never document nodes, so a
 * pending upload can never reach the saved wiki string (D-06). Resolution inserts the embed
 * node at the placeholder's mapped position.
 */

interface Placeholder {
  id: string;
  seq: number;
  pos: number;
  name: string;
}

export interface UploadState {
  placeholders: readonly Placeholder[];
  failures: readonly string[];
  session: ReadonlyMap<string, string>;
}

interface UploadMeta {
  add?: Placeholder[];
  remove?: string;
  fail?: string;
  session?: [string, string];
  clearFailures?: boolean;
  /** Pre-transaction position + seq of a resolving placeholder (keeps batch order). */
  insertAt?: { pos: number; seq: number };
}

export interface UploadEntry {
  name: string;
  pos: number;
  load: () => Promise<File>;
  fallback?: JSONContent | null;
}

export const uploadPluginKey = new PluginKey<UploadState>('wikiUpload');

let counter = 0;

export function getUploadFailures(state: EditorState): readonly string[] {
  return uploadPluginKey.getState(state)?.failures ?? [];
}

export function getSessionUploads(state: EditorState): ReadonlyMap<string, string> {
  return uploadPluginKey.getState(state)?.session ?? new Map();
}

export function clearUploadFailures(editor: Editor): void {
  if (editor.isDestroyed) return;
  const meta: UploadMeta = { clearFailures: true };
  editor.view.dispatch(
    editor.state.tr.setMeta(uploadPluginKey, meta).setMeta('addToHistory', false),
  );
}

function placeholderDom(name: string): HTMLElement {
  const root = document.createElement('span');
  root.setAttribute('data-wiki-upload', '');
  root.setAttribute('aria-busy', 'true');
  root.setAttribute('aria-label', `Uploading ${name}`);
  root.contentEditable = 'false';
  root.className =
    'inline-flex h-5 max-w-40 items-center gap-1 rounded border border-dashed border-border bg-muted/30 px-2 align-middle text-xs text-muted-foreground';
  const spin = document.createElement('span');
  spin.className = 'size-3 animate-spin rounded-full border border-current border-t-transparent';
  const label = document.createElement('span');
  label.className = 'truncate';
  label.textContent = name;
  root.append(spin, label);
  return root;
}

function mergeMeta(tr: Transaction, patch: UploadMeta): UploadMeta {
  const prev = (tr.getMeta(uploadPluginKey) as UploadMeta | undefined) ?? {};
  return { ...prev, ...patch, add: [...(prev.add ?? []), ...(patch.add ?? [])] };
}

function docNames(editor: Editor): Set<string> {
  const names = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image' || node.type.name === 'attachment') {
      const n = node.attrs.name;
      if (typeof n === 'string') names.add(n);
    }
  });
  for (const a of getHost(editor).attachments) names.add(a.filename);
  return names;
}

function nodeFor(editor: Editor, content: JSONContent) {
  try {
    return editor.schema.nodeFromJSON(content);
  } catch {
    return null;
  }
}

function dispatchResolution(
  editor: Editor,
  id: string,
  patch: UploadMeta,
  content: JSONContent | null | undefined,
): void {
  if (editor.isDestroyed) return;
  const ph = uploadPluginKey.getState(editor.state)?.placeholders.find((p) => p.id === id);
  if (!ph) return;
  const tr = editor.state.tr;
  const node = content ? nodeFor(editor, content) : null;
  if (node) tr.insert(ph.pos, node);
  const meta: UploadMeta = { ...patch, remove: id, insertAt: { pos: ph.pos, seq: ph.seq } };
  tr.setMeta(uploadPluginKey, meta);
  if (!node) tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}

async function runEntry(editor: Editor, entry: UploadEntry, ph: Placeholder): Promise<void> {
  let file: File;
  try {
    file = await entry.load();
  } catch {
    dispatchResolution(editor, ph.id, {}, entry.fallback);
    return;
  }
  if (editor.isDestroyed) return;
  const host = getHost(editor);
  if (host.staged && host.stageFile) {
    const renamed = renameFile(file, stagedFileName(file, docNames(editor)));
    host.stageFile(renamed);
    const isImage = classifyFile(renamed) === 'image';
    if (isImage) setLocalPreview(editor, renamed.name, URL.createObjectURL(renamed));
    dispatchResolution(
      editor,
      ph.id,
      {},
      embedContentFor({
        filename: renamed.name,
        mimeType: renamed.type,
        content: '',
      }),
    );
    return;
  }
  if (!host.uploadFile) {
    dispatchResolution(editor, ph.id, { fail: entry.name }, null);
    return;
  }
  try {
    const created = await host.uploadFile(file);
    if (editor.isDestroyed) return;
    if (classifyFile(file) === 'image') {
      setLocalPreview(editor, created.filename, URL.createObjectURL(file));
    }
    dispatchResolution(
      editor,
      ph.id,
      { session: [created.filename, created.id], clearFailures: true },
      embedContentFor(created),
    );
  } catch {
    dispatchResolution(editor, ph.id, { fail: entry.name }, null);
  }
}

/** Adds placeholder metas to `tr` (positions are in the document after `tr`'s steps). */
export function withUploads(tr: Transaction, editor: Editor, entries: UploadEntry[]): Transaction {
  const placeholders: Placeholder[] = entries.map((e) => ({
    id: `up-${++counter}`,
    seq: counter,
    pos: e.pos,
    name: e.name,
  }));
  tr.setMeta(uploadPluginKey, mergeMeta(tr, { add: placeholders }));
  if (!tr.docChanged) tr.setMeta('addToHistory', false);
  queueMicrotask(() => {
    if (editor.isDestroyed) return;
    entries.forEach((entry, i) => {
      void runEntry(editor, entry, placeholders[i]);
    });
  });
  return tr;
}

export function startUploads(editor: Editor, files: File[], pos: number): void {
  if (editor.isDestroyed || files.length === 0) return;
  const tr = editor.state.tr;
  withUploads(
    tr,
    editor,
    files.map((f) => ({ name: f.name, pos, load: () => Promise.resolve(f) })),
  );
  editor.view.dispatch(tr);
}

function canHandle(editor: Editor): boolean {
  const host = getHost(editor);
  return Boolean(host.uploadFile) || Boolean(host.staged && host.stageFile);
}

/** Replace [from,to] with files: staged -> embeds at once; otherwise placeholders. */
function ingest(editor: Editor, files: File[], from: number, to: number): void {
  const host = getHost(editor);
  const taken = docNames(editor);
  const prepared = files.map((f) => {
    const named =
      classifyFile(f) === 'image' ? renameFile(f, clipboardImageName(f, new Date(), taken)) : f;
    taken.add(named.name);
    return named;
  });
  const tr = editor.state.tr;
  if (to > from) tr.deleteRange(from, to);
  if (host.staged && host.stageFile) {
    const stageTaken = docNames(editor);
    let pos = from;
    for (const f of prepared) {
      const renamed = renameFile(f, stagedFileName(f, stageTaken));
      stageTaken.add(renamed.name);
      host.stageFile(renamed);
      if (classifyFile(renamed) === 'image') {
        setLocalPreview(editor, renamed.name, URL.createObjectURL(renamed));
      }
      const node = nodeFor(
        editor,
        embedContentFor({ filename: renamed.name, mimeType: renamed.type, content: '' }),
      );
      if (!node) continue;
      tr.insert(pos, node);
      pos += node.nodeSize;
    }
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))));
    editor.view.dispatch(tr);
    return;
  }
  withUploads(
    tr,
    editor,
    prepared.map((f) => ({ name: f.name, pos: from, load: () => Promise.resolve(f) })),
  );
  editor.view.dispatch(tr);
}

function htmlHasTextBesidesImages(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const img of Array.from(doc.querySelectorAll('img'))) img.remove();
  return (doc.body.textContent ?? '').trim().length > 0;
}

export const WikiUpload = Extension.create({
  name: 'wikiUpload',
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<UploadState>({
        key: uploadPluginKey,
        state: {
          init: () => ({ placeholders: [], failures: [], session: new Map() }),
          apply(tr, prev) {
            const meta = tr.getMeta(uploadPluginKey) as UploadMeta | undefined;
            let placeholders = prev.placeholders;
            if (tr.docChanged) {
              placeholders = placeholders.map((p) => {
                let pos = tr.mapping.map(p.pos, 1);
                if (meta?.insertAt && p.pos === meta.insertAt.pos && p.seq < meta.insertAt.seq) {
                  pos = p.pos;
                }
                return { ...p, pos };
              });
            }
            if (!meta) return placeholders === prev.placeholders ? prev : { ...prev, placeholders };
            if (meta.remove) placeholders = placeholders.filter((p) => p.id !== meta.remove);
            if (meta.add?.length) placeholders = [...placeholders, ...meta.add];
            let failures = prev.failures;
            if (meta.clearFailures) failures = [];
            if (meta.fail && !failures.includes(meta.fail)) failures = [...failures, meta.fail];
            let session = prev.session;
            if (meta.session) session = new Map(session).set(meta.session[0], meta.session[1]);
            return { placeholders, failures, session };
          },
        },
        props: {
          decorations(state) {
            const s = uploadPluginKey.getState(state);
            if (!s?.placeholders.length) return null;
            return DecorationSet.create(
              state.doc,
              s.placeholders.map((p) =>
                Decoration.widget(p.pos, () => placeholderDom(p.name), {
                  key: p.id,
                  side: 1,
                  ignoreSelection: true,
                }),
              ),
            );
          },
          handlePaste(view, event) {
            const files = Array.from(event.clipboardData?.files ?? []);
            if (files.length === 0 || !canHandle(editor)) return false;
            const html = event.clipboardData?.getData?.('text/html') ?? '';
            if (html && htmlHasTextBesidesImages(html)) return false;
            event.preventDefault();
            const { from, to } = view.state.selection;
            ingest(editor, files, from, to);
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            const files = Array.from(event.dataTransfer?.files ?? []);
            if (moved || files.length === 0 || !canHandle(editor)) return false;
            event.preventDefault();
            event.stopPropagation();
            const pos =
              view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
              view.state.selection.head;
            ingest(editor, files, pos, pos);
            return true;
          },
        },
      }),
    ];
  },
});
