import { render } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import type { WikiEditorProps } from './types';
import WikiEditor from './WikiEditor';

/** Test-only helpers for the shell tests. Not imported by app code. */
export function installLayoutStubs() {
  beforeAll(() => {
    const rect = {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    };
    const list = () => Object.assign([rect], { item: () => rect }) as unknown as DOMRectList;
    Range.prototype.getClientRects = list;
    Range.prototype.getBoundingClientRect = () => rect as DOMRect;
    Element.prototype.getClientRects = list;
    Element.prototype.scrollIntoView = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  beforeEach(() => {
    useSettingsStore.setState({ wikiEditorMode: 'rich' });
  });
}

export function renderEditor(props: WikiEditorProps) {
  const ui = (p: WikiEditorProps) => (
    <MemoryRouter>
      <WikiEditor {...p} />
    </MemoryRouter>
  );
  const result = render(ui(props));
  return { ...result, rerenderWith: (p: WikiEditorProps) => result.rerender(ui(p)) };
}

/** The live TipTap editor behind the rendered content (tiptap stores it on the view DOM). */
export function liveEditor(): Editor {
  const dom = document.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null;
  if (!dom?.editor) throw new Error('no live editor');
  return dom.editor;
}

export function typeAt(editor: Editor, pos: number, text: string) {
  editor.view.dispatch(editor.state.tr.insertText(text, pos));
}

/** The source textarea (the contenteditable also has role=textbox, so query by tag). */
export function textarea(): HTMLTextAreaElement {
  const el = document.querySelector('textarea');
  if (!el) throw new Error('no source textarea');
  return el;
}
