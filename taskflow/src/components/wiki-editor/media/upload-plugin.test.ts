import { Slice } from '@tiptap/pm/model';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { editorExtensions } from '../extensions';
import { getLocalPreview } from '../host';
import type { WikiEditorHost } from '../types';
import { makeEditor, saveText } from '../test-utils';
import {
  clearUploadFailures,
  getSessionUploads,
  getUploadFailures,
  startUploads,
  WikiUpload,
  withUploads,
} from './upload-plugin';

const exts = [...editorExtensions, WikiUpload];

function setup(text: string, host: WikiEditorHost) {
  const made = makeEditor(text, exts);
  made.editor.storage.wikiHost.set(host, undefined);
  return made;
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' });
const pdf = (name: string) => new File(['x'], name, { type: 'application/pdf' });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const created = (filename: string, id = filename): JiraAttachment => ({
  id,
  filename,
  mimeType: filename.endsWith('.png') ? 'image/png' : 'application/pdf',
  content: `https://j/c/${id}`,
});

const flush = () => new Promise((r) => setTimeout(r, 0));

function pasteEvent(files: File[], html = '') {
  return {
    clipboardData: {
      files,
      getData: (t: string) => (t === 'text/html' ? html : ''),
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
}

function callPaste(editor: ReturnType<typeof makeEditor>['editor'], ev: ClipboardEvent) {
  const { view } = editor;
  return view.someProp('handlePaste', (f) => f(view, ev, Slice.empty));
}

function nodeNames(editor: ReturnType<typeof makeEditor>['editor']): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'image' || n.type.name === 'attachment') {
      out.push(`${n.type.name}:${n.attrs.name}`);
    }
  });
  return out;
}

describe('placeholders', () => {
  it('shows ordered widgets without touching the doc or saved text', async () => {
    const d = deferred<JiraAttachment>();
    const { editor, load } = setup('hello', { uploadFile: () => d.promise });
    startUploads(editor, [png('a.png'), pdf('b.pdf'), png('c.png')], 3);
    const widgets = Array.from(editor.view.dom.querySelectorAll('[data-wiki-upload]'));
    expect(widgets.map((w) => w.getAttribute('aria-label'))).toEqual([
      'Uploading a.png',
      'Uploading b.pdf',
      'Uploading c.png',
    ]);
    expect(widgets[0].getAttribute('aria-busy')).toBe('true');
    expect(nodeNames(editor)).toEqual([]);
    expect(saveText(editor, load).kind).toBe('unchanged');
  });

  it('typing before placeholders does not throw and shifts them', () => {
    const d = deferred<JiraAttachment>();
    const { editor } = setup('hello', { uploadFile: () => d.promise });
    startUploads(editor, [png('a.png')], 3);
    editor.commands.insertContentAt(1, 'zz');
    expect(editor.view.dom.querySelectorAll('[data-wiki-upload]')).toHaveLength(1);
  });
});

describe('resolution', () => {
  it('keeps original order when uploads resolve out of order, uses returned filename', async () => {
    const ds = {
      a: deferred<JiraAttachment>(),
      b: deferred<JiraAttachment>(),
      c: deferred<JiraAttachment>(),
    };
    const byName: Record<string, ReturnType<typeof deferred<JiraAttachment>>> = {
      'a.png': ds.a,
      'b.pdf': ds.b,
      'c.png': ds.c,
    };
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const { editor } = setup('hello', { uploadFile: (f) => byName[f.name].promise });
    startUploads(editor, [png('a.png'), pdf('b.pdf'), png('c.png')], 3);
    await flush();
    ds.c.resolve(created('c.png'));
    await flush();
    ds.a.resolve(created('a(1).png', 'A'));
    await flush();
    ds.b.resolve(created('b.pdf'));
    await flush();
    expect(nodeNames(editor)).toEqual(['image:a(1).png', 'attachment:b.pdf', 'image:c.png']);
    expect(editor.view.dom.querySelectorAll('[data-wiki-upload]')).toHaveLength(0);
    expect(getSessionUploads(editor.state).get('a(1).png')).toBe('A');
    expect(getLocalPreview(editor, 'a(1).png')).toBe('blob:x');
    spy.mockRestore();
  });

  it('a rejected upload records a failure and a later success clears it', async () => {
    const { editor } = setup('hello', {
      uploadFile: (f) =>
        f.name === 'bad.png' ? Promise.reject(new Error('no')) : Promise.resolve(created(f.name)),
    });
    startUploads(editor, [png('bad.png')], 3);
    await flush();
    expect(getUploadFailures(editor.state)).toEqual(['bad.png']);
    expect(editor.view.dom.querySelectorAll('[data-wiki-upload]')).toHaveLength(0);
    startUploads(editor, [pdf('ok.pdf')], 3);
    await flush();
    expect(nodeNames(editor)).toEqual(['attachment:ok.pdf']);
    expect(getUploadFailures(editor.state)).toEqual([]);
    startUploads(editor, [png('bad.png')], 3);
    await flush();
    expect(getUploadFailures(editor.state)).toEqual(['bad.png']);
    startUploads(editor, [pdf('later.pdf')], 3);
    await flush();
    expect(getUploadFailures(editor.state)).toEqual([]);
    clearUploadFailures(editor);
  });

  it('withUploads inserts the fallback when load fails', async () => {
    const { editor } = setup('hello', { uploadFile: () => Promise.reject(new Error('x')) });
    const tr = editor.state.tr;
    withUploads(tr, editor, [
      {
        name: 'remote.png',
        pos: 3,
        load: () => Promise.reject(new Error('cors')),
        fallback: { type: 'image', attrs: { name: 'https://x/y.png', params: null, src: null } },
      },
    ]);
    editor.view.dispatch(tr);
    await flush();
    expect(nodeNames(editor)).toEqual(['image:https://x/y.png']);
    expect(getUploadFailures(editor.state)).toEqual([]);
  });

  it('placeholder-only transactions are not added to history', () => {
    const { editor } = setup('hello', { uploadFile: () => new Promise(() => {}) });
    const tr = editor.state.tr;
    withUploads(tr, editor, [{ name: 'a.png', pos: 3, load: () => new Promise(() => {}) }]);
    expect(tr.getMeta('addToHistory')).toBe(false);
  });
});

describe('staged mode', () => {
  it('embeds at once with a sanitised unique name and a local preview', () => {
    const stageFile = vi.fn();
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:s');
    const { editor } = setup('hello', { staged: true, stageFile });
    editor.commands.setTextSelection(3);
    expect(callPaste(editor, pasteEvent([png('a|b!.png'), png('a|b!.png')]))).toBe(true);
    expect(editor.view.dom.querySelectorAll('[data-wiki-upload]')).toHaveLength(0);
    expect(nodeNames(editor)).toEqual(['image:ab.png', 'image:ab-2.png']);
    expect(stageFile.mock.calls.map((c) => (c[0] as File).name)).toEqual(['ab.png', 'ab-2.png']);
    expect(getLocalPreview(editor, 'ab.png')).toBe('blob:s');
    expect(getSessionUploads(editor.state).size).toBe(0);
    spy.mockRestore();
  });
});

describe('paste and drop handlers', () => {
  it('no-op without uploadFile or staging', () => {
    const { editor } = setup('hello', {});
    const ev = pasteEvent([png('a.png')]);
    expect(callPaste(editor, ev)).toBeFalsy();
    expect(ev.preventDefault).not.toHaveBeenCalled();
  });

  it('names a nameless clipboard image', async () => {
    const seen: string[] = [];
    const { editor } = setup('hello', {
      uploadFile: (f) => {
        seen.push(f.name);
        return Promise.resolve(created(f.name));
      },
    });
    editor.commands.setTextSelection(3);
    expect(callPaste(editor, pasteEvent([png('')]))).toBe(true);
    await flush();
    expect(seen[0]).toMatch(/^image-\d{8}-\d{6}\.png$/);
  });

  it('leaves mixed text+image html to the html paste path', () => {
    const { editor } = setup('hello', { uploadFile: () => new Promise(() => {}) });
    const ev = pasteEvent([png('a.png')], '<p>some text</p><img src="x">');
    expect(callPaste(editor, ev)).toBeFalsy();
    expect(callPaste(editor, pasteEvent([png('a.png')], '<img src="x">'))).toBe(true);
  });

  it('handleDrop stops propagation only with files', () => {
    const { editor } = setup('hello', { uploadFile: () => new Promise(() => {}) });
    const { view } = editor;
    vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 3, inside: -1 });
    const withFiles = {
      dataTransfer: { files: [png('a.png')] },
      clientX: 1,
      clientY: 1,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as DragEvent;
    expect(view.someProp('handleDrop', (f) => f(view, withFiles, Slice.empty, false))).toBe(true);
    expect(withFiles.preventDefault).toHaveBeenCalled();
    expect(withFiles.stopPropagation).toHaveBeenCalled();
    expect(editor.view.dom.querySelectorAll('[data-wiki-upload]')).toHaveLength(1);

    const none = {
      dataTransfer: { files: [] },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as DragEvent;
    expect(view.someProp('handleDrop', (f) => f(view, none, Slice.empty, false))).toBeFalsy();
    expect(none.stopPropagation).not.toHaveBeenCalled();
  });
});
