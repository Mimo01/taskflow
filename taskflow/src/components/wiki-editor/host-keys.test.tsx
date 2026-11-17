import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import { installLayoutStubs, liveEditor, renderEditor, textarea } from './shell-test-utils';
import type { WikiEditorHandle } from './types';
import { WikiEditorLazy } from './WikiEditorLazy';

installLayoutStubs();

const mod = { key: 'Enter', metaKey: true };
const popovers = () => document.body.querySelectorAll('[data-suggestion]');

async function openPopover() {
  const editor = liveEditor();
  act(() => {
    editor.commands.focus('end');
  });
  for (const ch of ' :st') {
    const { from, to } = editor.state.selection;
    act(() => {
      editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
    });
  }
  await waitFor(() => expect(popovers().length).toBeGreaterThan(0));
}

describe('Cmd+Enter submit (D-14)', () => {
  it('calls onSubmit with the current text and inserts no hard break', () => {
    const onSubmit = vi.fn();
    renderEditor({ value: 'Hello', onChange: vi.fn(), onSubmit });
    const editor = liveEditor();
    act(() => {
      editor.commands.focus('end');
    });
    fireEvent.keyDown(editor.view.dom, mod);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Hello');
    expect(editor.getJSON().content).toHaveLength(1);
    expect(editor.getHTML()).not.toContain('<br');
  });

  it('passes edited text', () => {
    const onSubmit = vi.fn();
    renderEditor({ value: 'Hello', onChange: vi.fn(), onSubmit });
    const editor = liveEditor();
    act(() => {
      editor.commands.focus('end');
      editor.view.dispatch(editor.state.tr.insertText(' world'));
    });
    fireEvent.keyDown(editor.view.dom, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith('Hello world');
  });

  it('does nothing without onSubmit', () => {
    renderEditor({ value: 'Hello', onChange: vi.fn() });
    expect(() => fireEvent.keyDown(liveEditor().view.dom, mod)).not.toThrow();
  });

  it('skips submit while a suggestion popover is open', async () => {
    const onSubmit = vi.fn();
    renderEditor({ value: '', onChange: vi.fn(), onSubmit });
    await openPopover();
    fireEvent.keyDown(liveEditor().view.dom, mod);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does nothing while a popover is open: no pick, nothing reaches the host form', async () => {
    const parent = vi.fn();
    render(
      <MemoryRouter>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: test spy */}
        <div onKeyDown={parent}>
          <WikiEditorLazy value="" onChange={vi.fn()} onSubmit={vi.fn()} />
        </div>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull());
    await openPopover();
    const before = liveEditor().getJSON();
    fireEvent.keyDown(liveEditor().view.dom, { ...mod, keyCode: 13 });
    expect(parent).not.toHaveBeenCalled();
    expect(liveEditor().getJSON()).toEqual(before);
  });

  it('skips submit during IME composition', () => {
    const onSubmit = vi.fn();
    renderEditor({ value: 'Hello', onChange: vi.fn(), onSubmit });
    fireEvent.keyDown(liveEditor().view.dom, { ...mod, isComposing: true });
    fireEvent.keyDown(liveEditor().view.dom, { ...mod, keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the source text in source mode', () => {
    useSettingsStore.setState({ wikiEditorMode: 'source' });
    const onSubmit = vi.fn();
    renderEditor({ value: 'Hello', onChange: vi.fn(), onSubmit });
    fireEvent.change(textarea(), { target: { value: 'Changed' } });
    fireEvent.keyDown(textarea(), mod);
    expect(onSubmit).toHaveBeenCalledWith('Changed');
  });
});

// A real Escape carries keyCode 27, which ProseMirror's captureKeyDown always preventDefaults.
const ESC = { key: 'Escape', keyCode: 27 };

describe('Esc cancel (D-11)', () => {
  it('calls onCancel when nothing else consumes Esc', () => {
    const onCancel = vi.fn();
    renderEditor({ value: 'Hello', onChange: vi.fn(), onCancel });
    fireEvent.keyDown(liveEditor().view.dom, ESC);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('lets an open popover consume the first Esc', async () => {
    const onCancel = vi.fn();
    renderEditor({ value: '', onChange: vi.fn(), onCancel });
    await openPopover();
    fireEvent.keyDown(liveEditor().view.dom, ESC);
    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(popovers().length).toBe(0));
    fireEvent.keyDown(liveEditor().view.dom, ESC);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('leaves Esc alone without onCancel', async () => {
    const parent = vi.fn();
    render(
      <MemoryRouter>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: test spy */}
        <div onKeyDown={parent}>
          <WikiEditorLazy value="Hello" onChange={vi.fn()} />
        </div>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull());
    fireEvent.keyDown(liveEditor().view.dom, ESC);
    expect(parent).toHaveBeenCalled();
  });
});

describe('placeholder and autoFocus', () => {
  it('uses the host placeholder', () => {
    renderEditor({ value: '', onChange: vi.fn(), placeholder: 'Add a comment…' });
    expect(liveEditor().view.dom.getAttribute('data-wiki-placeholder')).toBe('Add a comment…');
  });

  it('keeps the default when omitted', () => {
    renderEditor({ value: '', onChange: vi.fn() });
    expect(liveEditor().view.dom.getAttribute('data-wiki-placeholder')).toBe(
      'Write a description…',
    );
  });

  it('autoFocus focuses the editor', async () => {
    renderEditor({ value: 'Hello', onChange: vi.fn(), autoFocus: true });
    await waitFor(() => expect(document.activeElement).toBe(liveEditor().view.dom));
  });
});

describe('handle via WikiEditorLazy', () => {
  it('exposes a handle once the chunk loads, then focuses, blurs and inserts files', async () => {
    const ref = createRef<WikiEditorHandle>();
    const uploadFile = vi.fn(() => new Promise<never>(() => {}));
    render(
      <MemoryRouter>
        <WikiEditorLazy ref={ref} value="Hello" onChange={vi.fn()} host={{ uploadFile }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(ref.current).not.toBeNull());
    const handle = ref.current as WikiEditorHandle;
    act(() => handle.focus({ toEnd: true }));
    await waitFor(() => expect(document.activeElement).toBe(liveEditor().view.dom));
    expect(liveEditor().state.selection.from).toBe(liveEditor().state.doc.content.size - 1);
    act(() => handle.blur());
    await waitFor(() => expect(document.activeElement).not.toBe(liveEditor().view.dom));
    act(() => handle.insertFiles([new File(['x'], 'a.txt', { type: 'text/plain' })]));
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));
  });

  it('stages files when the host is staged', async () => {
    const ref = createRef<WikiEditorHandle>();
    const stageFile = vi.fn();
    render(
      <MemoryRouter>
        <WikiEditorLazy ref={ref} value="" onChange={vi.fn()} host={{ staged: true, stageFile }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(ref.current).not.toBeNull());
    act(() => ref.current?.insertFiles([new File(['x'], 'b.txt', { type: 'text/plain' })]));
    await waitFor(() => expect(stageFile).toHaveBeenCalledTimes(1));
  });
});
