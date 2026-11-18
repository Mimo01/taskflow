import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LabelsField } from './LabelsField';

function setup(labels: string[] = [], disabled = false) {
  const dispatch = vi.fn();
  render(<LabelsField id="labels" labels={labels} dispatch={dispatch} disabled={disabled} />);
  return { dispatch, input: screen.getByPlaceholderText('Add label') as HTMLInputElement };
}

const enter = (input: HTMLElement) => fireEvent.keyDown(input, { key: 'Enter' });

describe('LabelsField', () => {
  it('removes a chip via its button', () => {
    const { dispatch } = setup(['a', 'b']);
    fireEvent.click(screen.getByLabelText('Remove label a'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_FIELD', field: 'labels', value: ['b'] });
  });

  it('adds a label on Enter', () => {
    const { dispatch, input } = setup(['x']);
    fireEvent.change(input, { target: { value: 'alpha' } });
    enter(input);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_FIELD',
      field: 'labels',
      value: ['x', 'alpha'],
    });
  });

  it('ignores blank input and duplicates', () => {
    const { dispatch, input } = setup(['x']);
    fireEvent.change(input, { target: { value: '  ' } });
    enter(input);
    fireEvent.change(input, { target: { value: 'x' } });
    enter(input);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('splits on whitespace', () => {
    const { dispatch, input } = setup();
    fireEvent.change(input, { target: { value: 'a b' } });
    enter(input);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_FIELD',
      field: 'labels',
      value: ['a', 'b'],
    });
  });

  it('Esc clears text and stops propagation only when text present', () => {
    const { input } = setup();
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('');
    expect(outer).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(outer).toHaveBeenCalled();
    document.removeEventListener('keydown', outer);
  });

  it('disables the input', () => {
    const { input } = setup([], true);
    expect(input.disabled).toBe(true);
  });
});

describe('LabelsField multi-entry', () => {
  it('commits on comma and on blur, keeping earlier labels', () => {
    const dispatch = vi.fn();
    const { rerender } = render(<LabelsField id="l" labels={[]} dispatch={dispatch} />);
    const input = screen.getByPlaceholderText('Add label');
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_FIELD',
      field: 'labels',
      value: ['alpha'],
    });
    rerender(<LabelsField id="l" labels={['alpha']} dispatch={dispatch} />);
    const next = screen.getByPlaceholderText('Add label');
    fireEvent.change(next, { target: { value: 'beta, gamma' } });
    fireEvent.blur(next);
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_FIELD',
      field: 'labels',
      value: ['alpha', 'beta', 'gamma'],
    });
  });
});
