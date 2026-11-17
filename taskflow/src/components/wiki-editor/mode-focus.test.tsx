import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useSettingsStore } from '@/stores/settings.store';
import { installLayoutStubs, liveEditor, renderEditor, textarea } from './shell-test-utils';
import WikiEditor from './WikiEditor';

installLayoutStubs();

const toggleKey = { key: 'M', metaKey: true, shiftKey: true };

function toSourceByKey() {
  fireEvent.keyDown(liveEditor().view.dom, toggleKey);
}

describe('mode toggle focus (UAT gap 2)', () => {
  it('Cmd+Shift+M focuses the textarea at offset 0', () => {
    renderEditor({ value: 'Hello world', onChange: vi.fn() });
    toSourceByKey();
    expect(document.activeElement).toBe(textarea());
    expect(textarea().selectionStart).toBe(0);
  });

  it('the Source radio focuses the textarea', () => {
    renderEditor({ value: 'Hello world', onChange: vi.fn() });
    fireEvent.click(screen.getByRole('radio', { name: /Source/ }));
    expect(document.activeElement).toBe(textarea());
  });

  it('keeps the hidden rich editor non-editable and onChange equal to the textarea', () => {
    const onChange = vi.fn();
    renderEditor({ value: 'Hello world', onChange });
    toSourceByKey();
    expect(liveEditor().isEditable).toBe(false);
    expect(liveEditor().view.dom.getAttribute('contenteditable')).toBe('false');
    fireEvent.change(document.activeElement as HTMLTextAreaElement, {
      target: { value: 'QQHello world' },
    });
    expect(onChange.mock.lastCall?.[0]).toBe('QQHello world');
    expect(textarea().value).toBe('QQHello world');
    for (const [text] of onChange.mock.calls) expect(text).toBe('QQHello world');
  });

  it('a second Cmd+Shift+M from the textarea returns to rich and stays inside the frame', () => {
    const parent = vi.fn();
    render(
      <MemoryRouter>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: test spy */}
        <div onKeyDown={parent}>
          <WikiEditor value="Hello world" onChange={vi.fn()} />
        </div>
      </MemoryRouter>,
    );
    toSourceByKey();
    parent.mockClear();
    fireEvent.keyDown(textarea(), toggleKey);
    expect(document.querySelector('textarea')).toBeNull();
    expect(document.activeElement).toBe(liveEditor().view.dom);
    expect(liveEditor().isEditable).toBe(true);
    expect(parent).not.toHaveBeenCalled();
  });

  it('source without edits to rich keeps the caret', () => {
    renderEditor({ value: 'Hello world', onChange: vi.fn() });
    act(() => {
      liveEditor().commands.setTextSelection(4);
    });
    toSourceByKey();
    fireEvent.keyDown(textarea(), toggleKey);
    expect(liveEditor().state.selection.from).toBe(4);
    expect(document.activeElement).toBe(liveEditor().view.dom);
  });

  it('edited source to rich puts the caret at the doc start', () => {
    renderEditor({ value: 'Hello world', onChange: vi.fn() });
    act(() => {
      liveEditor().commands.setTextSelection(4);
    });
    toSourceByKey();
    fireEvent.change(textarea(), { target: { value: 'Changed' } });
    fireEvent.keyDown(textarea(), toggleKey);
    expect(liveEditor().state.selection.from).toBe(1);
    expect(document.activeElement).toBe(liveEditor().view.dom);
  });

  it('initial source preference: not editable, focus not stolen', () => {
    useSettingsStore.setState({ wikiEditorMode: 'source' });
    renderEditor({ value: 'Hello world', onChange: vi.fn() });
    expect(liveEditor().isEditable).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it('initial rich: focus not stolen', () => {
    renderEditor({ value: 'Hello world', onChange: vi.fn() });
    expect(document.activeElement).toBe(document.body);
  });
});
