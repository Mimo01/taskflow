import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installLayoutStubs, textarea, liveEditor, renderEditor, typeAt } from './shell-test-utils';

installLayoutStubs();

describe('failed save', () => {
  it('keeps the doc, emits nothing, and offers Fix in source', () => {
    const onChange = vi.fn();
    renderEditor({ value: 'hello', onChange });
    act(() => typeAt(liveEditor(), 1, 'h1. '));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Couldn't save safely:/)).toHaveClass('text-destructive');
    fireEvent.click(screen.getByRole('button', { name: 'Fix in source' }));
    const ta = textarea() as HTMLTextAreaElement;
    expect(ta.value).toContain('h1. hello');
    expect(onChange).toHaveBeenCalledWith(ta.value);
  });
});
