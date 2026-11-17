import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { EditorContent, useEditor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EDITOR_RULE_OPTIONS, editorExtensions } from '../extensions';
import { installLayoutStubs, liveEditor, renderEditor } from '../shell-test-utils';
import {
  createSuggestionExtension,
  exitAllSuggestions,
  isAnySuggestionActive,
} from './create-suggestion';

installLayoutStubs();

const itemsSpy = vi.fn();
const rows = [
  { key: 'a', label: 'Alpha', data: 'a' },
  { key: 'b', label: 'Beta', data: 'b' },
];

// Module scope on purpose: extension lists must never be rebuilt per render.
const TestHash = createSuggestionExtension({
  name: 'testHash',
  char: '#',
  maxRows: 8,
  items: (args) => itemsSpy(args) ?? rows,
  command: ({ editor, range, row }) => {
    editor.chain().focus().insertContentAt(range, `${row.label} `).run();
  },
});
const EXTENSIONS = [...editorExtensions, TestHash];

let current: Editor | null = null;

function Harness() {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: '<p>a</p>',
    ...EDITOR_RULE_OPTIONS,
  });
  current = editor;
  return <EditorContent editor={editor} />;
}

function typeChars(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
    });
  }
}

const popovers = () => document.body.querySelectorAll('[data-suggestion]');
const esc = (editor: Editor) =>
  act(() => {
    fireEvent.keyDown(editor.view.dom, { key: 'Escape' });
  });

async function openIn(editor: Editor) {
  act(() => {
    editor.commands.focus('end');
  });
  typeChars(editor, ' #q');
  await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
}

afterEach(() => {
  itemsSpy.mockReset();
  current = null;
});

describe('suggestion lifecycle', () => {
  it('never opens in an unfocused editor after a programmatic content reset (99 UAT gap)', async () => {
    render(<Harness />);
    await waitFor(() => expect(current).not.toBeNull());
    const editor = current as Editor;
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      editor.commands.setContent('<p>a #q</p>', { emitUpdate: false });
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });
    expect(editor.isFocused).toBe(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(popovers().length).toBe(0);
    expect(isAnySuggestionActive(editor.state)).toBe(false);
  });

  it('opens on the trigger, closes on Esc and leaves the trigger text', async () => {
    render(<Harness />);
    await waitFor(() => expect(current).not.toBeNull());
    const editor = current as Editor;
    await openIn(editor);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    esc(editor);
    await waitFor(() => expect(popovers()).toHaveLength(0));
    expect(editor.state.doc.textContent).toBe('a #q');
  });

  it('Enter replaces the trigger in one transaction (one undo restores it)', async () => {
    render(<Harness />);
    const editor = current as Editor;
    await openIn(editor);
    act(() => {
      editor.view.dispatch(closeHistory(editor.state.tr));
    });
    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: 'Enter' });
    });
    expect(editor.state.doc.textContent).toBe('a Alpha ');
    act(() => {
      editor.commands.undo();
    });
    expect(editor.state.doc.textContent).toBe('a #q');
  });

  it('leaves no popover DOM after destroy', async () => {
    render(<Harness />);
    const editor = current as Editor;
    await openIn(editor);
    act(() => {
      editor.destroy();
    });
    expect(popovers()).toHaveLength(0);
  });

  it('exitAllSuggestions closes an open popover', async () => {
    render(<Harness />);
    const editor = current as Editor;
    await openIn(editor);
    expect(isAnySuggestionActive(editor.state)).toBe(true);
    act(() => exitAllSuggestions(editor));
    expect(isAnySuggestionActive(editor.state)).toBe(false);
    await waitFor(() => expect(popovers()).toHaveLength(0));
  });

  it('first Esc inside a Dialog closes only the popover, the second closes the dialog', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <Harness />
        </DialogContent>
      </Dialog>,
    );
    await waitFor(() => expect(current).not.toBeNull());
    const editor = current as Editor;
    await openIn(editor);
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('[data-suggestion]')).not.toBeNull();
    esc(editor);
    await waitFor(() => expect(popovers()).toHaveLength(0));
    expect(onOpenChange).not.toHaveBeenCalled();
    esc(editor);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalled());
  });

  it('aborts the signal of a superseded query', async () => {
    const signals: AbortSignal[] = [];
    itemsSpy.mockImplementation(({ signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    render(<Harness />);
    const editor = current as Editor;
    act(() => {
      editor.commands.focus('end');
    });
    typeChars(editor, ' #q');
    await waitFor(() => expect(signals.length).toBeGreaterThan(0));
    typeChars(editor, 'z');
    await waitFor(() => expect(signals[0]?.aborted).toBe(true));
  });
});

describe('WikiEditor integration', () => {
  it('switching to source removes an open popover', async () => {
    renderEditor({ value: 'a', onChange: vi.fn() });
    const editor = liveEditor();
    act(() => {
      const plugins = TestHash.config.addProseMirrorPlugins?.call({ editor } as never) ?? [];
      for (const p of plugins) editor.registerPlugin(p);
    });
    await openIn(editor);
    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: 'M', metaKey: true, shiftKey: true });
    });
    await waitFor(() => expect(popovers()).toHaveLength(0));
  });
});
