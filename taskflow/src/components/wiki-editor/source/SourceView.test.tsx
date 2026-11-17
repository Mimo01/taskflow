import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { type SourceHandle, SourceView } from './SourceView';

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

const base = {
  previewVisible: true,
  minHeightClass: 'min-h-[240px]',
  maxHeightClass: 'max-h-[480px]',
};

describe('SourceView', () => {
  it('renders a monospace textarea and reports typing', () => {
    const onChange = vi.fn();
    render(wrap(<SourceView {...base} value="a" onChange={onChange} aria-label="Source" />));
    const ta = screen.getByLabelText('Source');
    expect(ta.className).toContain('font-mono');
    fireEvent.change(ta, { target: { value: 'ab' } });
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  it('shows the preview, or the empty copy', () => {
    const { rerender } = render(wrap(<SourceView {...base} value="hello" onChange={() => {}} />));
    expect(screen.getByText('Preview')).toBeTruthy();
    rerender(wrap(<SourceView {...base} value="" onChange={() => {}} />));
    expect(screen.getByText('Nothing to preview')).toBeTruthy();
  });

  it('hides the preview and carries the narrow auto-hide class', () => {
    const { rerender } = render(wrap(<SourceView {...base} value="x" onChange={() => {}} />));
    const pane = () => screen.getByText('Preview').parentElement as HTMLElement;
    expect(pane().className).toContain('@max-[35rem]:hidden');
    expect(pane().className).not.toMatch(/(^| )hidden( |$)/);
    rerender(wrap(<SourceView {...base} previewVisible={false} value="x" onChange={() => {}} />));
    expect(pane().className).toMatch(/(^| )hidden( |$)/);
  });

  it('shows external value changes', () => {
    const { rerender } = render(
      wrap(<SourceView {...base} value="one" onChange={() => {}} aria-label="S" />),
    );
    rerender(wrap(<SourceView {...base} value="two" onChange={() => {}} aria-label="S" />));
    expect((screen.getByLabelText('S') as HTMLTextAreaElement).value).toBe('two');
  });

  it('exposes insert and focus', () => {
    const onChange = vi.fn();
    const ref = createRef<SourceHandle>();
    render(wrap(<SourceView {...base} ref={ref} value="ab" onChange={onChange} aria-label="S" />));
    const ta = screen.getByLabelText('S') as HTMLTextAreaElement;
    ta.setSelectionRange(1, 1);
    ref.current?.insert('*', '*');
    expect(onChange).toHaveBeenCalledWith('a**b');
    ref.current?.focus();
    expect(document.activeElement).toBe(ta);
  });
});
