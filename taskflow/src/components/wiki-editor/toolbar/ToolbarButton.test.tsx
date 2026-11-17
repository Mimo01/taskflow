import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NAV_SHORTCUTS, SHORTCUTS } from '@/lib/shortcuts';
import { ToolbarButton } from './ToolbarButton';

describe('ToolbarButton', () => {
  it('exposes label and pressed state, calls onClick', () => {
    const onClick = vi.fn();
    render(<ToolbarButton label="Bold" keys={['⌘', 'B']} icon={<i />} onClick={onClick} pressed />);
    const btn = screen.getByRole('button', { name: 'Bold' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits aria-pressed when pressed is undefined', () => {
    render(<ToolbarButton label="Undo" icon={<i />} onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Undo' })).not.toHaveAttribute('aria-pressed');
  });

  it('prevents default on mousedown so the editor keeps focus', () => {
    render(<ToolbarButton label="Bold" icon={<i />} onClick={vi.fn()} />);
    const notPrevented = fireEvent.mouseDown(screen.getByRole('button', { name: 'Bold' }));
    expect(notPrevented).toBe(false);
  });

  it('shows label and keycaps in the tooltip', async () => {
    const user = userEvent.setup();
    render(<ToolbarButton label="Bold" keys={['⌘', 'B']} icon={<i />} onClick={vi.fn()} />);
    await user.hover(screen.getByRole('button', { name: 'Bold' }));
    const caps = await screen.findAllByText('B', { selector: 'kbd' }, { timeout: 2000 });
    expect(caps.length).toBeGreaterThan(0);
    expect(screen.getAllByText('⌘', { selector: 'kbd' }).length).toBeGreaterThan(0);
  });
});

describe('Editor shortcut registry', () => {
  const editor = SHORTCUTS.filter((s) => s.category === 'Editor');

  it('lists the 20 editor shortcuts, none navigational', () => {
    expect(editor.map((s) => s.id)).toEqual([
      'editor-bold',
      'editor-italic',
      'editor-underline',
      'editor-strike',
      'editor-mono',
      'editor-superscript',
      'editor-subscript',
      'editor-link',
      'editor-bullet-list',
      'editor-numbered-list',
      'editor-quote',
      'editor-toggle-source',
      'editor-undo',
      'editor-redo',
      'editor-paste-plain',
      'editor-trigger-mention',
      'editor-trigger-slash',
      'editor-trigger-emoticon',
      'editor-submit',
      'editor-cancel',
    ]);
    for (const s of editor) {
      expect(s.navMeta).toBeUndefined();
      if (
        !s.id.startsWith('editor-trigger-') &&
        !['editor-paste-plain', 'editor-submit', 'editor-cancel'].includes(s.id)
      ) {
        expect(s.description).toContain('while editing');
      }
    }
    expect(NAV_SHORTCUTS.some((s) => s.category !== 'Navigation')).toBe(false);
  });
});
