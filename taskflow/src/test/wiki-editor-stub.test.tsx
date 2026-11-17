import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { WikiEditorHandle } from '@/components/wiki-editor/types';
import { lastStubProps, WikiEditorLazyStub, wikiEditorLazyMock } from './wiki-editor-stub';

describe('WikiEditorLazyStub', () => {
  it('renders a labelled textarea with placeholder and reports changes', () => {
    const onChange = vi.fn();
    render(<WikiEditorLazyStub value="a" onChange={onChange} placeholder="Add a comment…" />);
    const ta = screen.getByLabelText('Wiki editor') as HTMLTextAreaElement;
    expect(ta.placeholder).toBe('Add a comment…');
    fireEvent.change(ta, { target: { value: 'ab' } });
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  it('uses the aria-label prop', () => {
    render(<WikiEditorLazyStub value="" onChange={vi.fn()} aria-label="Comment" />);
    expect(screen.getByLabelText('Comment')).toBeTruthy();
  });

  it('Cmd/Ctrl+Enter submits the current value', () => {
    const onSubmit = vi.fn();
    render(<WikiEditorLazyStub value="text" onChange={vi.fn()} onSubmit={onSubmit} />);
    const ta = screen.getByLabelText('Wiki editor');
    fireEvent.keyDown(ta, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenCalledWith('text');
  });

  it('Esc cancels and prevents default only with onCancel', () => {
    const onCancel = vi.fn();
    const { unmount } = render(
      <WikiEditorLazyStub value="" onChange={vi.fn()} onCancel={onCancel} />,
    );
    expect(fireEvent.keyDown(screen.getByLabelText('Wiki editor'), { key: 'Escape' })).toBe(false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
    render(<WikiEditorLazyStub value="" onChange={vi.fn()} />);
    expect(fireEvent.keyDown(screen.getByLabelText('Wiki editor'), { key: 'Escape' })).toBe(true);
  });

  it('exposes a handle: focus, blur, insertFiles (live and staged)', () => {
    const ref = createRef<WikiEditorHandle>();
    const uploadFile = vi.fn(() => Promise.resolve({} as never));
    const { rerender } = render(
      <WikiEditorLazyStub ref={ref} value="abc" onChange={vi.fn()} host={{ uploadFile }} />,
    );
    const ta = screen.getByLabelText('Wiki editor') as HTMLTextAreaElement;
    ref.current?.focus({ toEnd: true });
    expect(document.activeElement).toBe(ta);
    expect(ta.selectionStart).toBe(3);
    ref.current?.blur();
    expect(document.activeElement).not.toBe(ta);
    const file = new File(['x'], 'a.txt');
    ref.current?.insertFiles([file]);
    expect(uploadFile).toHaveBeenCalledWith(file);

    const stageFile = vi.fn();
    rerender(
      <WikiEditorLazyStub
        ref={ref}
        value="abc"
        onChange={vi.fn()}
        host={{ staged: true, stageFile, uploadFile }}
      />,
    );
    ref.current?.insertFiles([file]);
    expect(stageFile).toHaveBeenCalledWith(file);
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it('records the last props and exports the mock module shape', () => {
    render(<WikiEditorLazyStub value="" onChange={vi.fn()} preset="compact" />);
    expect(lastStubProps.current?.preset).toBe('compact');
    expect(wikiEditorLazyMock.WikiEditorLazy).toBe(WikiEditorLazyStub);
  });
});
