import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeSelection } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { makeEditor } from '../test-utils';
import { WIKI_OPEN_ATTACH_EVENT } from '../nodeviews/events';
import { installLayoutStubs, liveEditor, renderEditor, textarea } from '../shell-test-utils';
import type { SourceHandle } from '../source/SourceView';
import { BUBBLE_KEY, BubbleToolbar, shouldShowBubble } from './BubbleToolbar';
import { CompactFooter } from './CompactFooter';

installLayoutStubs();

const ATTACHMENTS: JiraAttachment[] = [
  {
    id: '1',
    filename: 'diagram.png',
    mimeType: 'image/png',
    content: 'https://jira.example.invalid/secure/attachment/1/diagram.png',
  },
  {
    id: '2',
    filename: 'report.pdf',
    mimeType: 'application/pdf',
    content: 'https://jira.example.invalid/secure/attachment/2/report.pdf',
  },
];

function showBubble(editor: ReturnType<typeof liveEditor>) {
  act(() => {
    editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, 'show'));
  });
}

describe('shouldShowBubble', () => {
  const props = (editor: ReturnType<typeof makeEditor>['editor']) => ({
    editor,
    state: editor.state,
    from: editor.state.selection.from,
    to: editor.state.selection.to,
  });

  it('shows for a text range, hides for empty, node and code selections', () => {
    const { editor } = makeEditor('hello world');
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect(shouldShowBubble(props(editor))).toBe(true);
    editor.commands.setTextSelection(3);
    expect(shouldShowBubble(props(editor))).toBe(false);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.setEditable(false, false);
    expect(shouldShowBubble(props(editor))).toBe(false);
    editor.setEditable(true, false);

    editor.commands.setCodeBlock();
    editor.commands.selectAll();
    expect(shouldShowBubble(props(editor))).toBe(false);

    editor.commands.setContent('<p>a</p><hr>');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 3)));
    expect(shouldShowBubble(props(editor))).toBe(false);
  });
});

describe('BubbleToolbar', () => {
  it('renders 7 labelled buttons; Bold toggles and focus returns to the editor', async () => {
    const { editor } = makeEditor('hello world');
    render(<BubbleToolbar editor={editor} linkOpen={false} onLinkOpenChange={() => {}} />);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    showBubble(editor);
    for (const name of [
      'Bold',
      'Italic',
      'Underline',
      'Strikethrough',
      'Monospace',
      'Link',
      'Text colour',
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    const focus = vi.spyOn(editor.view, 'focus');
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(editor.isActive('bold')).toBe(true);
    await waitFor(() => expect(focus).toHaveBeenCalled());
  });

  it('Escape hides the bubble, stops propagation and keeps the selection', () => {
    const { editor } = makeEditor('hello world');
    render(<BubbleToolbar editor={editor} linkOpen={false} onLinkOpenChange={() => {}} />);
    editor.commands.setTextSelection({ from: 1, to: 6 });
    showBubble(editor);
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeNull();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    fireEvent.keyDown(editor.view.dom, { key: 'Escape' });
    document.removeEventListener('keydown', outer);
    expect(outer).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Bold' })).toBeNull();
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.selection.to).toBe(6);
  });
});

describe('CompactFooter', () => {
  function setup(mode: 'rich' | 'source') {
    const { editor } = makeEditor('hello');
    const insert = vi.fn();
    const insertTrigger = vi.fn();
    const source = {
      current: { insert, insertTrigger, focus: vi.fn(), focusAt: vi.fn() } as SourceHandle,
    };
    const onAttach = vi.fn();
    render(
      <CompactFooter
        editor={editor}
        mode={mode}
        richDisabled={false}
        onModeChange={() => {}}
        onAttach={onAttach}
        source={{ current: source.current }}
      />,
    );
    return { editor, insert, insertTrigger, onAttach };
  }

  it('renders actions and wires Attach', async () => {
    const { onAttach } = setup('rich');
    expect(screen.getByRole('button', { name: 'Mention someone' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Emoticon' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Attach file' }));
    expect(onAttach).toHaveBeenCalled();
  });

  it('rich Mention inserts @ with a leading space after a word', async () => {
    const { editor } = setup('rich');
    editor.commands.setTextSelection(6);
    await userEvent.click(screen.getByRole('button', { name: 'Mention someone' }));
    expect(editor.getText()).toBe('hello @');
  });

  it('source mode inserts @ and : as triggers', async () => {
    const { insertTrigger } = setup('source');
    await userEvent.click(screen.getByRole('button', { name: 'Mention someone' }));
    await userEvent.click(screen.getByRole('button', { name: 'Emoticon' }));
    expect(insertTrigger).toHaveBeenNthCalledWith(1, '@');
    expect(insertTrigger).toHaveBeenNthCalledWith(2, ':');
  });

  it('hides Emoticon and Mention at narrow container widths', () => {
    setup('rich');
    expect(screen.getByRole('button', { name: 'Emoticon' }).className).toContain(
      '@max-[320px]:hidden',
    );
    expect(screen.getByRole('button', { name: 'Mention someone' }).className).toContain(
      '@max-[260px]:hidden',
    );
  });
});

describe('WikiEditor presets and picker', () => {
  it('full: Toolbar and no footer; compact: footer and no toolbar', () => {
    const a = renderEditor({ value: 'hi', onChange: vi.fn(), preset: 'full' });
    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Attach file' })).toBeNull();
    a.unmount();
    renderEditor({ value: 'hi', onChange: vi.fn(), preset: 'compact' });
    expect(screen.queryByRole('toolbar', { name: 'Formatting' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Attach file' })).not.toBeNull();
  });

  it('compact source mode keeps the footer and hides the bubble', async () => {
    renderEditor({ value: 'hi', onChange: vi.fn(), preset: 'compact' });
    await userEvent.click(screen.getByRole('radio', { name: /source/i }));
    expect(textarea()).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Attach file' })).not.toBeNull();
    expect(screen.queryByRole('toolbar', { name: 'Selection formatting' })).toBeNull();
  });

  it('picker embeds image and attachment nodes at the caret', async () => {
    const onChange = vi.fn();
    renderEditor({ value: 'hi', onChange, preset: 'compact', host: { attachments: ATTACHMENTS } });
    await userEvent.click(screen.getByRole('button', { name: 'Attach file' }));
    expect(screen.getByText('Select an attachment to embed it here.')).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: /diagram.png/ }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toContain('!diagram.png!');
    await userEvent.click(screen.getByRole('button', { name: 'Attach file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'report.pdf' }));
    expect(onChange.mock.calls[onChange.mock.calls.length - 1]?.[0]).toContain('[^report.pdf]');
  });

  it('WIKI_OPEN_ATTACH_EVENT opens the picker in both presets', async () => {
    for (const preset of ['full', 'compact'] as const) {
      const { unmount } = renderEditor({
        value: 'hi',
        onChange: vi.fn(),
        preset,
        host: { attachments: ATTACHMENTS },
      });
      act(() => {
        liveEditor().view.dom.dispatchEvent(
          new CustomEvent(WIKI_OPEN_ATTACH_EVENT, { bubbles: true }),
        );
      });
      expect(await screen.findByText('Insert attachment')).toBeTruthy();
      unmount();
    }
  });

  it('source mode inserts attachmentRef at the textarea caret', async () => {
    const onChange = vi.fn();
    renderEditor({ value: 'hi', onChange, preset: 'compact', host: { attachments: ATTACHMENTS } });
    await userEvent.click(screen.getByRole('radio', { name: /source/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Attach file' }));
    await userEvent.click(await screen.findByRole('button', { name: 'report.pdf' }));
    expect(textarea().value).toContain('[^report.pdf]');
  });
});
