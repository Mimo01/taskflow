import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EDIT_IN_SOURCE_EVENT } from './nodeviews/events';
import { installLayoutStubs, textarea, liveEditor, renderEditor, typeAt } from './shell-test-utils';
import { useSettingsStore } from '@/stores/settings.store';

installLayoutStubs();

const VALUE = 'h2. Title\n\nSome *bold* text and a list:\n\n* one\n* two\n';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WikiEditor', () => {
  it('never calls onChange for an unedited text', async () => {
    const onChange = vi.fn();
    const props = { value: VALUE, onChange };
    const { rerenderWith } = renderEditor(props);
    const ed = liveEditor();
    act(() => {
      ed.commands.focus();
      ed.commands.blur();
    });
    rerenderWith({ ...props });
    await act(async () => {});
    expect(onChange).not.toHaveBeenCalled();
  });

  it('frame uses the shared field surface with the ring-3 focus treatment', () => {
    const { container } = renderEditor({ value: VALUE, onChange: vi.fn() });
    const cls = container.querySelector('[data-slot="wiki-editor-frame"]')?.className ?? '';
    for (const c of [
      'focus-within:border-ring',
      'focus-within:ring-3',
      'focus-within:ring-ring/50',
      'bg-transparent',
      'dark:bg-input/30',
      'transition-colors',
    ]) {
      expect(cls).toContain(c);
    }
    expect(cls).not.toContain('focus-within:ring-1');
  });

  it('emits once on typing, ignores the echo, and keeps undo', () => {
    const onChange = vi.fn();
    const props = { value: 'hello', onChange };
    const { rerenderWith } = renderEditor(props);
    const ed = liveEditor();
    act(() => typeAt(ed, 1, 'X'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const text = onChange.mock.calls[0]?.[0] as string;
    expect(text.startsWith('X')).toBe(true);
    rerenderWith({ ...props, value: text });
    expect(ed.state.doc.textContent).toBe('Xhello');
    act(() => {
      ed.commands.undo();
    });
    expect(ed.state.doc.textContent).toBe('hello');
  });

  it('resets the doc on an external change without echo or undo back', () => {
    const onChange = vi.fn();
    const props = { value: 'hello', onChange };
    const { rerenderWith } = renderEditor(props);
    const ed = liveEditor();
    rerenderWith({ ...props, value: 'goodbye' });
    expect(ed.state.doc.textContent).toBe('goodbye');
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      ed.commands.undo();
    });
    expect(ed.state.doc.textContent).toBe('goodbye');
  });

  it('opens in source when the preference says so and writes the preference on toggle', () => {
    useSettingsStore.setState({ wikiEditorMode: 'source' });
    renderEditor({ value: 'hello', onChange: vi.fn() });
    expect(textarea()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /rich/i }));
    expect(useSettingsStore.getState().wikiEditorMode).toBe('rich');
    expect(document.querySelector('.ProseMirror')).toBeVisible();
  });

  it('toggles with mod+shift+m from both views and opens the link popover with mod+k', () => {
    const spy = vi.fn();
    window.addEventListener('keydown', spy);
    renderEditor({ value: 'hello', onChange: vi.fn() });
    const pm = document.querySelector('.ProseMirror') as HTMLElement;
    fireEvent.keyDown(pm, { key: 'm', metaKey: true, shiftKey: true });
    const ta = textarea();
    expect(ta.tagName).toBe('TEXTAREA');
    fireEvent.keyDown(ta, { key: 'm', metaKey: true, shiftKey: true });
    expect(document.querySelector('.ProseMirror')).toBeVisible();
    // global listeners at window never see the shortcut (capture + stopPropagation)
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener('keydown', spy);
    fireEvent.keyDown(document.querySelector('.ProseMirror') as HTMLElement, {
      key: 'k',
      metaKey: true,
    });
    expect(screen.getByPlaceholderText(/https?:|url|link/i)).toBeInTheDocument();
  });

  it('switches to source on the edit-in-source event', () => {
    renderEditor({ value: 'hello', onChange: vi.fn() });
    const pm = document.querySelector('.ProseMirror') as HTMLElement;
    act(() => {
      pm.dispatchEvent(
        new CustomEvent(EDIT_IN_SOURCE_EVENT, { bubbles: true, detail: { pos: 0 } }),
      );
    });
    expect(textarea()).toBeInTheDocument();
  });
});
