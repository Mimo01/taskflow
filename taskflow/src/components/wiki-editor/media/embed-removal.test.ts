import { closeHistory, undo } from '@tiptap/pm/history';
import { describe, expect, it } from 'vitest';
import { WIKI_TOGGLE_META } from '../editor-session';
import { editorExtensions } from '../extensions';
import { makeEditor } from '../test-utils';
import type { WikiEditorHost } from '../types';
import { dismissRemovalNotice, getRemovalNotice, WikiEmbedRemoval } from './embed-removal';
import { startUploads, WikiUpload } from './upload-plugin';

const exts = [...editorExtensions, WikiUpload, WikiEmbedRemoval];
const flush = () => new Promise((r) => setTimeout(r, 0));
const png = (name: string) => new File(['x'], name, { type: 'image/png' });

type Ed = ReturnType<typeof makeEditor>['editor'];

function setup(text: string, host: WikiEditorHost) {
  const made = makeEditor(text, exts);
  made.editor.storage.wikiHost.set(host, undefined);
  return made;
}

const uploadHost = (extra: Partial<WikiEditorHost> = {}): WikiEditorHost => ({
  uploadFile: (f) =>
    Promise.resolve({ id: 'ID1', filename: f.name, mimeType: 'image/png', content: 'https://j/c' }),
  ...extra,
});

function embedRange(editor: Ed, name: string): [number, number] | null {
  let r: [number, number] | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (!r && node.attrs.name === name && ['image', 'attachment'].includes(node.type.name)) {
      r = [pos, pos + node.nodeSize];
    }
  });
  return r;
}

function removeEmbed(
  editor: Ed,
  name: string,
  meta?: (tr: ReturnType<Ed['state']['tr']['delete']>) => void,
) {
  const r = embedRange(editor, name);
  if (!r) throw new Error('no embed');
  const tr = editor.state.tr.delete(r[0], r[1]);
  meta?.(tr);
  editor.view.dispatch(tr);
}

async function uploaded(host = uploadHost()) {
  const made = setup('hello', host);
  startUploads(made.editor, [png('a.png')], 3);
  await flush();
  expect(embedRange(made.editor, 'a.png')).not.toBeNull();
  return made;
}

describe('WikiEmbedRemoval', () => {
  it('offers deletion for a session upload removed by the user', async () => {
    const { editor } = await uploaded();
    removeEmbed(editor, 'a.png');
    expect(getRemovalNotice(editor.state)).toEqual({ filename: 'a.png', attachmentId: 'ID1' });
  });

  it('does not offer for a pre-existing attachment', () => {
    const { editor } = setup('!b.png!', uploadHost());
    removeEmbed(editor, 'b.png');
    expect(getRemovalNotice(editor.state)).toBeNull();
  });

  it('does not offer when the same file is still in the text', async () => {
    const { editor } = await uploaded();
    const r = embedRange(editor, 'a.png');
    const node = r ? editor.state.doc.nodeAt(r[0]) : null;
    if (!r || !node) throw new Error('no embed');
    editor.view.dispatch(editor.state.tr.insert(r[1], node.copy(node.content)));
    removeEmbed(editor, 'a.png');
    expect(embedRange(editor, 'a.png')).not.toBeNull();
    expect(getRemovalNotice(editor.state)).toBeNull();
  });

  it('does not offer when the host says it is referenced elsewhere', async () => {
    const { editor } = await uploaded(uploadHost({ isReferencedElsewhere: () => true }));
    removeEmbed(editor, 'a.png');
    expect(getRemovalNotice(editor.state)).toBeNull();
  });

  it('never offers for staged embeds', async () => {
    const staged: File[] = [];
    const { editor } = setup('hello', { staged: true, stageFile: (f) => staged.push(f) });
    startUploads(editor, [png('a.png')], 3);
    await flush();
    const name = staged[0]?.name;
    expect(name).toBeTruthy();
    removeEmbed(editor, name);
    expect(getRemovalNotice(editor.state)).toBeNull();
  });

  it('ignores toggle and addToHistory:false transactions', async () => {
    const a = await uploaded();
    removeEmbed(a.editor, 'a.png', (tr) => tr.setMeta(WIKI_TOGGLE_META, true));
    expect(getRemovalNotice(a.editor.state)).toBeNull();
    const b = await uploaded();
    removeEmbed(b.editor, 'a.png', (tr) => tr.setMeta('addToHistory', false));
    expect(getRemovalNotice(b.editor.state)).toBeNull();
  });

  it('undo clears the notice', async () => {
    const { editor } = await uploaded();
    editor.view.dispatch(closeHistory(editor.state.tr).setMeta('addToHistory', false));
    removeEmbed(editor, 'a.png');
    expect(getRemovalNotice(editor.state)).not.toBeNull();
    undo(editor.state, editor.view.dispatch);
    expect(embedRange(editor, 'a.png')).not.toBeNull();
    expect(getRemovalNotice(editor.state)).toBeNull();
  });

  it('a new removal replaces the notice; dismiss clears it', async () => {
    const { editor } = await uploaded();
    startUploads(editor, [png('c.png')], 3);
    await flush();
    removeEmbed(editor, 'a.png');
    removeEmbed(editor, 'c.png');
    expect(getRemovalNotice(editor.state)?.filename).toBe('c.png');
    dismissRemovalNotice(editor);
    expect(getRemovalNotice(editor.state)).toBeNull();
  });
});
