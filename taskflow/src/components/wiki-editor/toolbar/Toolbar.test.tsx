import type { Editor } from '@tiptap/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEditor } from '../test-utils';
import type { SourceHandle } from '../source/SourceView';
import { Toolbar, type ToolbarProps } from './Toolbar';

let roCallback: ResizeObserverCallback | null = null;

beforeEach(() => {
  roCallback = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        roCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup(overrides: Partial<ToolbarProps> = {}, text = 'x') {
  const { editor }: { editor: Editor } = makeEditor(text);
  const insert = vi.fn();
  const source = { current: { insert, focus: vi.fn(), focusAt: vi.fn() } as SourceHandle };
  const frame = document.createElement('div');
  const props: ToolbarProps = {
    editor,
    preset: 'full',
    mode: 'rich',
    richDisabled: false,
    onModeChange: vi.fn(),
    previewVisible: true,
    onPreviewToggle: vi.fn(),
    linkOpen: false,
    onLinkOpenChange: vi.fn(),
    source,
    frameRef: { current: frame },
    ...overrides,
  };
  const utils = render(<Toolbar {...props} />);
  return { editor, insert, props, ...utils };
}

const has = (name: string) => screen.queryByRole('button', { name }) !== null;

describe('Toolbar', () => {
  it('full preset in rich mode renders all controls with the mode toggle last', () => {
    setup();
    for (const n of [
      'Text style',
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Monospace',
      'Superscript',
      'Subscript',
      'Text colour',
      'Bullet list',
      'Numbered list',
      'Quote',
      'Link',
      'Insert',
    ]) {
      expect(has(n), n).toBe(true);
    }
    const bar = screen.getByRole('toolbar');
    expect(bar.className).toContain('flex-nowrap');
    expect(bar.lastElementChild).toBe(screen.getByRole('radiogroup'));
  });

  it('compact preset omits text style, colour and sub/sup', () => {
    setup({ preset: 'compact' });
    expect(has('Text style')).toBe(false);
    expect(has('Text colour')).toBe(false);
    expect(has('Superscript')).toBe(false);
    expect(has('Quote')).toBe(false);
    expect(has('Bold')).toBe(true);
    expect(has('Insert')).toBe(true);
  });

  it('reflects active marks through editor state', () => {
    const { editor } = setup();
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold).toHaveAttribute('aria-pressed', 'false');
    act(() => {
      editor.commands.selectAll();
    });
    fireEvent.click(bold);
    expect(editor.isActive('bold')).toBe(true);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('source mode maps marks to wiki wrappers and hides style and colour', () => {
    const { insert } = setup({ mode: 'source' });
    expect(has('Text style')).toBe(false);
    expect(has('Text colour')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(insert).toHaveBeenLastCalledWith('*', '*');
    fireEvent.click(screen.getByRole('button', { name: 'Monospace' }));
    expect(insert).toHaveBeenLastCalledWith('{{', '}}');
    fireEvent.click(screen.getByRole('button', { name: 'Bullet list' }));
    expect(insert).toHaveBeenLastCalledWith('* ', undefined);
  });

  it('source mode Insert uses the canonical snippet', async () => {
    const user = userEvent.setup();
    const { insert } = setup({ mode: 'source' });
    await user.click(screen.getByRole('button', { name: 'Insert' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Code block' }));
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toContain('{code');
  });

  it('source mode link apply inserts [text|url] for allowlisted urls only', async () => {
    const user = userEvent.setup();
    const onLinkOpenChange = vi.fn();
    const { insert } = setup({ mode: 'source', linkOpen: true, onLinkOpenChange });
    const input = await screen.findByLabelText('Link URL');
    await user.type(input, 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(insert).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, 'a.com');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(insert).toHaveBeenCalledWith('[', '|https://a.com]');
  });

  it('preview toggle appears in source mode only and flips its label', () => {
    const onPreviewToggle = vi.fn();
    const { rerender, props } = setup({ mode: 'source', onPreviewToggle });
    fireEvent.click(screen.getByRole('button', { name: 'Hide preview' }));
    expect(onPreviewToggle).toHaveBeenCalled();
    rerender(<Toolbar {...props} mode="source" previewVisible={false} />);
    expect(has('Show preview')).toBe(true);
    rerender(<Toolbar {...props} mode="rich" />);
    expect(has('Hide preview')).toBe(false);
    expect(has('Show preview')).toBe(false);
  });

  it('moves low-priority items into the overflow menu at a narrow width', async () => {
    const user = userEvent.setup();
    setup();
    act(() => {
      roCallback?.([{ contentRect: { width: 360 } } as ResizeObserverEntry], {} as ResizeObserver);
    });
    for (const n of ['Strikethrough', 'Monospace', 'Superscript', 'Quote', 'Text colour', 'Link']) {
      expect(has(n), n).toBe(false);
    }
    expect(has('Bold')).toBe(true);
    expect(has('Insert')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'More' }));
    for (const n of ['Strikethrough', 'Monospace', 'Quote', 'Link']) {
      expect(await screen.findByText(n)).toBeTruthy();
    }
  });

  it('disables the Rich segment when richDisabled', () => {
    setup({ richDisabled: true, mode: 'source' });
    expect(screen.getByRole('radio', { name: 'Rich' })).toBeDisabled();
  });
});
