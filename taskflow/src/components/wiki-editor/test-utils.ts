import { Editor } from '@tiptap/core';
import { afterEach } from 'vitest';
import type { WikiLoad, WikiSave } from '@/lib/wiki/editor';
import { loadWiki, saveWiki } from '@/lib/wiki/editor';
import { EDITOR_RULE_OPTIONS, editorExtensions } from './extensions';

type RichLoad = Extract<WikiLoad, { doc: unknown }>;

/*
 * Every editor made here is destroyed after each test. A live ProseMirror view keeps a
 * DOMObserver timer that can fire after jsdom tears down ("document is not defined"),
 * which vitest reports as an unhandled error and fails the whole run.
 */
const liveEditors = new Set<Editor>();
afterEach(() => {
  for (const editor of liveEditors) if (!editor.isDestroyed) editor.destroy();
  liveEditors.clear();
});

/** Test helper: headless editor over wiki text. Not imported by app code. */
export function makeEditor(text: string, extensions: typeof editorExtensions = editorExtensions) {
  const load = loadWiki(text);
  if (!('doc' in load)) throw new Error(`fixture did not load rich: ${load.kind}`);
  const editor = new Editor({
    element: document.createElement('div'),
    extensions,
    content: load.doc,
    ...EDITOR_RULE_OPTIONS,
  });
  liveEditors.add(editor);
  return { editor, load: load as RichLoad };
}

/** Feed characters through handleTextInput (so input rules run as in a browser). */
export function typeText(editor: Editor, text: string): void {
  const { view } = editor;
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, ch, () => view.state.tr),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
}

export function saveText(editor: Editor, load: RichLoad): WikiSave {
  return saveWiki(load, editor.state.doc);
}
