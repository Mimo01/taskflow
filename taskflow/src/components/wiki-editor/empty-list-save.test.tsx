import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { loadWiki } from '@/lib/wiki/editor';
import { installLayoutStubs, liveEditor, renderEditor } from './shell-test-utils';
import { typeText } from './test-utils';

installLayoutStubs();

const BANNER = /Couldn't save safely/;
const enter = () => act(() => void liveEditor().commands.keyboardShortcut('Enter'));
const lastText = (fn: ReturnType<typeof vi.fn>) => fn.mock.lastCall?.[0];

describe('empty list items never fail the save (UAT gap 5)', () => {
  it('Enter in a list shows no banner and emits nothing; typing saves', () => {
    const onChange = vi.fn();
    renderEditor({ value: '* one', onChange });
    const ed = liveEditor();
    act(() => void ed.commands.setTextSelection(ed.state.doc.content.size - 2));
    enter();
    expect(screen.queryByText(BANNER)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    act(() => typeText(ed, 'two'));
    expect(lastText(onChange)).toBe('* one\n* two');
    expect(screen.queryByText(BANNER)).toBeNull();
  });

  it("'# ' shows no banner and never emits unreadable text", () => {
    const onChange = vi.fn();
    renderEditor({ value: '', onChange });
    const ed = liveEditor();
    act(() => typeText(ed, '# '));
    expect(screen.queryByText(BANNER)).toBeNull();
    for (const [t] of onChange.mock.calls) expect(loadWiki(t).kind).not.toBe('failed');
    act(() => typeText(ed, 'x'));
    expect(lastText(onChange)).toBe('# x');
  });

  it('Enter, Enter lifts out of a list with no banner at any step', () => {
    const onChange = vi.fn();
    renderEditor({ value: '* one', onChange });
    const ed = liveEditor();
    act(() => void ed.commands.setTextSelection(ed.state.doc.content.size - 2));
    enter();
    expect(screen.queryByText(BANNER)).toBeNull();
    enter();
    expect(screen.queryByText(BANNER)).toBeNull();
  });
});
