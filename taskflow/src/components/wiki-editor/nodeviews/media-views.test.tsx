import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { NodeSelection } from '@tiptap/pm/state';
import { describe, expect, it, vi } from 'vitest';
import type { JiraAttachment } from '@/services/jira';
import { installLayoutStubs, liveEditor, renderEditor, typeAt } from '../shell-test-utils';
import type { WikiEditorHost } from '../types';

vi.mock('@/routes/dashboard/AuthImage', () => ({
  AuthImage: ({ src, className }: { src: string; className?: string }) => (
    <img src={src} className={className} data-testid="auth-img" alt="" />
  ),
}));

installLayoutStubs();

const att = (filename: string): JiraAttachment => ({
  id: '1',
  filename,
  content: `https://jira.test/secure/attachment/1/${filename}`,
  mimeType: 'image/png',
});

describe('media node views', () => {
  it('renders resolved and unresolved mentions, keeps tokens on save, reacts to host', async () => {
    const onChange = vi.fn();
    const value = 'Hi [~jdoe] and [~ghost]';
    const host: WikiEditorHost = { userMap: { jdoe: 'Jane Doe' } };
    const { rerenderWith, container } = renderEditor({ value, onChange, host });
    const pills = () => Array.from(container.querySelectorAll('.mention-badge'));
    await waitFor(() => expect(pills()).toHaveLength(2));
    expect(pills().map((p) => p.textContent)).toEqual(['@Jane Doe', '@ghost']);
    expect(pills()[0]?.className).toContain('bg-primary/15');
    expect(pills()[1]?.className).toContain('bg-muted');
    expect(onChange).not.toHaveBeenCalled();
    act(() => typeAt(liveEditor(), 1, 'X'));
    const text = onChange.mock.calls[0]?.[0] as string;
    expect(text).toContain('[~jdoe]');
    expect(text).toContain('[~ghost]');
    rerenderWith({ value, onChange, host: { userMap: { jdoe: 'Jane Doe', ghost: 'Casper' } } });
    expect(pills().map((p) => p.textContent)).toEqual(['@Jane Doe', '@Casper']);
    expect(pills()[1]?.className).toContain('bg-primary/15');
  });

  it('renders images capped to width, keeps params verbatim, selects on click without lightbox', async () => {
    const onChange = vi.fn();
    const host: WikiEditorHost = { attachments: [att('diagram.png')] };
    const { container } = renderEditor({
      value: 'Before !diagram.png|width=300! after',
      onChange,
      host,
    });
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(1));
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.className).toContain('max-w-full');
    act(() => typeAt(liveEditor(), 1, 'X'));
    expect(onChange.mock.calls[0]?.[0]).toContain('!diagram.png|width=300!');

    const ed = liveEditor();
    let imagePos = -1;
    ed.state.doc.descendants((n, pos) => {
      if (n.type.name === 'image') imagePos = pos;
    });
    act(() => {
      ed.view.dispatch(ed.state.tr.setSelection(NodeSelection.create(ed.state.doc, imagePos)));
    });
    const sel = ed.state.selection;
    expect(sel instanceof NodeSelection && sel.node.type.name === 'image').toBe(true);
    fireEvent.click(container.querySelector('img') as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the glyph for an emoticon and saves the token', async () => {
    const onChange = vi.fn();
    const { container } = renderEditor({ value: '(/) done', onChange });
    await waitFor(() => expect(container.textContent).toContain('✅'));
    act(() => typeAt(liveEditor(), 1, 'X'));
    expect(onChange.mock.calls[0]?.[0]).toContain('(/)');
    expect(onChange.mock.calls[0]?.[0]).not.toContain('✅');
  });
});
