import type { Editor } from '@tiptap/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEditor } from '../test-utils';
import type { SourceHandle } from '../source/SourceView';
import { Toolbar, type ToolbarProps } from './Toolbar';
import { splitToolbar, TOOLBAR_PX } from './toolbar-config';

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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const rect = (width: number) =>
  ({
    width,
    height: 0,
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: 0,
    toJSON() {},
  }) as DOMRect;

/**
 * Fakes a laid-out toolbar whose items region + spacer get `room` px. With `realLayout`, the
 * items region loses the More block's width while it shows, as in a browser, so the test
 * proves the measurement adds it back (no oscillation).
 */
function setRoom(room: number, realLayout = false) {
  const moreBlock = TOOLBAR_PX.moreBlock;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.getAttribute('role') === 'toolbar') return rect(900);
    if (this.hasAttribute('data-toolbar-items')) {
      const bar = this.closest('[role="toolbar"]');
      const moreShown = bar?.querySelector('[data-toolbar-more]') != null;
      return rect(realLayout && moreShown ? room - moreBlock : room);
    }
    if (realLayout && this.hasAttribute('data-toolbar-more')) return rect(moreBlock - 4);
    return rect(0);
  });
  act(() => {
    roCallback?.([], {} as ResizeObserver);
  });
}

/** Room where only Text style + Bold fit beside the More block (full preset). */
const NARROW = 200;

function setup(overrides: Partial<ToolbarProps> = {}, text = 'x') {
  const { editor }: { editor: Editor } = makeEditor(text);
  const insert = vi.fn();
  const source = {
    current: { insert, insertTrigger: vi.fn(), focus: vi.fn(), focusAt: vi.fn() } as SourceHandle,
  };
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
    setRoom(NARROW);
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

  const atNarrow = () => setRoom(NARROW);

  it('keeps Insert, More and the mode toggle outside the shrinking items region', () => {
    setup();
    atNarrow();
    const region = screen.getByRole('toolbar').querySelectorAll('[data-toolbar-items]');
    expect(region).toHaveLength(1);
    const items = region[0] as HTMLElement;
    expect(items.className).toContain('min-w-0');
    expect(items.className).toContain('overflow-hidden');
    expect(items.className).toContain('shrink');
    for (const el of [
      screen.getByRole('button', { name: 'Insert' }),
      screen.getByRole('button', { name: 'More' }),
      screen.getByRole('radiogroup', { name: 'Editor mode' }),
    ]) {
      expect(items.contains(el)).toBe(false);
      expect(el.closest('.flex-none')).not.toBeNull();
    }
  });

  it('Full in a narrow toolbar keeps only text style and Bold inline and the rest in More', async () => {
    const user = userEvent.setup();
    setup();
    atNarrow();
    const items = screen.getByRole('toolbar').querySelector('[data-toolbar-items]') as HTMLElement;
    const names = Array.from(items.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Text style', 'Bold']);
    expect(items.querySelectorAll('[aria-hidden="true"].w-px').length).toBeLessThanOrEqual(1);
    await user.click(screen.getByRole('button', { name: 'More' }));
    for (const n of ['Italic', 'Underline', 'Bullet list', 'Numbered list']) {
      expect(await screen.findByText(n)).toBeTruthy();
    }
  });

  // Top-level toolbar child holding `el` (skips wrappers like tooltip triggers).
  const topChild = (el: Element) => {
    const bar = screen.getByRole('toolbar');
    let n: Element | null = el;
    while (n && n.parentElement !== bar) n = n.parentElement;
    return n as Element;
  };
  const isDivider = (el: Element | null) =>
    el?.getAttribute('aria-hidden') === 'true' && el.classList.contains('w-px');

  it('puts More right after the items, then a divider, then Insert', () => {
    setup();
    atNarrow();
    const more = screen.getByRole('button', { name: 'More' });
    const insert = screen.getByRole('button', { name: 'Insert' });
    expect(more.compareDocumentPosition(insert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const items = screen.getByRole('toolbar').querySelector('[data-toolbar-items]') as HTMLElement;
    // More and its divider form one measured block sitting directly before Insert.
    const block = topChild(insert).previousElementSibling as HTMLElement;
    expect(block.hasAttribute('data-toolbar-more')).toBe(true);
    expect(items.contains(block)).toBe(false);
    expect(block.contains(more)).toBe(true);
    expect(isDivider(block.lastElementChild)).toBe(true);
  });

  it('renders no More|Insert divider when nothing overflows', () => {
    setup();
    expect(has('More')).toBe(false);
    expect(screen.getByRole('toolbar').querySelector('[data-toolbar-more]')).toBeNull();
    const insert = screen.getByRole('button', { name: 'Insert' });
    expect(isDivider(topChild(insert).previousElementSibling)).toBe(false);
  });

  const insertLabel = () =>
    Array.from(screen.getByRole('button', { name: 'Insert' }).querySelectorAll('span')).find(
      (e) => e.textContent === 'Insert',
    );

  it('shows the Insert label only when nothing overflows and it fits; aria-label stays', () => {
    setup();
    expect(insertLabel()).toBeUndefined();
    setRoom(620);
    expect(insertLabel()).toBeDefined();
    setRoom(530);
    expect(has('More')).toBe(false);
    expect(insertLabel()).toBeUndefined();
    setRoom(NARROW);
    expect(insertLabel()).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Insert' })).toBeTruthy();
  });

  it('keeps sub/sup inline whenever they fit (modal editor, ~620px of items room)', () => {
    setup();
    setRoom(620);
    expect(has('Superscript')).toBe(true);
    expect(has('Subscript')).toBe(true);
    expect(has('More')).toBe(false);
  });

  it('measures room independently of the More block, so the split is stable', () => {
    setup();
    setRoom(300, true);
    setRoom(300, true);
    const expected = splitToolbar('full', 300);
    expect(has('More')).toBe(true);
    const items = screen.getByRole('toolbar').querySelector('[data-toolbar-items]') as HTMLElement;
    const inline = Array.from(items.querySelectorAll('button')).map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(inline).toContain('Text style');
    expect(inline.length).toBe(
      expected.inline.filter((i) => i !== 'insert').length +
        (expected.inline.includes('subsup') ? 1 : 0),
    );
  });

  it('source-mode preview toggle collapses below 35rem and sits outside the items region', () => {
    setup({ mode: 'source' });
    const btn = screen.getByRole('button', { name: 'Hide preview' });
    expect(btn.className).toContain('hidden @[35rem]:inline-flex');
    const items = screen.getByRole('toolbar').querySelector('[data-toolbar-items]') as HTMLElement;
    expect(items.contains(btn)).toBe(false);
  });

  it('disables the Rich segment when richDisabled', () => {
    setup({ richDisabled: true, mode: 'source' });
    expect(screen.getByRole('radio', { name: 'Rich' })).toBeDisabled();
  });
});
