import { undo } from '@tiptap/pm/history';
import { Slice } from '@tiptap/pm/model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import webArticle from '../__fixtures__/paste/web-article.html?raw';
import { editorExtensions } from '../extensions';
import { WikiUpload } from '../media/upload-plugin';
import { makeEditor, saveText } from '../test-utils';
import type { WikiEditorHost } from '../types';
import { fetchPastedImage, WikiSmartPaste } from './paste-plugin';

const exts = [...editorExtensions, WikiUpload, WikiSmartPaste];

function setup(text: string, host: WikiEditorHost = {}) {
  const made = makeEditor(text, exts);
  made.editor.storage.wikiHost.set(host, undefined);
  return made;
}

type Ed = ReturnType<typeof makeEditor>['editor'];

function fakeEvent(map: Record<string, string>) {
  return {
    clipboardData: {
      files: [],
      types: Object.keys(map),
      getData: (t: string) => map[t] ?? '',
    },
    preventDefault: vi.fn(),
  } as unknown as ClipboardEvent;
}

function paste(editor: Ed, map: Record<string, string>): boolean {
  const { view } = editor;
  return Boolean(view.someProp('handlePaste', (f) => f(view, fakeEvent(map), Slice.empty)));
}

function key(editor: Ed, k: string, mods: { metaKey?: boolean; shiftKey?: boolean }) {
  const { view } = editor;
  const ev = { key: k, metaKey: false, ctrlKey: false, shiftKey: false, ...mods } as KeyboardEvent;
  view.someProp('handleKeyDown', (f) => f(view, ev));
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function types(editor: Ed): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((n) => {
    out.push(n.type.name);
  });
  return out;
}

function images(editor: Ed): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((n) => {
    if (n.type.name === 'image') out.push(String(n.attrs.name));
  });
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HTML paste', () => {
  it('inserts schema nodes only from the web-article fixture', () => {
    const { editor, load } = setup('x');
    const handled = paste(editor, { 'text/html': webArticle, 'text/plain': 'Lorem' });
    expect(handled).toBe(true);
    const names = types(editor);
    expect(names).toContain('heading');
    expect(names).toContain('bulletList');
    expect(names).toContain('table');
    expect(editor.state.doc.textContent).not.toContain('<script');
    expect(saveText(editor, load).kind).toBe('saved');
  });

  it('leaves ProseMirror slice HTML to ProseMirror', () => {
    const { editor } = setup('x');
    expect(
      paste(editor, { 'text/html': '<p data-pm-slice="1 1 []">inner</p>', 'text/plain': 'inner' }),
    ).toBe(false);
  });
});

describe('HTML images', () => {
  const dataHtml = '<p>a<img src="data:image/png;base64,AAAA" alt="">b</p>';

  it('uploads a data: image as an attachment where it appeared', async () => {
    const created = (filename: string): JiraAttachment => ({
      id: '1',
      filename,
      mimeType: 'image/png',
      content: 'https://j/c/1',
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    let resolveUpload: (a: JiraAttachment) => void = () => {};
    const uploadFile = vi.fn(
      (f: File) =>
        new Promise<JiraAttachment>((res) => {
          resolveUpload = () => res(created(f.name));
        }),
    );
    const { editor } = setup('x', { uploadFile });
    const seen: string[][] = [];
    editor.on('transaction', () => seen.push(images(editor)));
    expect(paste(editor, { 'text/html': dataHtml, 'text/plain': 'ab' })).toBe(true);
    expect(editor.view.dom.querySelectorAll('[data-wiki-upload]')).toHaveLength(1);
    expect(images(editor)).toEqual([]);
    await flush();
    expect(uploadFile).toHaveBeenCalledTimes(1);
    resolveUpload(created('x'));
    await flush();
    const result = images(editor);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^image-.*\.png$/);
    expect(seen.flat().some((n) => n.startsWith('wiki-paste-image-'))).toBe(false);
    // The upload landed between the two text halves.
    expect(editor.state.doc.textContent).toContain('a');
  });

  it('falls back to a link when a remote image cannot be fetched', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    const uploadFile = vi.fn();
    const { editor, load } = setup('x', { uploadFile });
    const html = '<p>see <img src="https://example.invalid/x.png"> end</p>';
    expect(paste(editor, { 'text/html': html, 'text/plain': 'see end' })).toBe(true);
    await flush();
    await flush();
    expect(uploadFile).not.toHaveBeenCalled();
    expect(images(editor)).toEqual([]);
    expect(editor.state.doc.textContent).toContain('https://example.invalid/x.png');
    expect(editor.view.dom.querySelectorAll('[data-wiki-upload]')).toHaveLength(0);
    expect(saveText(editor, load).kind).toBe('saved');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('fetchPastedImage uses a 5000ms timeout signal', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new Blob(['x'], { type: 'image/png' }), {
          headers: { 'content-type': 'image/png' },
        }),
      ),
    );
    const f = await fetchPastedImage('https://example.invalid/pic.png');
    expect(spy).toHaveBeenCalledWith(5000);
    expect(f.name).toBe('pic.png');
  });

  it('rejects a non-image response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('x', { headers: { 'content-type': 'text/html' } })),
    );
    await expect(fetchPastedImage('https://example.invalid/pic.png')).rejects.toThrow();
  });

  it('without upload support, a remote image becomes a link and a data image is dropped', () => {
    const { editor } = setup('x', {});
    paste(editor, {
      'text/html':
        '<p>a<img src="https://example.invalid/y.png">b<img src="data:image/png;base64,AAAA"></p>',
      'text/plain': 'ab',
    });
    expect(images(editor)).toEqual([]);
    expect(editor.state.doc.textContent).toContain('https://example.invalid/y.png');
  });
});

describe('wiki text paste', () => {
  it('parses wiki markup with a two-step undo', () => {
    const { editor } = setup('before');
    const before = editor.state.doc.textContent;
    expect(paste(editor, { 'text/plain': 'h2. Title\n* a\n* b' })).toBe(true);
    const names = types(editor);
    expect(names).toContain('heading');
    expect(names).toContain('bulletList');

    undo(editor.state, editor.view.dispatch);
    const mid = types(editor);
    expect(mid).not.toContain('heading');
    expect(mid).not.toContain('bulletList');
    expect(editor.state.doc.textContent).toContain('h2. Title');
    expect(editor.state.doc.textContent).toContain('* a');

    undo(editor.state, editor.view.dispatch);
    expect(editor.state.doc.textContent).toBe(before);
  });

  it('leaves plain words to the default paste', () => {
    const { editor } = setup('x');
    expect(paste(editor, { 'text/plain': 'just words' })).toBe(false);
  });

  it('prefers HTML when it has block structure, wiki text for inline-only HTML', () => {
    const a = setup('x');
    paste(a.editor, {
      'text/html': '<h1>Head</h1><p>body</p>',
      'text/plain': 'h2. Title\n* a\n* b',
    });
    expect(a.editor.state.doc.textContent).toContain('Head');
    expect(a.editor.state.doc.textContent).not.toContain('Title');

    const b = setup('x');
    paste(b.editor, {
      'text/html': '<span>h2. Title</span><br><span>* a</span>',
      'text/plain': 'h2. Title\n* a\n* b',
    });
    expect(types(b.editor)).toContain('heading');
  });
});

describe('plain paste mode', () => {
  it('Cmd+Shift+V skips both paths once', () => {
    const { editor } = setup('x');
    key(editor, 'v', { metaKey: true, shiftKey: true });
    expect(paste(editor, { 'text/html': '<h1>Head</h1>', 'text/plain': 'Head' })).toBe(false);

    key(editor, 'v', { metaKey: true, shiftKey: true });
    expect(paste(editor, { 'text/plain': 'h2. Title\n* a\n* b' })).toBe(false);
    expect(types(editor)).not.toContain('heading');

    key(editor, 'v', { metaKey: true });
    expect(paste(editor, { 'text/html': '<h1>Head</h1>', 'text/plain': 'Head' })).toBe(true);
    expect(types(editor)).toContain('heading');
  });

  it('a single URL over a selection is still linked (WikiLinkPaste first)', () => {
    const { editor } = setup('hello world');
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(paste(editor, { 'text/plain': 'https://example.invalid/a' })).toBe(true);
    expect(editor.getHTML()).toContain('href="https://example.invalid/a"');
  });
});
