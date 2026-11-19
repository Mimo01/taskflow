import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installLayoutStubs, liveEditor, renderEditor } from './shell-test-utils';

installLayoutStubs();

const BANNER = /Couldn't save safely/;

// A paragraph that lands right after another paragraph with gap 0 (no blank line)
// emitted as one line run and re-parsed as ONE paragraph, failing the save check
// ("the saved text has 1 top-level blocks, the edit has 2"). WikiGapKeeper's
// block-added rule never fired: these edits keep the block count level or shrink it.
describe('adjacent paragraphs always save with a blank line between', () => {
  it('heading turned into a paragraph above a gap-0 paragraph', () => {
    const onChange = vi.fn();
    renderEditor({ value: 'h1. Preview\n<div>\n   <p>test</p>\n</div>', onChange });
    const ed = liveEditor();
    act(() => void ed.chain().setTextSelection(3).setParagraph().run());
    expect(screen.queryByText(BANNER)).toBeNull();
    expect(onChange.mock.lastCall?.[0]).toBe('Preview\n\n<div>\n   <p>test</p>\n</div>');
  });

  it('block deleted from between two gap-0 paragraphs', () => {
    const onChange = vi.fn();
    renderEditor({ value: 'a\nh2. x\nb', onChange });
    const ed = liveEditor();
    expect(ed.state.doc.childCount).toBe(3);
    const at = ed.state.doc.child(0).nodeSize;
    act(() => void ed.chain().setNodeSelection(at).deleteSelection().run());
    expect(ed.state.doc.childCount).toBe(2);
    expect(screen.queryByText(BANNER)).toBeNull();
    expect(onChange.mock.lastCall?.[0]).toBe('a\n\nb');
  });

  it('typing inside an untouched document keeps its spelling', () => {
    const onChange = vi.fn();
    renderEditor({ value: 'h1. T\nx', onChange });
    const ed = liveEditor();
    act(
      () =>
        void ed
          .chain()
          .setTextSelection(ed.state.doc.content.size - 1)
          .insertContent('y')
          .run(),
    );
    expect(onChange.mock.lastCall?.[0]).toBe('h1. T\nxy');
  });
});
